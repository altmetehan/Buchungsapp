import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { getLogoBase64 } from '../utils/pdfUtils.js';

/**
 * @file BuchungsBestaetigungDocument.js
 * @description PDF-Vorlage für verbindliche Buchungsbestätigungen im CI-konformen Unternehmensdesign (Beckhoff Automation).
 *              Generiert über `@react-pdf/renderer` eine druckreife A4-Bestätigung mit
 *              dynamischer Unterscheidung zwischen Ferienwohnungen und stundenbasierten Fahrzeugen/Bussen
 *              (Check-in/Check-out vs. Abholung/Rückgabe), Leistungstabelle, Nutzungs- und
 *              Schlüsselübergabe-Hinweisen sowie standardisiertem Absender- und dreispaltigem Fußzeilenbereich.
 * @module pdf/BuchungsBestaetigungDocument
 */

/**
 * Alias für React.createElement zur lesbaren und performanten Baumkonstruktion im Backend.
 * @type {Function}
 */
const h = React.createElement;

/**
 * Farbpalette für das PDF-Dokumentenlayout (Beckhoff-Design).
 * @constant
 * @type {Object.<string, string>}
 */
const COLORS = {
  primary: '#E30000',       // Beckhoff Rot (Akzentfarbe)
  textPrimary: '#18181B',   // Tiefes Anthrazit für Überschriften und Haupttext
  textSecondary: '#52525B', // Neutrales Dunkelgrau für Beschreibungen und Fließtext
  textMuted: '#8E8E93',     // Dezent für Metadaten und Hilfslinien
  borderLight: '#E4E4E7',   // Helle Trennlinien
  borderDark: '#27272A',    // Dunkle Akzenttrennlinien (Tabellenkopf / Summenbereich)
  white: '#FFFFFF',         // Hintergrundfarbe
};

/**
 * StyleSheet-Definitionen für das typografische Raster und Flexbox-Layout der PDF-Seite.
 */
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    lineHeight: 1.5,
    color: COLORS.textPrimary,
    paddingTop: 40,
    paddingBottom: 85,
    paddingHorizontal: 45,
    backgroundColor: COLORS.white,
  },

  /* ---------------- Header ---------------- */
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 140,
    height: 38,
    objectFit: 'contain',
  },
  brandTextFallback: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  companyHeaderRight: {
    alignItems: 'flex-end',
  },
  companyNameHeader: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLORS.textPrimary,
  },
  companySubHeader: {
    fontSize: 8,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  /* ---------------- Briefkopf & Metadaten ---------------- */
  letterHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    minHeight: 105,
  },
  addressCol: {
    width: '55%',
  },
  senderSmall: {
    fontSize: 7.5,
    color: COLORS.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recipientName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  recipientLine: {
    fontSize: 9.5,
    color: COLORS.textPrimary,
    lineHeight: 1.35,
  },
  metaCol: {
    width: '40%',
    paddingLeft: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    paddingBottom: 0,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.textMuted,
  },
  metaRowLast: {    
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    paddingBottom: 0,
  },
  metaLabel: {
    fontSize: 8.5,
    color: COLORS.textSecondary,
  },
  metaValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.textPrimary,
  },

  /* ---------------- Anrede & Titel ---------------- */
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  introText: {
    fontSize: 9.5,
    color: COLORS.textSecondary,
    marginBottom: 18,
    lineHeight: 1.4,
  },

  /* ---------------- Leistungstabelle ---------------- */
  table: {
    width: '100%',
    marginBottom: 18,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDark,
    paddingBottom: 6,
    paddingHorizontal: 2,
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: COLORS.textPrimary,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
    paddingVertical: 9,
    paddingHorizontal: 2,
  },
  colObj: { width: '45%' },
  colZeit: { width: '35%' },
  colPrice: { width: '20%', textAlign: 'right' },
  itemTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: COLORS.textPrimary,
  },
  itemSubtitle: {
    fontSize: 8,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  /* ---------------- Summenzeile ---------------- */
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDark,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDark,
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 22,
  },
  totalLineLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLORS.textPrimary,
  },
  totalLineValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    color: COLORS.primary,
  },

  /* ---------------- Hinweise & Bulletpoints ---------------- */
  detailsHeading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLORS.textPrimary,
    marginBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
    paddingBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 14,
    color: COLORS.primary,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  bulletContent: {
    flex: 1,
  },
  bulletTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: COLORS.textPrimary,
  },
  bulletText: {
    fontSize: 8.5,
    color: COLORS.textSecondary,
    lineHeight: 1.35,
    marginTop: 1,
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
    fontSize: 7.5,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  footerText: {
    fontSize: 7,
    color: COLORS.textSecondary,
    lineHeight: 1.35,
  },
  pageNumber: {
    fontSize: 7,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});

