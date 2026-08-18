// backend/src/pdf/BuchungsBestaetigungDocument.js
import React from "react";
import path from "path";
import { fileURLToPath } from "url";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

/**
 * BuchungsbestaetigungDocument.js
 * --------------------------------
 * Baut das PDF-Layout einer Buchungsbestätigung für den Gast.
 *
 * Identisches, klassisches Layout-Gerüst wie RechnungDocument.js
 * (Firmenkopf, Empfänger links / Infobox rechts, echtes Tabellenraster,
 * dreispaltige Fußzeile), damit beide Dokumente wie ein zusammen-
 * gehöriges, klassisches Set wirken - nur mit einem kurzen
 * Begrüßungs-/Hinweistext anstelle des Summenblocks als Kernstück.
 */
const e = React.createElement;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "../assets/logo-rot.jpg");

const FIRMA = {
  name: "Beckhoff Automation GmbH",
  strasse: "Hauptstraße 11",
  ort: "6706 Bürs, Österreich",
  email: "info@beckhoff.at",
  uid: "UID-Nr. ATU54127804",
  firmenbuch: "FN 222233p",
  gericht: "Landesgericht Feldkirch",
};

const SCHWARZ = "#111111";
const GRAU = "#555555";
const GRAU_HELL = "#8a8a8a";
const LINIE = "#111111";
const LINIE_HELL = "#bdbdbd";
const KOPF_GRAU = "#eeeeee";
const KOPF_ROT = "#e3000030";

const styles = StyleSheet.create({
  page: {
    padding: 46,
    paddingBottom: 60,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: SCHWARZ,
    lineHeight: 1.35,
  },

  // ─── FIRMENKOPF ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  logo: { width: 104, height: 19 },
  absenderBlock: { alignItems: "flex-end" },
  absenderName: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  absenderZeile: { fontSize: 8, color: GRAU, textAlign: "right" },
  kopfLinie: {
    borderBottomWidth: 1.2,
    borderBottomColor: LINIE,
    borderBottomStyle: "solid",
    marginBottom: 34,
  },

  // ─── EMPFÄNGER (links) + INFOBOX (rechts) ───
  adressZeile2Spalten: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
  },
  empfaengerSpalte: { width: "55%" },
  absenderKurzzeile: {
    fontSize: 7.5,
    color: GRAU_HELL,
    marginBottom: 10,
    textDecoration: "underline",
  },
  empfaengerName: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  empfaengerZeile: { fontSize: 9.5 },
  gastDetailZeile: { fontSize: 8.5, color: GRAU, marginTop: 4 },

  infoBox: {
    width: "40%",
    borderWidth: 1,
    borderColor: LINIE,
    borderStyle: "solid",
  },
  infoBoxTitel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    padding: "8 10",
    borderBottomWidth: 1,
    borderBottomColor: LINIE,
    borderBottomStyle: "solid",
  },
  infoBoxRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: LINIE_HELL,
    borderBottomStyle: "solid",
  },
  infoBoxRowLast: { flexDirection: "row" },
  infoBoxLabel: {
    width: "52%",
    fontSize: 8.5,
    color: GRAU,
    padding: "6 10",
    borderRightWidth: 0.75,
    borderRightColor: LINIE_HELL,
    borderRightStyle: "solid",
  },
  infoBoxWert: { width: "48%", fontSize: 8.5, fontFamily: "Helvetica-Bold", padding: "6 10" },

  // ─── BEGRÜSSUNG (schlichter Absatz, keine Box) ───
  begruessung: {
    fontSize: 9.5,
    marginBottom: 26,
  },

  // ─── TABELLE ALS ECHTES GITTER ───
  tabelle: { borderWidth: 1, borderColor: LINIE, borderStyle: "solid" },
  tRow: { flexDirection: "row" },
  tHeadRow: {
    flexDirection: "row",
    backgroundColor: KOPF_ROT,
    borderBottomWidth: 1,
    borderBottomColor: LINIE,
    borderBottomStyle: "solid",
  },
  colPos: { width: "7%" },
  colBeschreibung: { width: "35%" },
  colZeitraum: { width: "30%" },
  colGaeste: { width: "13%" },
  colBetrag: { width: "15%" },
  zelle: {
    padding: "7 9",
    borderRightWidth: 0.75,
    borderRightColor: LINIE_HELL,
    borderRightStyle: "solid",
  },
  zelleLetzte: { padding: "7 9" },
  headText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  betragRechts: { textAlign: "right" },
  zeitraumText: { color: GRAU },

  // ─── SUMMENBLOCK ───
  summenBereich: { marginTop: 16, alignItems: "flex-end" },
  summenZeile: {
    flexDirection: "row",
    width: "48%",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderTopWidth: 1.4,
    borderTopColor: LINIE,
    borderTopStyle: "solid",
  },
  summenLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  summenWert: { fontSize: 12.5, fontFamily: "Helvetica-Bold" },

  // ─── HINWEISE (schlichte Liste, keine Box) ───
  hinweisBlock: {
    marginTop: 30,
    borderTopWidth: 0.75,
    borderTopColor: LINIE_HELL,
    borderTopStyle: "solid",
    paddingTop: 10,
  },
  hinweisTitel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: GRAU,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  hinweisZeile: { fontSize: 9.5, color: GRAU, marginBottom: 4, lineHeight: 1.35 },

  gruss: { marginTop: 22, fontSize: 9.5 },

  // ─── FUSSZEILE ───
  footer: {
    position: "absolute",
    bottom: 30,
    left: 46,
    right: 46,
    flexDirection: "row",
    borderTopWidth: 0.75,
    borderTopColor: LINIE,
    borderTopStyle: "solid",
    paddingTop: 8,
  },
  footerSpalte: {
    flex: 1,
    paddingRight: 12,
    borderRightWidth: 0.5,
    borderRightColor: LINIE_HELL,
    borderRightStyle: "solid",
  },
  footerSpalteMitte: {
    flex: 1,
    paddingRight: 12,
    paddingLeft: 12,
    borderRightWidth: 0.5,
    borderRightColor: LINIE_HELL,
    borderRightStyle: "solid",
  },
  footerSpalteLetzte: { flex: 1, paddingLeft: 12 },
  footerTitel: {
    fontSize: 6.5,
    color: GRAU_HELL,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  footerZeile: { fontSize: 7.5, color: GRAU, lineHeight: 1.4 },
});

