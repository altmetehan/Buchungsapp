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
    marginBottom: 10,
  },
  introText: {
    fontSize: 9.5,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 1.4,
  },

  table: {
    width: '100%',
    marginBottom: 20,
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
  colPos: { width: '6%' },
  colDesc: { width: '50%' },
  colQty: { width: '14%', textAlign: 'right' },
  colPrice: { width: '15%', textAlign: 'right' },
  colTotal: { width: '15%', textAlign: 'right' },

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

  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 25,
  },
  totalsTable: {
    width: '45%',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  totalsValue: {
    fontSize: 9,
    color: COLORS.textPrimary,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDark,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDark,
    marginTop: 6,
    paddingVertical: 5,
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    color: COLORS.textPrimary,
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: COLORS.primary,
  },

  paymentTerms: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
    paddingLeft: 10,
    marginVertical: 14,
  },
  paymentText: {
    fontSize: 8.5,
    color: COLORS.textSecondary,
    lineHeight: 1.45,
  },

  footer: {
    position: 'absolute',
    bottom: 25,
    left: 45,
    width: 505,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerCol: {
    flex: 1,
    paddingRight: 15,
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
}) {
  const finalLogo = logoSrc || getLogoBase64();
  const currentBuchung = buchung || rechnung?.Buchungen || {};
  const currentGast = gast || currentBuchung?.Gaeste || {};
  const currentObjekt = objekt || currentBuchung?.Objekte || {};

  const rNr = rechnungsNummer || rechnung?.rechnungs_nummer || 'RE-2026-0001';
  const rDatum = rechnungsDatum || rechnung?.rechnungs_datum || currentBuchung?.abreise || new Date().toISOString().split('T')[0];

  const calcFaelligkeit = () => {
    if (faelligkeitsDatum) return formatDate(faelligkeitsDatum);
    if (rechnung?.faelligkeits_datum) return formatDate(rechnung.faelligkeits_datum);
    const d = new Date(rDatum.includes('.') ? rDatum.split('.').reverse().join('-') : rDatum);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 14);
      return formatDate(d.toISOString().split('T')[0]);
    }
    return '-';
  };

  const isWohnung = Boolean(currentObjekt?.name?.toLowerCase().includes('wohnung'));
  const gesamtpreis = Number(currentBuchung?.preis || 0);

  const gastName = currentGast?.name || `${currentGast?.vorname || ''} ${currentGast?.nachname || ''}`.trim() || 'Gast';
  const gastAdresse = currentGast?.strasse ? `${currentGast.strasse} ${currentGast.hnr || ''}`.trim() : 'Musterstraße 1';
  const gastOrt = `${currentGast?.plz || '6700'} ${currentGast?.stadt || 'Bludenz'}`;

  return h(
    Document,
    { title: `Rechnung_${rNr}` },
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

      // 2. BRIEFFENSTER & META
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
            h(Text, { style: styles.metaLabel }, 'Rechnungsdatum:'),
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
            h(Text, { style: styles.metaLabel }, 'Rechnungs-Nr.:'),
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

      // 3. ANREDE
      h(Text, { style: styles.docTitle }, `Rechnung ${rNr}`),
      h(
        Text,
        { style: styles.introText },
        `Sehr geehrte(r) ${currentGast?.anrede ? `${currentGast.anrede} ` : ''}${currentGast?.nachname || gastName},\n` +
        'wir bedanken uns für Ihre Buchung und stellen Ihnen die vereinbarten Leistungen in Rechnung:'
      ),

      // 4. TABELLE
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
        h(
          View,
          { style: styles.tableRow },
          h(Text, { style: styles.colPos }, '1'),
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
          h(Text, { style: styles.colPrice }, formatCurrency(gesamtpreis)),
          h(Text, { style: styles.colTotal }, formatCurrency(gesamtpreis))
        ),
        currentBuchung?.ObjekteZusatz
          ? h(
              View,
              { style: styles.tableRow },
              h(Text, { style: styles.colPos }, '2'),
              h(
                View,
                { style: styles.colDesc },
                h(Text, { style: styles.itemTitle }, `Zusatzleistung: ${currentBuchung.ObjekteZusatz.name}`),
                h(Text, { style: styles.itemSubtitle }, 'Nutzung im selben Zeitraum (Kombibuchung)')
              ),
              h(Text, { style: styles.colQty }, '1 Pausch.'),
              h(Text, { style: styles.colPrice }, 'Inklusive'),
              h(Text, { style: styles.colTotal }, 'Inklusive')
            )
          : null
      ),

      // 5. SUMMEN
      h(
        View,
        { style: styles.totalsSection, wrap: false },
        h(
          View,
          { style: styles.totalsTable },
          h(
            View,
            { style: styles.totalsRow },
            h(Text, { style: styles.totalsLabel }, 'Zwischensumme:'),
            h(Text, { style: styles.totalsValue }, formatCurrency(gesamtpreis))
          ),
          h(
            View,
            { style: styles.grandTotalRow },
            h(Text, { style: styles.grandTotalLabel }, 'Gesamtbetrag:'),
            h(Text, { style: styles.grandTotalValue }, formatCurrency(gesamtpreis))
          )
        )
      ),

      // 6. ZAHLUNGSTEXT
      h(
        View,
        { style: styles.paymentTerms, wrap: false },
        h(
          Text,
          { style: styles.paymentText },
          `Bitte überweisen Sie den Rechnungsbetrag von ${formatCurrency(gesamtpreis)} bis zum ${calcFaelligkeit()} ` +
          `unter Angabe der Rechnungsnummer ${rNr} auf unser unten angegebenes Bankkonto.`
        )
      ),

      // 7. FOOTER
      h(
        View,
        { style: styles.footer },
        h(
          View,
          { style: styles.footerCol },
          h(Text, { style: styles.footerHeading }, unternehmensDaten.name),
          h(Text, { style: styles.footerText }, unternehmensDaten.strasse),
          h(Text, { style: styles.footerText }, `${unternehmensDaten.plzOrt}, ${unternehmensDaten.land}`)
        ),
        h(
          View,
          { style: styles.footerCol },
          h(Text, { style: styles.footerHeading }, 'Bankverbindung'),
          h(Text, { style: styles.footerText }, `Institut: ${unternehmensDaten.bank}`),
          h(Text, { style: styles.footerText }, `IBAN: ${unternehmensDaten.iban}`),
          h(Text, { style: styles.footerText }, `BIC: ${unternehmensDaten.bic}`)
        ),
        h(
          View,
          { style: [styles.footerCol, { paddingRight: 0 }] },
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