/**
 * Formatiert einen numerischen Betrag als österreichische/deutsche Währungsangabe (z. B. "1.234,50 €").
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
 * @property {string} [strasse] - Straße der Anschrift.
 * @property {string} [hnr] - Hausnummer.
 * @property {string} [plz] - Postleitzahl.
 * @property {string} [stadt] - Wohnort / Stadt.
 * @property {string} [land] - Herkunftsland.
 */

/**
 * @typedef {Object} Objekt
 * @property {number|string} [id] - Eindeutige ID des Objekts.
 * @property {string} [name] - Bezeichnung der Einheit (z. B. "Wohnung 1", "Vito Bus").
 * @property {number} [preis] - Regulärer Preis pro Einheit.
 */

/**
 * @typedef {Object} Buchung
 * @property {number|string} [id] - Buchungsnummer / Referenz-ID.
 * @property {string} [anreise] - Anreisedatum (ISO oder DD.MM.YYYY).
 * @property {string} [abreise] - Abreisedatum (ISO oder DD.MM.YYYY).
 * @property {string} [anreise_zeit] - Beginn-Uhrzeit (HH:MM).
 * @property {string} [abreise_zeit] - Ende-Uhrzeit (HH:MM).
 * @property {number} [erwachsene] - Anzahl der Erwachsenen.
 * @property {number} [kinder] - Anzahl der Kinder.
 * @property {number} [preis] - Gesamtpreis der Buchung.
 * @property {string|Date} [erstellt_am] - Erstellungszeitpunkt der Buchung.
 * @property {Gast} [Gaeste] - Zugehörige Gästedaten.
 * @property {Objekt} [Objekte] - Hauptobjekt der Buchung.
 * @property {Objekt} [ObjekteZusatz] - Optionales Zusatzobjekt (z. B. Kombi-Bus).
 */

/**
 * @typedef {Object} UnternehmensDaten
 * @property {string} name - Firmenname.
 * @property {string} strasse - Firmenadresse.
 * @property {string} plzOrt - PLZ und Ort.
 * @property {string} land - Land.
 * @property {string} email - Kontakt-E-Mail.
 * @property {string} telefon - Telefonnummer.
 * @property {string} web - Website-URL.
 * @property {string} firmenbuch - Firmenbuchnummer und Gerichtsstand.
 * @property {string} uid - UID-Nummer.
 * @property {string} [wlanSsid] - Name des Gäste-WLANs.
 * @property {string} [wlanPw] - Passwort für das Gäste-WLAN.
 */

/**
 * @typedef {Object} BuchungsbestaetigungDocumentProps
 * @property {Buchung} [buchung] - Buchungsdatensatz inklusive Relationen.
 * @property {Gast|null} [gast] - Gaststammdaten (Fallback zu `buchung.Gaeste`).
 * @property {Objekt|null} [objekt] - Objektstammdaten (Fallback zu `buchung.Objekte`).
 * @property {string|null} [logoSrc] - Base64-String oder Pfad zum Logo.
 * @property {UnternehmensDaten} [unternehmensDaten] - Absender- und Standortinformationen.
 */

/**
 * BuchungsbestaetigungDocument-Komponente.
 *
 * Rendert das PDF-Dokument für Buchungsbestätigungen mit automatischer
 * Erkennung des Buchungstyps (Wohnungsaufenthalt vs. Fahrzeugmiete).
 *
 * @component
 * @param {BuchungsbestaetigungDocumentProps} props - Komponenten-Properties.
 * @returns {JSX.Element} Das gerenderte React-PDF Document-Element.
 */
