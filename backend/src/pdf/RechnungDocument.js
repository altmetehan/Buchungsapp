// backend/src/pdf/RechnungDocument.js
import React from "react";
import path from "path";
import { fileURLToPath } from "url";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

/**
 * RechnungDocument.js
 * --------------------
 * Baut das PDF-Layout einer einzelnen Rechnung.
 *
 * LAYOUT-VORBILD: der echte Beckhoff-Lieferschein - bewusst KEIN
 * dichtes Tabellenraster mehr, sondern viel Weißraum, dünne graue
 * Trennlinien statt Boxen, ein "Ihre Daten"/"Rechnungsdaten"-
 * Zweispalten-Block mit unterstrichenen Abschnittstiteln, und
 * Positionsblöcke mit fett gesetzter Bezeichnung + grauen Detailzeilen
 * darunter (genau wie beim Lieferschein: Art-Nr., Beschreibung,
 * Ursprungsland, ... - hier eben Objektbeschreibung, Zeitraum,
 * Berechnungsgrundlage). Beckhoff-Rot (#e30000) wird bewusst SPARSAM
 * eingesetzt (~20%): nur als Trennlinie unter dem Kopf, für die
 * Positionsnummern und für den Gesamtbetrag - der Rest bleibt
 * Schwarz/Grau wie im Original.
 *
 * WICHTIG: Diese Datei nutzt bewusst KEIN JSX, weil das Backend reines
 * Node/ESM ist und keinen Build-Schritt durchläuft. "e" ist die kurze
 * Abkürzung für React.createElement.
 *
 * LOGO: liegt lokal im Backend unter src/assets/logo-rot.jpg.
 */
const e = React.createElement;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "../assets/logo-rot.jpg");

// ─── ZENTRALE FIRMENDATEN (Beckhoff Automation GmbH, Österreich) ───
const FIRMA = {
  name: "Beckhoff Automation GmbH",
  strasse: "Hauptstraße 11",
  ort: "6706 Bürs",
  land: "Österreich",
  telefon: "+43 5552 688-0",
  email: "office@beckhoff-verwaltung.at",
  web: "www.beckhoff.com",
  uid: "ATU54127804",
  firmenbuch: "FN 222233p",
  gericht: "Landesgericht Feldkirch",
};

