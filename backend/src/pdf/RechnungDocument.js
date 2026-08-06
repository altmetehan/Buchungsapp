// backend/src/pdf/RechnungDocument.js
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/**
 * RechnungDocument.js
 * --------------------
 * Baut das PDF-Layout einer einzelnen Rechnung.
 *
 * WICHTIG: Diese Datei nutzt bewusst KEIN JSX (kein "<Document>...</Document>"),
 * weil das Backend reines Node/ESM ist und - anders als das Frontend über
 * Vite - keinen Build-Schritt durchläuft, der JSX in echtes JavaScript
 * übersetzen würde. Stattdessen wird React.createElement direkt
 * aufgerufen. "e" ist nur eine kurze Abkürzung dafür, damit der Code
 * nicht komplett in "React.createElement(...)" erstickt.
 *
 * Für die Bold-Texte wird bewusst fontFamily: "Helvetica-Bold" statt
 * fontWeight: 700 verwendet - react-pdf bringt nur die Standard-PDF-
 * Schriftarten (Helvetica, Helvetica-Bold, Times-Roman, Courier, ...)
 * von Haus aus mit, "fontWeight" auf der normalen Helvetica wird nicht
 * zuverlässig fett dargestellt.
 */
const e = React.createElement;

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  firmenName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#e30000",
    marginBottom: 4,
  },
  firmenAdresse: {
    fontSize: 9,
    color: "#71717a",
  },
  rechnungMeta: {
    textAlign: "right",
  },
  rechnungMetaLabel: {
    fontSize: 9,
    color: "#71717a",
  },
  rechnungMetaValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  adressBlock: {
    marginBottom: 30,
  },
  blockTitel: {
    fontSize: 9,
    color: "#71717a",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  gastName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  tabelle: {
    marginTop: 10,
  },
  tabelleHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    borderBottomStyle: "solid",
    paddingBottom: 6,
    marginBottom: 6,
  },
  tabelleRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    borderBottomStyle: "solid",
    paddingVertical: 8,
  },
  spalteBeschreibung: { width: "50%" },
  spalteZeitraum: { width: "30%" },
  spalteBetrag: { width: "20%", textAlign: "right" },
  headerText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#71717a",
    textTransform: "uppercase",
  },
  summenBlock: {
    marginTop: 20,
    alignItems: "flex-end",
  },
  gesamtZeile: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 220,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#111111",
    borderTopStyle: "solid",
  },
  gesamtLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  gesamtWert: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#e30000" },
  anpassungenBlock: {
    marginTop: 30,
    padding: 12,
    backgroundColor: "#f4f4f5",
    borderRadius: 4,
  },
  anpassungenTitel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: "#71717a",
    textTransform: "uppercase",
  },
  anpassungZeile: {
    fontSize: 9,
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#a1a1aa",
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    borderTopStyle: "solid",
    paddingTop: 10,
  },
});

/** Formatiert eine Zahl als "€ 1.234,50" - dieselbe Logik wie im Frontend, hier lokal, weil Backend und Frontend getrennte Umgebungen sind. */
const formatEuro = (zahl) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(zahl || 0);

/** Formatiert einen ISO-Zeitstempel ("erstellt_am") als "DD.MM.YYYY". */
const formatZeitstempelKurz = (isoStr) => (isoStr ? new Date(isoStr).toLocaleDateString("de-DE") : "");

/** Alles außer einer Wohnung wird stundenweise abgerechnet - exakt dieselbe Regel wie istStundenbasiert() in utils/javaUtils.js im Frontend. */
const istStundenbasiert = (objektName) => !objektName?.toLowerCase().includes("wohnung");

/**
 * RechnungDocument
 * ----------------
 * Bekommt die Rechnung inkl. verschachtelter Buchung/Gast/Objekt-Daten
 * (siehe rechnungen.routes.js, Route GET /:id/pdf) und gibt ein
 * <Document>-Element zurück, das renderToBuffer() dann in echte
 * PDF-Bytes umwandelt.
 *
 * WICHTIG: Der angezeigte Gesamtbetrag ist IMMER buchung.preis (der
 * tatsächlich in der DB gespeicherte, ggf. über Rabatt/Preisanpassungen
 * korrigierte Endpreis) - er wird NICHT hier nochmal aus Nächten/
 * Stunden x Objektpreis neu berechnet. So kann die PDF nie einen
 * anderen Betrag zeigen als die restliche App (Reservierungen,
 * Rechnungen-Tabelle, Buchungskarte).
 *
 * @param {object} props
 * @param {object} props.rechnung - Rechnungen-Datensatz (rechnungs_nummer, rechnungs_datum)
 * @param {object} props.buchung - zugehörige Buchung inkl. Gaeste/Objekte/ObjekteZusatz/Preisanpassungen
 * @returns {React.ReactElement}
 */