export function BuchungsbestaetigungDocument({
  buchung = {},
  gast = null,
  objekt = null,
  logoSrc = null,
  unternehmensDaten = {
    name: 'Beckhoff Automation GmbH',
    strasse: 'Hauptstraße 11',
    plzOrt: '6706 Bürs',
    land: 'Österreich',
    email: 'info@beckhoff.at',
    telefon: '+43 5552 68813-0',
    web: 'www.beckhoff.com/de-at/',
    firmenbuch: 'FN 222233p, LG Feldkirch',
    uid: 'ATU 54127804',
    wlanSsid: 'Beckhoff_Gast',
    wlanPw: 'Willkommen2026',
  },
}) {
  const finalLogo = logoSrc || getLogoBase64();
  const currentGast = gast || buchung?.Gaeste || {};
  const currentObjekt = objekt || buchung?.Objekte || {};
  const isWohnung = Boolean(currentObjekt?.name?.toLowerCase().includes('wohnung'));

  const buchungId = buchung?.id || '000';
  const buchungsDatum = buchung?.erstellt_am || buchung?.anreise || new Date();

  const checkinUhrzeit = buchung?.anreise_zeit || (isWohnung ? '15:00' : '09:00');
  const checkoutUhrzeit = buchung?.abreise_zeit || (isWohnung ? '11:00' : '17:00');

  const gastName = currentGast?.name || `${currentGast?.vorname || ''} ${currentGast?.nachname || ''}`.trim() || 'Gast';
  const gastAdresse = currentGast?.strasse ? `${currentGast.strasse} ${currentGast.hnr || ''}`.trim() : 'Musterstraße 1';
  const gastOrt = `${currentGast?.plz || '6700'} ${currentGast?.stadt || 'Bludenz'}`;

  const personenGesamt =
    (buchung?.erwachsene || 0) + (buchung?.kinder || 0) > 0
      ? (buchung?.erwachsene || 0) + (buchung?.kinder || 0)
      : 1;

  const zeitenText = isWohnung
    ? `Check-in: ab ${checkinUhrzeit} Uhr | Check-out: bis ${checkoutUhrzeit} Uhr`
    : `Abholung: ab ${checkinUhrzeit} Uhr | Rückgabe: bis ${checkoutUhrzeit} Uhr`;

  return h(
    Document,
    { title: `Buchungsbestaetigung_${buchungId}` },
    h(
      Page,
      { size: 'A4', style: styles.page },

      // ===================================================================
      // 1. KOPFBEREICH: Firmenlogo & Absender-Kurzangaben
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
          h(Text, { style: styles.senderSmall }, `${unternehmensDaten.name} • ${unternehmensDaten.plzOrt}`),
          h(Text, { style: styles.recipientName }, gastName),
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
            h(Text, { style: styles.metaValue }, formatDate(buchungsDatum))
          ),
          h(
            View,
            { style: styles.metaRow },
            h(Text, { style: styles.metaLabel }, 'Buchungs-Nr.:'),
            h(Text, { style: [styles.metaValue, { color: COLORS.primary }] }, `#${buchungId}`)
          ),
          h(
            View,
            { style: styles.metaRow },
            h(Text, { style: styles.metaLabel }, 'Status:'),
            h(Text, { style: styles.metaValue }, 'Bestätigt')
          ),
          h(
            View,
            { style: styles.metaRowLast },
            h(Text, { style: styles.metaLabel }, isWohnung ? 'Personen:' : 'Fahrgäste:'),
            h(Text, { style: styles.metaValue }, `${personenGesamt} Person(en)`)
          )
        )
      ),

      // ===================================================================
      // 3. ANREDE & DOKUMENTENTITEL
      // ===================================================================
      h(Text, { style: styles.docTitle }, `Buchungsbestätigung #${buchungId}`),
      h(
        Text,
        { style: styles.introText },
        `Sehr geehrte(r) ${gastName},\n` +
        'wir freuen uns über Ihre Reservierung und bestätigen Ihre gebuchte Nutzung verbindlich mit folgenden Daten:'
      ),

      // ===================================================================
      // 4. LEISTUNGSTABELLE
      // ===================================================================
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: styles.tableHeader },
          h(Text, { style: [styles.th, styles.colObj] }, 'Gebuchtes Objekt'),
          h(Text, { style: [styles.th, styles.colZeit] }, 'Zeitraum / Uhrzeiten'),
          h(Text, { style: [styles.th, styles.colPrice] }, 'Vereinbarter Preis')
        ),
        h(
          View,
          { style: styles.tableRow },
          h(
            View,
            { style: styles.colObj },
            h(Text, { style: styles.itemTitle }, currentObjekt?.name || 'Objekt'),
            h(Text, { style: styles.itemSubtitle }, isWohnung ? 'Ferienwohnung' : 'Fahrzeug / Bus')
          ),
          h(
            View,
            { style: styles.colZeit },
            h(
              Text,
              { style: { fontFamily: 'Helvetica-Bold', fontSize: 9 } },
              `${formatDate(buchung?.anreise)} – ${formatDate(buchung?.abreise)}`
            ),
            h(Text, { style: styles.itemSubtitle }, zeitenText)
          ),
          h(Text, { style: styles.colPrice }, formatCurrency(buchung?.preis || 0))
        ),
        buchung?.ObjekteZusatz
          ? h(
              View,
              { style: styles.tableRow },
              h(
                View,
                { style: styles.colObj },
                h(Text, { style: styles.itemTitle }, `Zusatzoption: ${buchung.ObjekteZusatz.name}`),
                h(Text, { style: styles.itemSubtitle }, 'Im selben Zeitraum gebucht (Kombibuchung)')
              ),
              h(View, { style: styles.colZeit }, h(Text, { style: styles.itemSubtitle }, 'Inklusive / Kombirabatt')),
              h(Text, { style: styles.colPrice }, 'Inklusive')
            )
          : null
      ),

      // ===================================================================
      // 5. GESAMTBETRAG
      // ===================================================================
      h(
        View,
        { style: styles.totalLine },
        h(Text, { style: styles.totalLineLabel }, 'Gesamtbetrag der Buchung:'),
        h(Text, { style: styles.totalLineValue }, formatCurrency(buchung?.preis || 0))
      ),

      // ===================================================================
      // 6. HINWEISE & ANWEISUNGEN (DYNAMISCH NACH OBJEKTTYP)
      // ===================================================================
      h(
        View,
        { wrap: false },
        h(
          Text,
          { style: styles.detailsHeading },
          isWohnung ? 'Informationen für Ihren Aufenthalt' : 'Informationen zur Fahrzeugnutzung'
        ),

        // Punkt 1: Schlüsselübergabe / Fahrzeugübernahme
        h(
          View,
          { style: styles.bulletRow },
          h(Text, { style: styles.bulletDot }, '•'),
          h(
            View,
            { style: styles.bulletContent },
            h(
              Text,
              { style: styles.bulletTitle },
              isWohnung ? 'Anreise & Schlüsselübergabe' : 'Fahrzeugübernahme & Schlüssel'
            ),
            h(
              Text,
              { style: styles.bulletText },
              isWohnung
                ? `Der Check-in ist ab ${checkinUhrzeit} Uhr möglich. Der Schlüsselzugang erfolgt kontaktlos über die Schlüsselbox am Haupteingang. Den aktuellen PIN-Code erhalten Sie vor Ihrer Anreise per E-Mail.`
                : `Die Abholung ist ab ${checkinUhrzeit} Uhr möglich. Bitte halten Sie bei der Übernahme einen gültigen Führerschein bereit. Der Fahrzeugschlüssel wird am Empfang ausgehändigt.`
            )
          )
        ),

        // Punkt 2: Internet / Tankregelung
        h(
          View,
          { style: styles.bulletRow },
          h(Text, { style: styles.bulletDot }, '•'),
          h(
            View,
            { style: styles.bulletContent },
            h(
              Text,
              { style: styles.bulletTitle },
              isWohnung ? 'WLAN & Internet' : 'Tankregelung & Nutzung'
            ),
            h(
              Text,
              { style: styles.bulletText },
              isWohnung
                ? `Kostenfreies WLAN: Netzwerk "${unternehmensDaten.wlanSsid}", Passwort "${unternehmensDaten.wlanPw}".`
                : 'Das Fahrzeug wird vollgetankt übergeben und ist vor der Rückgabe wieder vollzutanken. Im Fahrzeug gilt striktes Rauchverbot.'
            )
          )
        ),

        // Punkt 3: Hausordnung / Rückgabebedingungen
        h(
          View,
          { style: styles.bulletRow },
          h(Text, { style: styles.bulletDot }, '•'),
          h(
            View,
            { style: styles.bulletContent },
            h(
              Text,
              { style: styles.bulletTitle },
              isWohnung ? 'Abreise & Hausordnung' : 'Rückgabe & Abstellung'
            ),
            h(
              Text,
              { style: styles.bulletText },
              isWohnung
                ? `Bitte geben Sie die Wohnung am Abreisetag bis spätestens ${checkoutUhrzeit} Uhr frei. Im gesamten Gebäude gilt Rauchverbot sowie Nachtruhe ab 22:00 Uhr.`
                : `Bitte stellen Sie das Fahrzeug bis spätestens ${checkoutUhrzeit} Uhr auf dem vorgesehenen Firmenparkplatz ab und deponieren Sie den Schlüssel in der Rückgabebox.`
            )
          )
        )
      ),

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
          h(Text, { style: styles.footerHeading }, 'Kontakt & Support'),
          h(Text, { style: styles.footerText }, `Telefon: ${unternehmensDaten.telefon}`),
          h(Text, { style: styles.footerText }, `E-Mail: ${unternehmensDaten.email}`),
          h(Text, { style: styles.footerText }, unternehmensDaten.web)
        ),
        h(
          View,
          { style: styles.footerColRight },
          h(Text, { style: styles.footerHeading }, 'Firmendaten'),
          h(Text, { style: styles.footerText }, unternehmensDaten.firmenbuch),
          h(Text, { style: styles.footerText }, `UID: ${unternehmensDaten.uid}`)
        )
      )
    )
  );
}

// Aliase für benannte Imports zur Vermeidung von Namenskonflikten
export const BuchungsBestaetigungDocument = BuchungsbestaetigungDocument;
export default BuchungsbestaetigungDocument;