const formatEuro = (zahl) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(zahl || 0);

const formatZeitstempelKurz = (isoStr) => (isoStr ? new Date(isoStr).toLocaleDateString("de-DE") : "");

const istStundenbasiert = (objektName) => !objektName?.toLowerCase().includes("wohnung");

function Firmenkopf() {
  return e(
    View,
    null,
    e(
      View,
      { style: styles.headerRow },
      e(Image, { style: styles.logo, src: LOGO_PATH }),
      e(
        View,
        { style: styles.absenderBlock },
        e(Text, { style: styles.absenderName }, FIRMA.name),
        e(Text, { style: styles.absenderZeile }, FIRMA.strasse),
        e(Text, { style: styles.absenderZeile }, FIRMA.ort),
        e(Text, { style: styles.absenderZeile }, FIRMA.email),
      ),
    ),
    e(View, { style: styles.kopfLinie }),
  );
}

function Fusszeile() {
  return e(
    View,
    { style: styles.footer, fixed: true },
    e(
      View,
      { style: styles.footerSpalte },
      e(Text, { style: styles.footerTitel }, "Unternehmen"),
      e(Text, { style: styles.footerZeile }, FIRMA.name),
      e(Text, { style: styles.footerZeile }, `${FIRMA.strasse}, ${FIRMA.ort}`),
    ),
    e(
      View,
      { style: styles.footerSpalteMitte },
      e(Text, { style: styles.footerTitel }, "Kontakt"),
      e(Text, { style: styles.footerZeile }, FIRMA.email),
    ),
    e(
      View,
      { style: styles.footerSpalteLetzte },
      e(Text, { style: styles.footerTitel }, "Registerdaten"),
      e(Text, { style: styles.footerZeile }, FIRMA.uid),
      e(Text, { style: styles.footerZeile }, `${FIRMA.firmenbuch} · ${FIRMA.gericht}`),
    ),
  );
}

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
    ? `${buchung.anreise} (${buchung.anreise_zeit || "-"} Uhr) – ${buchung.abreise} (${buchung.abreise_zeit || "-"} Uhr)`
    : `${buchung.anreise} – ${buchung.abreise}`;

  const beschreibungText = zusatzobjekt ? `${objekt?.name} inkl. ${zusatzobjekt.name}` : objekt?.name;
  const gaesteText = `${buchung.erwachsene ?? 1} Erw.${buchung.kinder ? ` · ${buchung.kinder} Kind.` : ""}`;

  return e(
    Document,
    null,
    e(
      Page,
      { size: "A4", style: styles.page },

      Firmenkopf(),

      // ─── EMPFÄNGER LINKS / INFOBOX RECHTS ───
      e(
        View,
        { style: styles.adressZeile2Spalten },
        e(
          View,
          { style: styles.empfaengerSpalte },
          e(
            Text,
            { style: styles.absenderKurzzeile },
            `${FIRMA.name} · ${FIRMA.strasse} · ${FIRMA.ort}`,
          ),
          e(Text, { style: styles.empfaengerName }, gast?.name),
          e(Text, { style: styles.empfaengerZeile }, `${gast?.strasse} ${gast?.hnr}`),
          e(Text, { style: styles.empfaengerZeile }, `${gast?.plz} ${gast?.stadt}`),
          e(Text, { style: styles.empfaengerZeile }, gast?.land),
          (gast?.telnr || gast?.email) &&
            e(
              Text,
              { style: styles.gastDetailZeile },
              [gast?.telnr ? `Tel: ${gast.telnr}` : null, gast?.email ? `E-Mail: ${gast.email}` : null]
                .filter(Boolean)
                .join("  ·  "),
            ),
        ),
        e(
          View,
          { style: styles.infoBox },
          e(Text, { style: styles.infoBoxTitel }, "Buchungsbestätigung"),
          e(
            View,
            { style: styles.infoBoxRow },
            e(Text, { style: styles.infoBoxLabel }, "Buchung-Nr."),
            e(Text, { style: styles.infoBoxWert }, `#${buchung.id}`),
          ),
          e(
            View,
            { style: styles.infoBoxRowLast },
            e(Text, { style: styles.infoBoxLabel }, "Datum"),
            e(
              Text,
              { style: styles.infoBoxWert },
              formatZeitstempelKurz(buchung.erstellt_am || buchung.created_at || new Date().toISOString()),
            ),
          ),
        ),
      ),

      // ─── BEGRÜSSUNG ───
      e(
        Text,
        { style: styles.begruessung },
        `Vielen Dank für Ihre Buchung, ${gast?.name || "lieber Gast"}! Wir freuen uns auf Ihren Aufenthalt bei uns. Nachfolgend finden Sie die Details Ihrer Reservierung.`,
      ),

      // ─── TABELLE ALS ECHTES GITTER ───
      e(
        View,
        { style: styles.tabelle },
        e(
          View,
          { style: styles.tHeadRow },
          e(Text, { style: [styles.colPos, styles.zelle, styles.headText] }, "Pos."),
          e(Text, { style: [styles.colBeschreibung, styles.zelle, styles.headText] }, "Gebuchtes Objekt"),
          e(Text, { style: [styles.colZeitraum, styles.zelle, styles.headText] }, "Zeitraum"),
          e(Text, { style: [styles.colGaeste, styles.zelle, styles.headText] }, "Gäste"),
          e(Text, { style: [styles.colBetrag, styles.zelleLetzte, styles.headText, styles.betragRechts] }, "Preis"),
        ),
        e(
          View,
          { style: styles.tRow },
          e(Text, { style: [styles.colPos, styles.zelle] }, "1"),
          e(Text, { style: [styles.colBeschreibung, styles.zelle] }, beschreibungText),
          e(Text, { style: [styles.colZeitraum, styles.zelle, styles.zeitraumText] }, zeitraumText),
          e(Text, { style: [styles.colGaeste, styles.zelle, styles.zeitraumText] }, gaesteText),
          e(Text, { style: [styles.colBetrag, styles.zelleLetzte, styles.betragRechts] }, formatEuro(buchung.preis)),
        ),
      ),

      // ─── SUMMENBLOCK ───
      e(
        View,
        { style: styles.summenBereich },
        e(
          View,
          { style: styles.summenZeile },
          e(Text, { style: styles.summenLabel }, "Gesamtbetrag"),
          e(Text, { style: styles.summenWert }, formatEuro(buchung.preis)),
        ),
      ),

      // ─── HINWEISE / CHECK-IN INFOS ───
      e(
        View,
        { style: styles.hinweisBlock },
        e(
          Text,
          { style: styles.hinweisTitel },
          istReinesStundenObjekt ? "Wichtige Informationen zu Ihrer Reservierung" : "Wichtige Informationen zu Ihrem Aufenthalt",
        ),

        istReinesStundenObjekt
          ? [
              e(Text, { key: "h1", style: styles.hinweisZeile }, `•  Abholung / Beginn: Ab ${anreiseZeit} Uhr.`),
              e(Text, { key: "h2", style: styles.hinweisZeile }, `•  Rückgabe / Ende: Bis ${abreiseZeit} Uhr.`),
            ]
          : [
              e(Text, { key: "h1", style: styles.hinweisZeile }, `•  Anreise / Check-in: Ab ${anreiseZeit} Uhr.`),
              e(Text, { key: "h2", style: styles.hinweisZeile }, `•  Abreise / Check-out: Bis ${abreiseZeit} Uhr.`),
            ],

        istKombi &&
          e(
            Text,
            { key: "h3", style: styles.hinweisZeile },
            `•  Zusatzobjekt (${zusatzobjekt.name}): Steht Ihnen im gesamten Zeitraum Ihrer Wohnungsbuchung zur Verfügung.`,
          ),

        e(
          Text,
          { style: styles.hinweisZeile },
          `•  Bei Fragen oder Terminänderungen erreichen Sie uns unter ${FIRMA.email}.`,
        ),
      ),

      e(Text, { style: styles.gruss }, "Mit freundlichen Grüßen\nBeckhoff Automation GmbH"),

      Fusszeile(),
    ),
  );
}