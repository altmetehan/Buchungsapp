import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getLogoBase64() {
  const possiblePaths = [
    path.join(__dirname, '../assets/logorot.jpg'),
    path.join(__dirname, '../assets/logorot.png'),
    path.join(__dirname, '../../assets/logorot.jpg'),
    path.join(process.cwd(), 'src/assets/logorot.jpg'),
    path.join(process.cwd(), 'assets/logorot.jpg'),
    path.join(__dirname, '../../../frontend/src/assets/logorot.jpg'),
    path.join(__dirname, '../assets/logoschwarz.png'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const ext = path.extname(p).toLowerCase() === '.png' ? 'png' : 'jpeg';
        const fileBuffer = fs.readFileSync(p);
        return `data:image/${ext};base64,${fileBuffer.toString('base64')}`;
      } catch (err) {
        console.error(`[PDF] Fehler beim Lesen von ${p}:`, err);
      }
    }
  }
  return null;
}

const h = React.createElement;

const COLORS = {
  primary: '#E30000',       // Beckhoff Rot
  textPrimary: '#18181B',   // Tiefes Anthrazit
  textSecondary: '#52525B', // Neutrales Dunkelgrau
  textMuted: '#8E8E93',     // Dezent für Meta/Linien
  borderLight: '#E4E4E7',
  borderDark: '#27272A',
  white: '#FFFFFF',
};

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


  footer: {
    position: 'absolute',
    bottom: 25,
    left: 45,
    right: 45,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerColLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  footerColCenter: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 60,
  },
  footerColRight: {
    flex: 1,
    paddingLeft: 60,
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

const formatCurrency = (val) => {
  const num = typeof val === 'number' ? val : parseFloat(val) || 0;
  return num.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  if (dateStr.includes('.')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
};

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
  const buchungsDatum = buchung?.erstellt_am || new Date().toISOString().split('T')[0];

  const checkinUhrzeit = buchung?.anreise_zeit || '15:00';
  const checkoutUhrzeit = buchung?.abreise_zeit || '11:00';

  const gastName = currentGast?.name || `${currentGast?.vorname || ''} ${currentGast?.nachname || ''}`.trim() || 'Gast';
  const gastAdresse = currentGast?.strasse ? `${currentGast.strasse} ${currentGast.hnr || ''}`.trim() : 'Musterstraße 1';
  const gastOrt = `${currentGast?.plz || '6700'} ${currentGast?.stadt || 'Bludenz'}`;

  const personenGesamt =
    (buchung?.erwachsene || 0) + (buchung?.kinder || 0) > 0
      ? (buchung?.erwachsene || 0) + (buchung?.kinder || 0)
      : 1;

  return h(
    Document,
    { title: `Buchungsbestaetigung_${buchungId}` },
    h(
      Page,
      { size: 'A4', style: styles.page },

      // 1. HEADER
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

      // 2. BRIEFFENSTER
      h(
        View,
        { style: styles.letterHeadRow },
        h(
          View,
          { style: styles.addressCol },
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
            h(Text, { style: styles.metaLabel }, 'Personen:'),
            h(Text, { style: styles.metaValue }, `${personenGesamt} Gast/Gäste`)
          )
        )
      ),

      // 3. ANREDE
      h(Text, { style: styles.docTitle }, `Buchungsbestätigung #${buchungId}`),
      h(
        Text,
        { style: styles.introText },
        `Sehr geehrte(r) ${gastName},\n` +
        'wir freuen uns über Ihre Reservierung und bestätigen Ihren gebuchten Aufenthalt verbindlich mit folgenden Daten:'
      ),

      // 4. LEISTUNGSTABELLE
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: styles.tableHeader },
          h(Text, { style: [styles.th, styles.colObj] }, 'Gebuchtes Objekt'),
          h(Text, { style: [styles.th, styles.colZeit] }, 'Zeitraum / Zeiten'),
          h(Text, { style: [styles.th, styles.colPrice] }, 'Vereinbarter Preis')
        ),
        h(
          View,
          { style: styles.tableRow },
          h(
            View,
            { style: styles.colObj },
            h(Text, { style: styles.itemTitle }, currentObjekt?.name || 'Objekt'),
            h(Text, { style: styles.itemSubtitle }, isWohnung ? 'Ferienwohnung' : 'Fahrzeug / Saal')
          ),
          h(
            View,
            { style: styles.colZeit },
            h(
              Text,
              { style: { fontFamily: 'Helvetica-Bold', fontSize: 9 } },
              `${formatDate(buchung?.anreise)} – ${formatDate(buchung?.abreise)}`
            ),
            h(Text, { style: styles.itemSubtitle }, `Check-in: ab ${checkinUhrzeit} Uhr | Check-out: bis ${checkoutUhrzeit} Uhr`)
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
                h(Text, { style: styles.itemSubtitle }, 'Im selben Zeitraum gebucht')
              ),
              h(View, { style: styles.colZeit }, h(Text, { style: styles.itemSubtitle }, 'Inklusive / Kombibuchung')),
              h(Text, { style: styles.colPrice }, 'Inklusive')
            )
          : null
      ),

      // 5. GESAMTBETRAG
      h(
        View,
        { style: styles.totalLine },
        h(Text, { style: styles.totalLineLabel }, 'Gesamtbetrag der Buchung:'),
        h(Text, { style: styles.totalLineValue }, formatCurrency(buchung?.preis || 0))
      ),

      // 6. HINWEISE
      h(
        View,
        { wrap: false },
        h(Text, { style: styles.detailsHeading }, 'Informationen für Ihren Aufenthalt'),
        h(
          View,
          { style: styles.bulletRow },
          h(Text, { style: styles.bulletDot }, '•'),
          h(
            View,
            { style: styles.bulletContent },
            h(Text, { style: styles.bulletTitle }, 'Anreise & Schlüsselübergabe'),
            h(
              Text,
              { style: styles.bulletText },
              `Der Check-in ist ab ${checkinUhrzeit} Uhr möglich. Der Schlüsselzugang erfolgt kontaktlos über die Schlüsselbox am Haupteingang. Den aktuellen PIN-Code erhalten Sie 24 Stunden vor Anreise per E-Mail.`
            )
          )
        ),
        h(
          View,
          { style: styles.bulletRow },
          h(Text, { style: styles.bulletDot }, '•'),
          h(
            View,
            { style: styles.bulletContent },
            h(Text, { style: styles.bulletTitle }, 'WLAN & Internet'),
            h(
              Text,
              { style: styles.bulletText },
              `Kostenfreies WLAN: Netzwerk "${unternehmensDaten.wlanSsid}", Passwort "${unternehmensDaten.wlanPw}".`
            )
          )
        ),
        h(
          View,
          { style: styles.bulletRow },
          h(Text, { style: styles.bulletDot }, '•'),
          h(
            View,
            { style: styles.bulletContent },
            h(Text, { style: styles.bulletTitle }, 'Abreise & Hausordnung'),
            h(
              Text,
              { style: styles.bulletText },
              `Bitte geben Sie das Objekt am Abreisetag bis spätestens ${checkoutUhrzeit} Uhr frei. Im gesamten Gebäude gilt Rauchverbot sowie Nachtruhe ab 22:00 Uhr.`
            )
          )
        )
      ),

      // 7. FOOTER
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

export default BuchungsbestaetigungDocument;