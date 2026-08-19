import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { getLogoBase64 } from '../utils/pdfUtils.js';

/**
 * @file RechnungDocument.js
 * @description PDF-Belegvorlage („Information für die Buchhaltung“) im CI-konformen Unternehmensdesign (Beckhoff Automation).
 *              Generiert über `@react-pdf/renderer` eine druckreife A4-Aufstellung mit
 *              dynamischen Leistungspositionen, optionalen Zusatzleistungen (z. B. Bus),
 *              historisierten Preisanpassungen als Einzelposten, automatischer steuerlicher
 *              Aufschlüsselung (Netto-Leistung, Mehrwertsteuer, Ortstaxe) sowie standardisiertem
 *              Briefkopf, Fälligkeitsberechnung und dreispaltiger Fußzeile.
 * @module pdf/RechnungDocument
 */

/**
 * Alias für React.createElement zur deklarativen Baumkonstruktion im Backend.
 * @type {Function}
 */
const h = React.createElement;

/**
 * Farbpalette für das PDF-Dokumentenlayout.
 * @constant
 * @type {Object.<string, string>}
 */
const COLORS = {
  primary: '#E30000',       // Beckhoff Rot (Akzentfarbe)
  textPrimary: '#18181B',   // Tiefes Anthrazit für Fließtext und Titel
  textSecondary: '#52525B', // Neutrales Dunkelgrau für Beschreibungen und Labels
  textMuted: '#8E8E93',     // Dezent für Metadaten und Hilfslinien
  borderLight: '#E4E4E7',   // Helle Trennlinien
  borderDark: '#27272A',    // Dunkle Akzenttrennlinien (Tabellenkopf / Summenbereich)
  bgSubtle: '#FAFAFA',      // Hintergründe für strukturierte Container
  white: '#FFFFFF',         // Hintergrundfarbe der Seite
};

/**
 * StyleSheet-Definitionen für das typografische Raster und Flexbox-Layout der PDF-Seite.
 */
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    lineHeight: 1.4,
    color: COLORS.textPrimary,
    paddingTop: 35,
    paddingBottom: 70,
    paddingHorizontal: 40,
    backgroundColor: COLORS.white,
  },

  /* ---------------- Header ---------------- */
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 32,
    objectFit: 'contain',
  },
  brandTextFallback: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  companyHeaderRight: {
    alignItems: 'flex-end',
  },
  companyNameHeader: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: COLORS.textPrimary,
  },
  companySubHeader: {
    fontSize: 7,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  /* ---------------- Briefkopf & Metadaten ---------------- */
  letterHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    minHeight: 85,
  },
  addressCol: {
    width: '55%',
  },
  senderSmall: {
    fontSize: 6.5,
    color: COLORS.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recipientName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  recipientLine: {
    fontSize: 7.5,
    color: COLORS.textPrimary,
    lineHeight: 1.3,
  },
  metaCol: {
    width: '40%',
    paddingLeft: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingBottom: 0,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.textMuted,
  },
  metaRowLast: {    
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingBottom: 0,
  },
  metaLabel: {
    fontSize: 7,
    color: COLORS.textSecondary,
  },
  metaValue: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.textPrimary,
  },

  /* ---------------- Anrede & Titel ---------------- */
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  introText: {
    fontSize: 7.5,
    color: COLORS.textSecondary,
    marginBottom: 14,
    lineHeight: 1.35,
  },

  /* ---------------- Positionstabelle ---------------- */
  table: {
    width: '100%',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDark,
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: COLORS.textPrimary,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  colPos: { width: '6%' },
  colDesc: { width: '50%' },
  colQty: { width: '14%', textAlign: 'right' },
  colPrice: { width: '15%', textAlign: 'right' },
  colTotal: { width: '15%', textAlign: 'right' },
  itemTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: COLORS.textPrimary,
  },
  itemSubtitle: {
    fontSize: 6.5,
    color: COLORS.textSecondary,
    marginTop: 1.5,
  },

  /* ---------------- Summenblock & Steuern ---------------- */
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  totalsTable: {
    width: '52%',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalsLabel: {
    fontSize: 7.5,
    color: COLORS.textSecondary,
  },
  totalsValue: {
    fontSize: 7.5,
    color: COLORS.textPrimary,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDark,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDark,
    marginTop: 4,
    paddingVertical: 4,
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: COLORS.textPrimary,
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: COLORS.primary,
  },

  /* ---------------- Zahlungsbedingungen ---------------- */
  paymentTerms: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
    paddingLeft: 8,
    marginVertical: 10,
  },
  paymentText: {
    fontSize: 7,
    color: COLORS.textSecondary,
    lineHeight: 1.35,
  },

  /* ---------------- Fußzeile ---------------- */
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 45,
    right: 45,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
    flexDirection: 'row',
  },
  footerColLeft: {
    width: '33.33%',
    alignItems: 'flex-start',
    textAlign: 'left',
  },
  footerColCenter: {
    width: '33.33%',
    alignItems: 'center',
    textAlign: 'center',
  },
  footerColRight: {
    width: '33.33%',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  footerHeading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  footerText: {
    fontSize: 6,
    color: COLORS.textSecondary,
    lineHeight: 1.25,
  },
  pageNumber: {
    fontSize: 6,
    color: COLORS.textMuted,
    marginTop: 3,
  },
});