const ROT = "#e30000"; // bewusst sparsam eingesetzter Beckhoff-Rot-Akzent
const SCHWARZ = "#111111";
const GRAU = "#555555";
const GRAU_HELL = "#8f8f8f";
const LINIE_HELL = "#d8d8d8";

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingHorizontal: 46,
    paddingBottom: 58,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: SCHWARZ,
    lineHeight: 1.4,
  },

  // ─── KOPFZEILE: LOGO LINKS, TAGLINE RECHTS ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  logo: { width: 118, height: 22 },
  tagline: {
    fontSize: 9,
    color: GRAU,
    fontFamily: "Helvetica-Bold",
  },

  // ─── ADRESSZEILE (klein, grau, unterstrichen - Fensterbrief-Konvention) ───
  kurzAdresse: {
    fontSize: 6.5,
    color: GRAU_HELL,
    textDecoration: "underline",
    marginBottom: 14,
  },

  // ─── EMPFÄNGER LINKS / DOKUMENTTITEL + META RECHTS ───
  obererBereich: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  empfaengerSpalte: { width: "52%" },
  empfaengerName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  empfaengerZeile: { fontSize: 9 },

  metaSpalte: { alignItems: "flex-end" },
  dokumentTitel: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  metaZeile: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { fontSize: 8.5, color: GRAU, width: 95, textAlign: "right", marginRight: 10 },
  metaWert: { fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "right" },

  // Dünne rote Trennlinie unter dem oberen Bereich - der einzige
  // größere Rot-Einsatz im Dokument, statt der massiven roten Balken
  // aus vorherigen Entwürfen.
  trennlinieRot: {
    borderBottomWidth: 1.4,
    borderBottomColor: ROT,
    borderBottomStyle: "solid",
    marginBottom: 26,
  },

  // ─── "IHRE DATEN" / "RECHNUNGSDATEN" ZWEISPALTEN-BLOCK ───
  datenBereich: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  datenSpalte: { width: "46%" },
  abschnittTitel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: SCHWARZ,
    borderBottomStyle: "solid",
    width: "70%",
  },
  datenZeile: { flexDirection: "row", marginBottom: 5 },
  datenLabel: { fontSize: 8.5, color: GRAU, width: "48%" },
  datenWert: { fontSize: 8.5, fontFamily: "Helvetica-Bold", width: "52%" },

  // ─── POSITIONSTABELLE: KOPFZEILE ───
  posKopfRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: SCHWARZ,
    borderBottomStyle: "solid",
    paddingBottom: 5,
    marginBottom: 4,
  },
  colPos: { width: "9%" },
  colBezeichnung: { width: "56%" },
  colZeitraum: { width: "20%" },
  colBetrag: { width: "15%", textAlign: "right" },
  posKopfText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: GRAU,
  },

  // ─── EINZELNE POSITION (fett + graue Detailzeilen, wie im Lieferschein) ───
  posBlock: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 0.75,
    borderBottomColor: LINIE_HELL,
    borderBottomStyle: "solid",
  },
  posNummer: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: ROT, // kleiner, gezielter Rot-Akzent an der Positionsnummer
  },
  posName: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  posDetailZeile: { fontSize: 8, color: GRAU, marginBottom: 1.5 },
  posZeitraumText: { fontSize: 8.5, color: GRAU },
  posBetragText: { fontSize: 9.5, fontFamily: "Helvetica-Bold", textAlign: "right" },

  // ─── SUMMENBLOCK ───
  summenBereich: { alignItems: "flex-end", marginTop: 4 },
  summenZeile: {
    flexDirection: "row",
    width: "42%",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1.4,
    borderTopColor: SCHWARZ,
    borderTopStyle: "solid",
  },
  summenLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  summenWert: { fontSize: 13, fontFamily: "Helvetica-Bold", color: ROT },

  // ─── PREISANPASSUNGEN ───
  anpassungenBlock: { marginTop: 28 },
  anpassungenTitel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: GRAU,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  anpassungZeile: { fontSize: 8, marginBottom: 3, color: GRAU },

  // ─── SCHLUSSTEXT ───
  schlussText: { marginTop: 34, fontSize: 9 },
  gruss: { marginTop: 18, fontSize: 9 },

  // ─── FUSSZEILE: VIER SPALTEN MIT DÜNNEN TRENNLINIEN (wie im Original) ───
  footer: {
    position: "absolute",
    bottom: 28,
    left: 46,
    right: 46,
    flexDirection: "row",
    borderTopWidth: 0.75,
    borderTopColor: LINIE_HELL,
    borderTopStyle: "solid",
    paddingTop: 8,
  },
  footerSpalte: {
    flex: 1,
    paddingRight: 10,
    borderRightWidth: 0.5,
    borderRightColor: LINIE_HELL,
    borderRightStyle: "solid",
  },
  footerSpalteLetzte: { flex: 1, paddingLeft: 10 },
  footerZeile: { fontSize: 7, color: GRAU, lineHeight: 1.5 },
});

/** Formatiert eine Zahl als "€ 1.234,50". */
const formatEuro = (zahl) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(zahl || 0);

/** Formatiert einen ISO-Zeitstempel als "DD.MM.YYYY". */
const formatZeitstempelKurz = (isoStr) => (isoStr ? new Date(isoStr).toLocaleDateString("de-DE") : "");

/** Alles außer einer Wohnung wird stundenweise abgerechnet. */
const istStundenbasiert = (objektName) => !objektName?.toLowerCase().includes("wohnung");

