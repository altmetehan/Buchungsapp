import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/**
 * BuchungsbestaetigungDocument.js
 * --------------------------------
 * Baut das PDF-Layout einer Buchungsbestätigung für den Gast.
 * Verwendet bewusst React.createElement (e), da Node.js Backend-seitig
 * kein JSX ohne Build-Schritt ausführt.
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
    marginBottom: 25,
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
  metaBlock: {
    textAlign: "right",
  },
  metaTitel: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 9,
    color: "#71717a",
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  adressBlock: {
    marginBottom: 20,
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
  gastDetail: {
    fontSize: 9,
    color: "#52525b",
    marginTop: 2,
  },
  welcomeBox: {
    backgroundColor: "#f4f4f5",
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
  },
  welcomeTitel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 9,
    color: "#3f3f46",
    lineHeight: 1.4,
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
  spalteBeschreibung: { width: "38%" },
  spalteZeitraum: { width: "32%" },
  spalteGaeste: { width: "15%" },
  spalteBetrag: { width: "15%", textAlign: "right" },
  headerText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#71717a",
    textTransform: "uppercase",
  },
  summenBlock: {
    marginTop: 15,
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
  hinweisBlock: {
    marginTop: 25,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 4,
  },
  hinweisTitel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    color: "#111111",
  },
  hinweisZeile: {
    fontSize: 8.5,
    color: "#52525b",
    marginBottom: 2,
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

/** Formatiert eine Zahl als "€ 1.234,50" */
const formatEuro = (zahl) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(zahl || 0);

/** Formatiert einen ISO-Zeitstempel ("erstellt_am") als "DD.MM.YYYY" */
const formatZeitstempelKurz = (isoStr) => (isoStr ? new Date(isoStr).toLocaleDateString("de-DE") : "");

/** Prüft ob stundenbasiert */
const istStundenbasiert = (objektName) => !objektName?.toLowerCase().includes("wohnung");

export function BuchungsbestaetigungDocument({ buchung }) {
  const gast = buchung.Gaeste;
  const objekt = buchung.Objekte;
  const zusatzobjekt = buchung.ObjekteZusatz;

  const anreiseZeit = buchung.anreise_zeit || "15:00";
  const abreiseZeit = buchung.abreise_zeit || "11:00";

  const stundenbasiert = istStundenbasiert(objekt?.name);
  const istKombi = Boolean(zusatzobjekt);
  const istReinesStundenObjekt = !istKombi && stundenbasiert;

  const zeitraumText = stundenbasiert
    ? `${buchung.anreise} (${buchung.anreise_zeit || "-"} Uhr) bis ${buchung.abreise} (${buchung.abreise_zeit || "-"} Uhr)`
    : `${buchung.anreise} bis ${buchung.abreise}`;

  const beschreibungText = zusatzobjekt ? `${objekt?.name} inkl. ${zusatzobjekt.name}` : objekt?.name;

  const gaesteText = `${buchung.erwachsene ?? 1} Erw.${buchung.kinder ? ` · ${buchung.kinder} Kind.` : ""}`;

  return e(
    Document,
    null,
    e(
      Page,
      { size: "A4", style: styles.page },

      // ─── KOPFZEILE: FIRMA LINKS, BUCHUNGS-META RECHTS ───
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
          { style: styles.metaBlock },
          e(Text, { style: styles.metaTitel }, "Buchungsbestätigung"),
          e(Text, { style: styles.metaLabel }, "Buchung-Nr."),
          e(Text, { style: styles.metaValue }, `#${buchung.id}`),
          e(Text, { style: styles.metaLabel }, "Datum"),
          e(Text, { style: styles.metaValue }, formatZeitstempelKurz(buchung.erstellt_am || buchung.created_at || new Date().toISOString())),
        ),
      ),

      // ─── GAST-DATEN ───
      e(
        View,
        { style: styles.adressBlock },
        e(Text, { style: styles.blockTitel }, "Gast & Rechnungsadresse"),
        e(Text, { style: styles.gastName }, gast?.name),
        e(Text, null, `${gast?.strasse} ${gast?.hnr}`),
        e(Text, null, `${gast?.plz} ${gast?.stadt}`),
        e(Text, null, gast?.land),
        gast?.telnr && e(Text, { style: styles.gastDetail }, `Tel: ${gast.telnr}`),
        gast?.email && e(Text, { style: styles.gastDetail }, `E-Mail: ${gast.email}`),
      ),

      // ─── WILLKOMMENS-BOX ───
      e(
        View,
        { style: styles.welcomeBox },
        e(Text, { style: styles.welcomeTitel }, `Vielen Dank für Ihre Buchung, ${gast?.name || "lieber Gast"}!`),
        e(
          Text,
          { style: styles.welcomeText },
          "Wir freuen uns sehr auf Ihren Aufenthalt bei uns. Nachfolgend finden Sie die Details und den gebuchten Zeitraum Ihrer Reservierung.",
        ),
      ),

      // ─── POSITIONSTABELLE ───
      e(
        View,
        { style: styles.tabelle },
        e(
          View,
          { style: styles.tabelleHeaderRow },
          e(Text, { style: [styles.spalteBeschreibung, styles.headerText] }, "Gebuchtes Objekt"),
          e(Text, { style: [styles.spalteZeitraum, styles.headerText] }, "Zeitraum"),
          e(Text, { style: [styles.spalteGaeste, styles.headerText] }, "Gäste"),
          e(Text, { style: [styles.spalteBetrag, styles.headerText] }, "Gesamtpreis"),
        ),
        e(
          View,
          { style: styles.tabelleRow },
          e(Text, { style: styles.spalteBeschreibung }, beschreibungText),
          e(Text, { style: styles.spalteZeitraum }, zeitraumText),
          e(Text, { style: styles.spalteGaeste }, gaesteText),
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

      // ─── HINWEISE / CHECK-IN INFOS DYNAMISCH ───
      e(
        View,
        { style: styles.hinweisBlock },
        e(
          Text,
          { style: styles.hinweisTitel },
          istReinesStundenObjekt ? "Wichtige Informationen zu Ihrer Reservierung" : "Wichtige Informationen zu Ihrem Aufenthalt"
        ),

        istReinesStundenObjekt
          ? [
              e(Text, { key: "h1", style: styles.hinweisZeile }, `• Abholung / Beginn: Ab ${anreiseZeit} Uhr.`),
              e(Text, { key: "h2", style: styles.hinweisZeile }, `• Rückgabe / Ende: Bis ${abreiseZeit} Uhr.`),
            ]
          : [
              e(Text, { key: "h1", style: styles.hinweisZeile }, `• Anreise / Check-in: Ab ${anreiseZeit} Uhr.`),
              e(Text, { key: "h2", style: styles.hinweisZeile }, `• Abreise / Check-out: Bis ${abreiseZeit} Uhr.`),
            ],

        istKombi &&
          e(
            Text,
            { key: "h3", style: styles.hinweisZeile },
            `• Zusatzobjekt (${zusatzobjekt.name}): Steht Ihnen im gesamten Zeitraum Ihrer Wohnungsbuchung zur Verfügung.`
          ),

        e(
          Text,
          { style: styles.hinweisZeile },
          "• Bei Fragen oder Terminänderungen erreichen Sie uns unter office@beckhoff-verwaltung.at."
        )
      ),

      // ─── FUSSZEILE ───
      e(
        Text,
        { style: styles.footer },
        "Beckhoff Verwaltung · Hauptstraße 11, 6706 Bürs · Diese Buchungsbestätigung wurde maschinell erstellt.",
      ),
    ),
  );
}