/**
 * Formatiert einen numerischen Betrag oder String als österreichische/deutsche Währungsangabe (z. B. "1.234,50 €").
 *
 * @function
 * @param {number|string} val - Der zu formatierende Geldbetrag.
 * @returns {string} Formatierter Währungsstring inklusive Euro-Zeichen.
 */
const formatCurrency = (val) => {
  const num = typeof val === 'number' ? val : parseFloat(val) || 0;
  return num.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

/**
 * Wandelt ein Datum (als Date-Instanz, ISO-String oder deutsches Format) sicher in "DD.MM.YYYY" um.
 *
 * @function
 * @param {Date|string|null|undefined} dateVal - Der eingehende Datumswert.
 * @returns {string} Das formatierte Datum oder "-" bei ungültigem / fehlendem Wert.
 */
const formatDate = (dateVal) => {
  if (!dateVal) return '-';
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '-';
    const d = String(dateVal.getDate()).padStart(2, '0');
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const y = dateVal.getFullYear();
    return `${d}.${m}.${y}`;
  }
  const dateStr = String(dateVal);
  if (dateStr.includes('.')) return dateStr;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
  }
  return dateStr;
};

/**
 * @typedef {Object} Gast
 * @property {string} [name] - Vollständiger Name des Gastes.
 * @property {string} [vorname] - Vorname des Gastes.
 * @property {string} [nachname] - Nachname des Gastes.
 * @property {string} [anrede] - Anrede (z. B. "Herr", "Frau").
 * @property {string} [firma] - Optionaler Firmenname für Geschäftskunden.
 * @property {string} [strasse] - Straße der Anschrift.
 * @property {string} [hnr] - Hausnummer.
 * @property {string} [plz] - Postleitzahl.
 * @property {string} [stadt] - Wohnort / Ort.
 * @property {string} [land] - Herkunftsland.
 */

/**
 * @typedef {Object} Objekt
 * @property {number|string} [id] - Eindeutige ID des Objekts.
 * @property {string} [name] - Bezeichnung der gemieteten Einheit (z. B. "Wohnung 1", "Vito Bus").
 * @property {number} [preis] - Standardpreis pro Einheit.
 */

/**
 * @typedef {Object} Preisanpassung
 * @property {number|string} [id] - ID der Preisanpassung.
 * @property {number} alter_betrag - Betrag vor der Anpassung.
 * @property {number} neuer_betrag - Betrag nach der Anpassung.
 * @property {string} grund - Begründung der Anpassung (z. B. Endreinigung, Nachberechnung).
 * @property {string|Date} erstellt_am - Zeitstempel der Durchführung.
 */

/**
 * @typedef {Object} Buchung
 * @property {number|string} [id] - Vorgangs- bzw. Buchungs-ID.
 * @property {string} [anreise] - Anreisedatum (ISO oder DD.MM.YYYY).
 * @property {string} [abreise] - Abreisedatum (ISO oder DD.MM.YYYY).
 * @property {number} [preis] - Aktueller finaler Buchungsbetrag.
 * @property {number} [erwachsene] - Anzahl der erwachsenen Gäste.
 * @property {number} [kinder] - Anzahl der Kinder.
 * @property {Gast} [Gaeste] - Verknüpfte Gästedaten.
 * @property {Objekt} [Objekte] - Hauptobjekt der Buchung.
 * @property {Objekt} [ObjekteZusatz] - Optionales Zusatzobjekt (z. B. Kombi-Bus).
 * @property {Preisanpassung[]} [Preisanpassungen] - Liste dokumentierter Preisanpassungen.
 */