/** "DD.MM.YYYY" -> Date-Objekt (lokal dupliziert, Backend/Frontend sind getrennte Umgebungen). */
function parseGermanDate(str) {
  if (!str) return null;
  const [d, m, y] = str.split(".").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Baut die Berechnungsgrundlage als Textzeile, z.B. "7 Nächte × € 120,00"
 * oder "4,5 Stunden × € 15,50" - damit auf der Rechnung genau
 * nachvollziehbar ist, WAS in welcher Menge zum Preis pro Einheit
 * berechnet wurde (informativer Zusatz, der Gesamtpreis in der
 * Betrags-Spalte bleibt immer der tatsächlich gespeicherte
 * buchung.preis).
 */
function berechnungsgrundlage(buchung, objekt, stundenbasiert) {
  const einzelpreis = objekt?.preis;
  if (!einzelpreis) return null;

  if (stundenbasiert) {
    const start = parseGermanDate(buchung.anreise);
    const ende = parseGermanDate(buchung.abreise);
    if (!start || !ende) return null;
    const [sh, sm] = (buchung.anreise_zeit || "09:00").split(":").map(Number);
    const [eh, em] = (buchung.abreise_zeit || "17:00").split(":").map(Number);
    start.setHours(sh, sm, 0, 0);
    ende.setHours(eh, em, 0, 0);
    const stunden = Math.max(0, (ende - start) / (1000 * 60 * 60));
    return `${stunden % 1 === 0 ? stunden.toFixed(0) : stunden.toFixed(1)} Stunden × ${formatEuro(einzelpreis)}`;
  }

  const start = parseGermanDate(buchung.anreise);
  const ende = parseGermanDate(buchung.abreise);
  if (!start || !ende) return null;
  const naechte = Math.max(1, Math.round((ende - start) / (1000 * 60 * 60 * 24)));
  return `${naechte} ${naechte === 1 ? "Nacht" : "Nächte"} × ${formatEuro(einzelpreis)}`;
}

/** Kopfzeile: Logo links, Tagline rechts, kleine unterstrichene Absenderzeile darunter. */
function Kopfbereich() {
  return e(
    View,
    null,
    e(
      View,
      { style: styles.headerRow },
      e(Image, { style: styles.logo, src: LOGO_PATH }),
      e(Text, { style: styles.tagline }, "New Automation Technology"),
    ),
    e(
      Text,
      { style: styles.kurzAdresse },
      `${FIRMA.name} · ${FIRMA.strasse} · ${FIRMA.ort} · ${FIRMA.land}`,
    ),
  );
}

/** Vierspaltige Fußzeile mit dünnen Trennlinien - Adresse / Kontakt / Geschäftsführung / Registerdaten. */
function Fusszeile() {
  return e(
    View,
    { style: styles.footer, fixed: true },
    e(
      View,
      { style: styles.footerSpalte },
      e(Text, { style: styles.footerZeile }, FIRMA.name),
      e(Text, { style: styles.footerZeile }, FIRMA.strasse),
      e(Text, { style: styles.footerZeile }, `${FIRMA.ort}, ${FIRMA.land}`),
    ),
    e(
      View,
      { style: styles.footerSpalte },
      e(Text, { style: styles.footerZeile }, `Telefon: ${FIRMA.telefon}`),
      e(Text, { style: styles.footerZeile }, FIRMA.web),
      e(Text, { style: styles.footerZeile }, FIRMA.email),
    ),
    e(
      View,
      { style: styles.footerSpalte },
      e(Text, { style: styles.footerZeile }, "Geschäftsführung:"),
      e(Text, { style: styles.footerZeile }, "Beckhoff Automation GmbH"),
      e(Text, { style: styles.footerZeile }, FIRMA.gericht),
    ),
    e(
      View,
      { style: styles.footerSpalteLetzte },
      e(Text, { style: styles.footerZeile }, `USt-IdNr. ${FIRMA.uid}`),
      e(Text, { style: styles.footerZeile }, FIRMA.firmenbuch),
    ),
  );
}

/**
 * RechnungDocument
 * ----------------
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
    ? `${buchung.anreise} (${buchung.anreise_zeit || "-"} Uhr)\n${buchung.abreise} (${buchung.abreise_zeit || "-"} Uhr)`
    : `${buchung.anreise}\n${buchung.abreise}`;

  const posName = zusatzobjekt ? `${objekt?.name} inkl. ${zusatzobjekt.name}` : objekt?.name;
  const grundlage = berechnungsgrundlage(buchung, objekt, stundenbasiert);

  return e(
    Document,
    null,
    e(
      Page,
      { size: "A4", style: styles.page },

      Kopfbereich(),

      // ─── EMPFÄNGER LINKS / TITEL + META RECHTS ───
      e(
        View,
        { style: styles.obererBereich },
        e(
          View,
          { style: styles.empfaengerSpalte },
          e(Text, { style: styles.empfaengerName }, gast?.name),
          e(Text, { style: styles.empfaengerZeile }, `${gast?.strasse} ${gast?.hnr}`),
          e(Text, { style: styles.empfaengerZeile }, `${gast?.plz} ${gast?.stadt}`),
          e(Text, { style: styles.empfaengerZeile }, gast?.land),
        ),
        e(
          View,
          { style: styles.metaSpalte },
          e(Text, { style: styles.dokumentTitel }, "Rechnung"),
          e(
            View,
            { style: styles.metaZeile },
            e(Text, { style: styles.metaLabel }, "Rechnungsnummer"),
            e(Text, { style: styles.metaWert }, rechnung.rechnungs_nummer),
          ),
          e(
            View,
            { style: styles.metaZeile },
            e(Text, { style: styles.metaLabel }, "Rechnungsdatum"),
            e(Text, { style: styles.metaWert }, rechnung.rechnungs_datum),
          ),
        ),
      ),

      e(View, { style: styles.trennlinieRot }),

      // ─── "IHRE DATEN" / "RECHNUNGSDATEN" ZWEISPALTEN-BLOCK ───
      e(
        View,
        { style: styles.datenBereich },
        e(
          View,
          { style: styles.datenSpalte },
          e(Text, { style: styles.abschnittTitel }, "Ihre Daten"),
          e(
            View,
            { style: styles.datenZeile },
            e(Text, { style: styles.datenLabel }, "Gast"),
            e(Text, { style: styles.datenWert }, gast?.name),
          ),
          e(
            View,
            { style: styles.datenZeile },
            e(Text, { style: styles.datenLabel }, "E-Mail"),
            e(Text, { style: styles.datenWert }, gast?.email),
          ),
        ),
        e(
          View,
          { style: styles.datenSpalte },
          e(Text, { style: styles.abschnittTitel }, "Rechnungsdaten"),
          e(
            View,
            { style: styles.datenZeile },
            e(Text, { style: styles.datenLabel }, "Buchungsnummer"),
            e(Text, { style: styles.datenWert }, `#${buchung.id}`),
          ),
          e(
            View,
            { style: styles.datenZeile },
            e(Text, { style: styles.datenLabel }, "Zahlungsziel"),
            e(Text, { style: styles.datenWert }, "Sofort fällig"),
          ),
        ),
      ),

      // ─── POSITIONSKOPF ───
      e(
        View,
        { style: styles.posKopfRow },
        e(Text, { style: [styles.colPos, styles.posKopfText] }, "Pos."),
        e(Text, { style: [styles.colBezeichnung, styles.posKopfText] }, "Bezeichnung"),
        e(Text, { style: [styles.colZeitraum, styles.posKopfText] }, "Zeitraum"),
        e(Text, { style: [styles.colBetrag, styles.posKopfText] }, "Betrag"),
      ),

      // ─── POSITIONSBLOCK (fett + graue Detailzeilen, wie im Lieferschein) ───
      e(
        View,
        { style: styles.posBlock },
        e(Text, { style: [styles.colPos, styles.posNummer] }, "100"),
        e(
          View,
          { style: styles.colBezeichnung },
          e(Text, { style: styles.posName }, posName),
          objekt?.beschreibung && e(Text, { style: styles.posDetailZeile }, objekt.beschreibung),
          grundlage && e(Text, { style: styles.posDetailZeile }, grundlage),
          zusatzobjekt &&
            e(
              Text,
              { style: styles.posDetailZeile },
              `inkl. Zusatzobjekt: ${zusatzobjekt.name}${zusatzobjekt.beschreibung ? " – " + zusatzobjekt.beschreibung : ""}`,
            ),
        ),
        e(Text, { style: [styles.colZeitraum, styles.posZeitraumText] }, zeitraumText),
        e(Text, { style: [styles.colBetrag, styles.posBetragText] }, formatEuro(buchung.preis)),
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

      // ─── PREISANPASSUNGEN (nur falls welche existieren) ───
      preisanpassungen.length > 0 &&
        e(
          View,
          { style: styles.anpassungenBlock },
          e(Text, { style: styles.anpassungenTitel }, "Nachträgliche Preisanpassungen"),
          ...preisanpassungen.map((a) =>
            e(
              Text,
              { key: a.id, style: styles.anpassungZeile },
              `${formatZeitstempelKurz(a.erstellt_am)}:  ${formatEuro(a.alter_betrag)}  →  ${formatEuro(a.neuer_betrag)}   (${a.grund})`,
            ),
          ),
        ),

      e(
        Text,
        { style: styles.schlussText },
        "Vielen Dank für Ihren Aufenthalt bei uns. Diese Rechnung wurde automatisch erstellt und ist ohne Unterschrift gültig.",
      ),
      e(Text, { style: styles.gruss }, "Mit freundlichen Grüßen\nBeckhoff Automation GmbH"),

      Fusszeile(),
    ),
  );
}