export function RechnungDocument({ rechnung, buchung }) {
  const gast = buchung.Gaeste;
  const objekt = buchung.Objekte;
  const zusatzobjekt = buchung.ObjekteZusatz;
  const preisanpassungen = buchung.Preisanpassungen || [];

  const stundenbasiert = istStundenbasiert(objekt?.name);
  const zeitraumText = stundenbasiert
    ? `${buchung.anreise} (${buchung.anreise_zeit || "-"} Uhr) bis ${buchung.abreise} (${buchung.abreise_zeit || "-"} Uhr)`
    : `${buchung.anreise} bis ${buchung.abreise}`;

  const beschreibungText = zusatzobjekt ? `${objekt?.name} inkl. ${zusatzobjekt.name}` : objekt?.name;

  return e(
    Document,
    null,
    e(
      Page,
      { size: "A4", style: styles.page },

      // ─── KOPFZEILE: FIRMA LINKS, RECHNUNGSDATEN RECHTS ───
      e(
        View,
        { style: styles.headerRow },
        e(
          View,
          null,
          e(Text, { style: styles.firmenName }, "Beckhoff"),
          e(Text, { style: styles.firmenAdresse }, "Hauptstraße 11, 6706 Bürs"),
          e(Text, { style: styles.firmenAdresse }, "office@beckhoff-verwaltung.at"),
        ),
        e(
          View,
          { style: styles.rechnungMeta },
          e(Text, { style: styles.rechnungMetaLabel }, "Rechnungsnummer"),
          e(Text, { style: styles.rechnungMetaValue }, rechnung.rechnungs_nummer),
          e(Text, { style: styles.rechnungMetaLabel }, "Rechnungsdatum"),
          e(Text, { style: styles.rechnungMetaValue }, rechnung.rechnungs_datum),
        ),
      ),

      // ─── GAST-ADRESSE ───
      e(
        View,
        { style: styles.adressBlock },
        e(Text, { style: styles.blockTitel }, "Rechnungsempfänger"),
        e(Text, { style: styles.gastName }, gast?.name),
        e(Text, null, `${gast?.strasse} ${gast?.hnr}`),
        e(Text, null, `${gast?.plz} ${gast?.stadt}`),
        e(Text, null, gast?.land),
      ),

      // ─── POSITIONSTABELLE ───
      e(
        View,
        { style: styles.tabelle },
        e(
          View,
          { style: styles.tabelleHeaderRow },
          e(Text, { style: [styles.spalteBeschreibung, styles.headerText] }, "Beschreibung"),
          e(Text, { style: [styles.spalteZeitraum, styles.headerText] }, "Zeitraum"),
          e(Text, { style: [styles.spalteBetrag, styles.headerText] }, "Betrag"),
        ),
        e(
          View,
          { style: styles.tabelleRow },
          e(Text, { style: styles.spalteBeschreibung }, beschreibungText),
          e(Text, { style: styles.spalteZeitraum }, zeitraumText),
          e(Text, { style: styles.spalteBetrag }, formatEuro(buchung.preis)),
        ),
      ),

      // ─── SUMME ───
      e(
        View,
        { style: styles.summenBlock },
        e(
          View,
          { style: styles.gesamtZeile },
          e(Text, { style: styles.gesamtLabel }, "Gesamtbetrag"),
          e(Text, { style: styles.gesamtWert }, formatEuro(buchung.preis)),
        ),
      ),

      // ─── PREISANPASSUNGEN (nur falls welche existieren) ───
      preisanpassungen.length > 0 &&
        e(
          View,
          { style: styles.anpassungenBlock },
          e(Text, { style: styles.anpassungenTitel }, "Hinweis: nachträgliche Preisanpassungen"),
          ...preisanpassungen.map((a) =>
            e(
              Text,
              { key: a.id, style: styles.anpassungZeile },
              `${formatZeitstempelKurz(a.erstellt_am)}: ${formatEuro(a.alter_betrag)} -> ${formatEuro(a.neuer_betrag)} (${a.grund})`,
            ),
          ),
        ),

      // ─── FUSSZEILE ───
      e(
        Text,
        { style: styles.footer },
        "Vielen Dank für Ihren Aufenthalt bei Beckhoff! Diese Rechnung wurde automatisch erstellt und ist ohne Unterschrift gültig.",
      ),
    ),
  );
}