/**
 * @typedef {Object} Rechnung
 * @property {number|string} [id] - ID des Datensatzes.
 * @property {string} [rechnungs_nummer] - Belegnummer (z. B. "RE-2026-0001").
 * @property {string} [rechnungs_datum] - Datum der Belegausstellung.
 * @property {string} [faelligkeits_datum] - Optionales fixes Fälligkeitsdatum.
 * @property {Buchung} [Buchungen] - Zugehörige Buchungsrelation.
 */

/**
 * @typedef {Object} UnternehmensDaten
 * @property {string} name - Offizielle Firmenbezeichnung.
 * @property {string} strasse - Firmenadresse (Straße und Hausnummer).
 * @property {string} plzOrt - PLZ und Ort des Firmensitzes.
 * @property {string} land - Land des Firmensitzes.
 * @property {string} email - Kontakt-E-Mail-Adresse.
 * @property {string} telefon - Telefonnummer für Rückfragen.
 * @property {string} web - Offizielle Webadresse.
 * @property {string} iban - IBAN für Banküberweisungen.
 * @property {string} bic - BIC / SWIFT-Code des Kreditinstituts.
 * @property {string} bank - Name des kontoführenden Kreditinstituts.
 * @property {string} firmenbuch - Firmenbuchnummer und zuständiges Landesgericht.
 * @property {string} uid - Umsatzsteuer-Identifikationsnummer (UID/USt-IdNr.).
 */

/**
 * @typedef {Object} Einstellungen
 * @property {number} [ortstaxe] - Ortstaxe pro Person und Nacht in Euro (z. B. 2.0).
 * @property {number} [mwst_ortstaxe] - Steuersatz auf die Ortstaxe in Prozent (z. B. 0).
 * @property {number} [mwst_normal] - Regulärer Mehrwertsteuersatz in Prozent (z. B. 10).
 */

/**
 * @typedef {Object} RechnungDocumentProps
 * @property {Rechnung} [rechnung] - Rechnungsdatensatz aus der Datenbank.
 * @property {Buchung} [buchung] - Direkte Buchungsdaten (Fallback zu `rechnung.Buchungen`).
 * @property {Gast|null} [gast] - Gaststammdaten (Fallback zu `buchung.Gaeste`).
 * @property {Objekt|null} [objekt] - Stammdaten des Hauptobjekts (Fallback zu `buchung.Objekte`).
 * @property {string|null} [rechnungsNummer] - Explizite Belegnummer zur Überschreibung.
 * @property {string|null} [rechnungsDatum] - Explizites Belegdatum zur Überschreibung.
 * @property {string|null} [faelligkeitsDatum] - Explizites Fälligkeitsdatum zur Überschreibung.
 * @property {string|null} [logoSrc] - Base64-Data-URI oder Bild-URL des Firmenlogos.
 * @property {UnternehmensDaten} [unternehmensDaten] - Absender- und Unternehmensstammdaten.
 * @property {Einstellungen} [einstellungen] - Konfigurierte Steuersätze und Ortstaxenwerte.
 */

/**
 * RechnungDocument-Komponente.
 *
 * Erstellt ein standardisiertes PDF-Dokument („Information für die Buchhaltung“) auf A4-Basis.
 * Schreibt die Positionen, Preisanpassungen sowie Netto-Betrag, Mehrwertsteuer und Ortstaxe
 * übersichtlich auf.
 *
 * @component
 * @param {RechnungDocumentProps} props - Die Eigenschaften zur PDF-Generierung.
 * @returns {JSX.Element} Das gerenderte React-PDF Document-Element.
 */
export function RechnungDocument({
  rechnung = {},
  buchung = {},
  gast = null,
  objekt = null,
  rechnungsNummer = null,
  rechnungsDatum = null,
  faelligkeitsDatum = null,
  logoSrc = null,
  unternehmensDaten = {
    name: 'Beckhoff Automation GmbH',
    strasse: 'Hauptstraße 11',
    plzOrt: '6706 Bürs',
    land: 'Österreich',
    email: 'info@beckhoff.at',
    telefon: '+43 5552 68813-0',
    web: 'www.beckhoff.com/de-at/',
    iban: 'AT12 3456 7890 1234 5678',
    bic: 'BKAUATWW',
    bank: 'Sparkasse Feldkirch',
    firmenbuch: 'FN 222233p, LG Feldkirch',
    uid: 'ATU 54127804',
  },
  einstellungen = {},
}) {
  // Absicherung des Logos: Übergebene Quelle oder System-Base64-Fallback
  const finalLogo = logoSrc || getLogoBase64();

  // Relationale Datenstrukturen auflösen
  const currentBuchung = buchung || rechnung?.Buchungen || {};
  const currentGast = gast || currentBuchung?.Gaeste || {};
  const currentObjekt = objekt || currentBuchung?.Objekte || {};

  // Belegmetadaten bestimmen
  const rNr = rechnungsNummer || rechnung?.rechnungs_nummer || 'RE-2026-0001';
  const rDatum = rechnungsDatum || rechnung?.rechnungs_datum || currentBuchung?.abreise || new Date().toISOString().split('T')[0];

  /**
   * Berechnet das Fälligkeitsdatum (standardmäßig Belegdatum + 14 Tage).
   *
   * @function
   * @returns {string} Das formatierte Fälligkeitsdatum.
   */
  const calcFaelligkeit = () => {
    if (faelligkeitsDatum) return formatDate(faelligkeitsDatum);
    if (rechnung?.faelligkeits_datum) return formatDate(rechnung.faelligkeits_datum);
    let d;
    if (rDatum instanceof Date) {
      d = new Date(rDatum.getTime());
    } else if (typeof rDatum === 'string') {
      const parts = rDatum.includes('.') ? rDatum.split('.').reverse().join('-') : rDatum;
      d = new Date(parts);
    } else {
      d = new Date();
    }
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 14);
      return formatDate(d);
    }
    return '-';
  };

  const isWohnung = Boolean(currentObjekt?.name?.toLowerCase().includes('wohnung'));
  const gesamtpreis = Number(currentBuchung?.preis || 0);

  // Empfängerdaten zusammensetzen
  const gastName = currentGast?.name || `${currentGast?.vorname || ''} ${currentGast?.nachname || ''}`.trim() || 'Gast';
  const gastAdresse = currentGast?.strasse ? `${currentGast.strasse} ${currentGast.hnr || ''}`.trim() : 'Musterstraße 1';
  const gastOrt = `${currentGast?.plz || '6700'} ${currentGast?.stadt || 'Bludenz'}`;

  // Preisanpassungshistorie chronologisch aufsteigend sortieren
  const rawHistorie = currentBuchung?.Preisanpassungen || currentBuchung?.preisanpassungen || rechnung?.Preisanpassungen || rechnung?.preisanpassungen || [];
  const preisHistorie = Array.isArray(rawHistorie)
    ? [...rawHistorie].sort((a, b) => new Date(a.erstellt_am || 0) - new Date(b.erstellt_am || 0))
    : [];

  // Ursprungspreis vor allen nachträglichen Preisanpassungen bestimmen
  const urspruenglicherPreis = preisHistorie.length > 0 ? Number(preisHistorie[0].alter_betrag || 0) : gesamtpreis;

  // Dynamischer Aufbau aller Leistungspositionszeilen
  let pos = 1;
  const tableRows = [];

  // 1. Hauptleistungsposition
  tableRows.push(
    h(
      View,
      { key: 'pos-main', style: styles.tableRow },
      h(Text, { style: styles.colPos }, String(pos++)),
      h(
        View,
        { style: styles.colDesc },
        h(Text, { style: styles.itemTitle }, currentObjekt?.name || 'Aufenthalt'),
        h(
          Text,
          { style: styles.itemSubtitle },
          `Zeitraum: ${formatDate(currentBuchung?.anreise)} bis ${formatDate(currentBuchung?.abreise)}`
        )
      ),
      h(Text, { style: styles.colQty }, isWohnung ? 'Pauschal' : 'Std.'),
      h(Text, { style: styles.colPrice }, formatCurrency(urspruenglicherPreis)),
      h(Text, { style: styles.colTotal }, formatCurrency(urspruenglicherPreis))
    )
  );

  // 2. Optionale Zusatzleistung (z. B. mitgebuchter Bus bei Kombibuchung)
  if (currentBuchung?.ObjekteZusatz) {
    tableRows.push(
      h(
        View,
        { key: 'pos-zusatz', style: styles.tableRow },
        h(Text, { style: styles.colPos }, String(pos++)),
        h(
          View,
          { style: styles.colDesc },
          h(Text, { style: styles.itemTitle }, `Zusatzleistung: ${currentBuchung.ObjekteZusatz.name}`),
          h(Text, { style: styles.itemSubtitle }, 'Nutzung im selben Zeitraum (Kombibuchung)')
        ),
        h(Text, { style: styles.colQty }, 'Pauschal'),
        h(Text, { style: styles.colPrice }, 'Inklusive'),
        h(Text, { style: styles.colTotal }, 'Inklusive')
      )
    );
  }

  // 3. Preisanpassungen als eigene Rechnungspostenzeilen
  preisHistorie.forEach((item, idx) => {
    const diff = (Number(item.neuer_betrag) || 0) - (Number(item.alter_betrag) || 0);
    const formattedDiff = diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff);

    tableRows.push(
      h(
        View,
        { key: `pos-adj-${item.id || idx}`, style: styles.tableRow },
        h(Text, { style: styles.colPos }, String(pos++)),
        h(
          View,
          { style: styles.colDesc },
          h(Text, { style: styles.itemTitle }, `Preisanpassung: ${item.grund || 'Korrektur'}`),
          h(
            Text,
            { style: styles.itemSubtitle },
            `vom ${formatDate(item.erstellt_am)} (von ${formatCurrency(item.alter_betrag)} auf ${formatCurrency(item.neuer_betrag)})`
          )
        ),
        h(Text, { style: styles.colQty }, 'Pauschal'),
        h(Text, { style: styles.colPrice }, formattedDiff),
        h(Text, { style: styles.colTotal }, formattedDiff)
      )
    );
  });

  return h(
    Document,
    { title: `Information_fuer_die_Buchhaltung_${rNr}` },
    h(
      Page,
      { size: 'A4', style: styles.page },

      // ===================================================================
      // 1. KOPFBEREICH: Firmenlogo & Kurzangaben
      // ===================================================================
      h(
        View,
        { style: styles.headerRow },
        finalLogo
          ? h(Image, { src: finalLogo, style: styles.logo })
          : h(Text, { style: styles.brandTextFallback }, 'BECKHOFF'),
        h(
          View,
          { style: styles.companyHeaderRight },
          h(Text, { style: styles.companyNameHeader }, unternehmensDaten.name),
          h(Text, { style: styles.companySubHeader }, `${unternehmensDaten.strasse} • ${unternehmensDaten.plzOrt}`)
        )
      ),

      // ===================================================================
      // 2. BRIEFFENSTER & METADATEN-CONTAINER
      // ===================================================================
      h(
        View,
        { style: styles.letterHeadRow },
        h(
          View,
          { style: styles.addressCol },
          currentGast?.firma ? h(Text, { style: [styles.recipientLine, { fontFamily: 'Helvetica-Bold' }] }, currentGast.firma) : null,
          h(Text, { style: styles.recipientName }, `${currentGast?.anrede ? `${currentGast.anrede} ` : ''}${gastName}`),
          h(Text, { style: styles.recipientLine }, gastAdresse),
          h(Text, { style: styles.recipientLine }, gastOrt),
          currentGast?.land && currentGast.land !== 'Österreich' ? h(Text, { style: styles.recipientLine }, currentGast.land) : null
        ),
        h(
          View,
          { style: styles.metaCol },
          h(
            View,
            { style: styles.metaRow },
            h(Text, { style: styles.metaLabel }, 'Datum:'),
            h(Text, { style: styles.metaValue }, formatDate(rDatum))
          ),
          h(
            View,
            { style: styles.metaRow },
            h(Text, { style: styles.metaLabel }, 'Fälligkeitsdatum:'),
            h(Text, { style: styles.metaValue }, calcFaelligkeit())
          ),
          h(
            View,
            { style: styles.metaRow },
            h(Text, { style: styles.metaLabel }, 'Beleg-Nr.:'),
            h(Text, { style: [styles.metaValue, { color: COLORS.primary }] }, rNr)
          ),
          h(
            View,
            { style: styles.metaRowLast },
            h(Text, { style: styles.metaLabel }, 'Buchungs-ID:'),
            h(Text, { style: styles.metaValue }, `#${currentBuchung?.id || '-'}`)
          )
        )
      ),

      // ===================================================================
      // 3. ANREDE & DOKUMENTENTITEL
      // ===================================================================
      h(Text, { style: styles.docTitle }, `Information für die Buchhaltung ${rNr}`),
      h(
        Text,
        { style: styles.introText },
        "Diese Aufstellung dient als Information für Ihre Buchhaltung:"
      ),

      // ===================================================================
      // 4. POSITIONSTABELLE (HAUPT-, ZUSATZLEISTUNGEN & PREISANPASSUNGEN)
      // ===================================================================
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: styles.tableHeader },
          h(Text, { style: [styles.th, styles.colPos] }, 'Pos.'),
          h(Text, { style: [styles.th, styles.colDesc] }, 'Bezeichnung / Zeitraum'),
          h(Text, { style: [styles.th, styles.colQty] }, 'Einheit'),
          h(Text, { style: [styles.th, styles.colPrice] }, 'Einzelpreis'),
          h(Text, { style: [styles.th, styles.colTotal] }, 'Gesamtpreis')
        ),
        ...tableRows
      ),

      // ===================================================================
      // 5. SUMMEN & STEUERAUFSCHLÜSSELUNG (ORTSTAXE ZUSÄTZLICH)
      // ===================================================================
      (() => {
        const oSatz = typeof einstellungen?.ortstaxe === 'number' ? einstellungen.ortstaxe : parseFloat(einstellungen?.ortstaxe) || 0;
        const mSatz = typeof einstellungen?.mwst_normal === 'number' ? einstellungen.mwst_normal : parseFloat(einstellungen?.mwst_normal) || 0;
        const moSatz = typeof einstellungen?.mwst_ortstaxe === 'number' ? einstellungen.mwst_ortstaxe : parseFloat(einstellungen?.mwst_ortstaxe) || 0;

        const startIso = currentBuchung?.anreise?.includes('.') ? currentBuchung.anreise.split('.').reverse().join('-') : currentBuchung?.anreise;
        const endIso = currentBuchung?.abreise?.includes('.') ? currentBuchung.abreise.split('.').reverse().join('-') : currentBuchung?.abreise;
        const an = new Date(startIso);
        const ab = new Date(endIso);
        
        const naechte = (!isNaN(an.getTime()) && !isNaN(ab.getTime())) ? Math.max(1, Math.ceil(Math.abs(ab - an) / 86400000)) : 1;
        
        // Ortstaxe nur für Erwachsene (ab 14 Jahre)
        const erwachsene = Number(currentBuchung?.erwachsene) || (currentBuchung?.erwachsene === 0 ? 0 : 1);
        const ortstaxeGesamt = isWohnung ? (erwachsene * naechte * oSatz) : 0;
        
        // Buchungspreis ist regulärer Brutto-Preis -> MwSt. herausrechnen
        const nettoLeistung = gesamtpreis / (1 + (mSatz / 100));
        const mwstLeistung = gesamtpreis - nettoLeistung;

        // MwSt. auf Ortstaxe (falls Satz > 0)
        const mwstOrtstaxe = moSatz > 0 ? ortstaxeGesamt - (ortstaxeGesamt / (1 + (moSatz / 100))) : 0;

        // Endbetrag = Buchungspreis (brutto) + Ortstaxe
        const gesamtZahlbetrag = gesamtpreis + ortstaxeGesamt;

        return h(
          View,
          { style: styles.totalsSection, wrap: false },
          h(
            View,
            { style: styles.totalsTable },
            h(
              View,
              { style: styles.totalsRow },
              h(Text, { style: styles.totalsLabel }, 'Netto-Leistung:'),
              h(Text, { style: styles.totalsValue }, formatCurrency(nettoLeistung))
            ),
            h(
              View,
              { style: styles.totalsRow },
              h(Text, { style: styles.totalsLabel }, `Zzgl. ${mSatz}% MwSt.:`),
              h(Text, { style: styles.totalsValue }, formatCurrency(mwstLeistung))
            ),
            h(
              View,
              { style: styles.totalsRow },
              h(Text, { style: styles.totalsLabel }, 'Zwischensumme Aufenthalt:'),
              h(Text, { style: styles.totalsValue }, formatCurrency(gesamtpreis))
            ),
            isWohnung && ortstaxeGesamt > 0
              ? h(
                  View,
                  { style: styles.totalsRow },
                  h(Text, { style: styles.totalsLabel }, `Ortstaxe (${erwachsene} Erw. ab 14 J., ${formatCurrency(oSatz)}/Nacht):`),
                  h(Text, { style: styles.totalsValue }, formatCurrency(ortstaxeGesamt))
                )
              : null,
            isWohnung && moSatz > 0 && ortstaxeGesamt > 0
              ? h(
                  View,
                  { style: styles.totalsRow },
                  h(Text, { style: styles.totalsLabel }, `Darin enth. ${moSatz}% MwSt. auf Ortstaxe:`),
                  h(Text, { style: styles.totalsValue }, formatCurrency(mwstOrtstaxe))
                )
              : null,
            h(
              View,
              { style: styles.grandTotalRow },
              h(Text, { style: styles.grandTotalLabel }, 'Gesamtbetrag:'),
              h(Text, { style: styles.grandTotalValue }, formatCurrency(gesamtZahlbetrag))
            )
          )
        );
      })(),

      // ===================================================================
      // 6. ZAHLUNGSTEXT
      // ===================================================================
      (() => {
        const oSatz = typeof einstellungen?.ortstaxe === 'number' ? einstellungen.ortstaxe : parseFloat(einstellungen?.ortstaxe) || 0;
        const startIso = currentBuchung?.anreise?.includes('.') ? currentBuchung.anreise.split('.').reverse().join('-') : currentBuchung?.anreise;
        const endIso = currentBuchung?.abreise?.includes('.') ? currentBuchung.abreise.split('.').reverse().join('-') : currentBuchung?.abreise;
        const an = new Date(startIso);
        const ab = new Date(endIso);
        const naechte = (!isNaN(an.getTime()) && !isNaN(ab.getTime())) ? Math.max(1, Math.ceil(Math.abs(ab - an) / 86400000)) : 1;
        const erwachsene = Number(currentBuchung?.erwachsene) || (currentBuchung?.erwachsene === 0 ? 0 : 1);
        const ortstaxeGesamt = isWohnung ? (erwachsene * naechte * oSatz) : 0;
        const gesamtZahlbetrag = gesamtpreis + ortstaxeGesamt;

        return h(
          View,
          { style: styles.paymentTerms, wrap: false },
          h(
            Text,
            { style: styles.paymentText },
            `Bitte überweisen Sie den Gesamtbetrag von ${formatCurrency(gesamtZahlbetrag)} bis zum ${calcFaelligkeit()} ` +
            `unter Angabe der Belegnummer ${rNr} auf unser unten angegebenes Bankkonto.`
          )
        );
      })(),

      // ===================================================================
      // 7. FUSSZEILE (DREISPALTIG AUSGERICHTET)
      // ===================================================================
      h(
        View,
        { style: styles.footer },
        h(
          View,
          { style: styles.footerColLeft },
          h(Text, { style: styles.footerHeading }, unternehmensDaten.name),
          h(Text, { style: styles.footerText }, unternehmensDaten.strasse),
          h(Text, { style: styles.footerText }, `${unternehmensDaten.plzOrt}, ${unternehmensDaten.land}`)
        ),
        h(
          View,
          { style: styles.footerColCenter },
          h(Text, { style: styles.footerHeading }, 'Bankverbindung'),
          h(Text, { style: styles.footerText }, `Institut: ${unternehmensDaten.bank}`),
          h(Text, { style: styles.footerText }, `IBAN: ${unternehmensDaten.iban}`),
          h(Text, { style: styles.footerText }, `BIC: ${unternehmensDaten.bic}`)
        ),
        h(
          View,
          { style: styles.footerColRight },
          h(Text, { style: styles.footerHeading }, 'Firmendaten'),
          h(Text, { style: styles.footerText }, `E-Mail: ${unternehmensDaten.email}`),
          h(Text, { style: styles.footerText }, unternehmensDaten.firmenbuch),
          h(Text, { style: styles.footerText }, `UID: ${unternehmensDaten.uid}`)
        )
      )
    )
  );
}

export default RechnungDocument;