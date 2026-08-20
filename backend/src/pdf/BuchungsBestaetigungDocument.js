import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { getLogoBase64 } from '../utils/pdfUtils.js';

/**
 * @file BuchungsBestaetigungDocument.js
 * @description PDF-Vorlage für verbindliche Buchungsbestätigungen im CI-konformen Unternehmensdesign (Beckhoff Automation).
 * @module pdf/BuchungsBestaetigungDocument
 */

const h = React.createElement;

const COLORS = {
  primary: '#E30000',
  textPrimary: '#18181B',
  textSecondary: '#52525B',
  textMuted: '#8E8E93',
  borderLight: '#E4E4E7',
  borderDark: '#27272A',
  white: '#FFFFFF',
};

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
  colObj: { width: '45%' },
  colZeit: { width: '35%' },
  colPrice: { width: '20%', textAlign: 'right' },
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

  detailsHeading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: COLORS.textPrimary,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
    paddingBottom: 3,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 5,
    paddingLeft: 2,
  },
  bulletDot: {
    width: 10,
    color: COLORS.primary,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
  },
  bulletContent: {
    flex: 1,
  },
  bulletTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: COLORS.textPrimary,
  },
  bulletText: {
    fontSize: 7,
    color: COLORS.textSecondary,
    lineHeight: 1.3,
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

const formatCurrency = (val) => {
  const num = typeof val === 'number' ? val : parseFloat(val) || 0;
  return num.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

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
 * BuchungsbestaetigungDocument-Komponente.
 *
 * @component
 * @param {object} props - Komponenten-Properties.
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
  einstellungen = {},
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

  const erwachsene = Number(buchung?.erwachsene) || (buchung?.erwachsene === 0 ? 0 : 1);
  const kinder = Number(buchung?.kinder) || 0;
  const gesamtpreis = Number(buchung?.preis || 0);

  const zeitenText = isWohnung
    ? `Check-in: ab ${checkinUhrzeit} Uhr | Check-out: bis ${checkoutUhrzeit} Uhr`
    : `Abholung: ab ${checkinUhrzeit} Uhr | Rückgabe: bis ${checkoutUhrzeit} Uhr`;

  const personenText = isWohnung
    ? `${erwachsene} Erw.${kinder > 0 ? ` · ${kinder} Kind. (< 14 J.)` : ''}`
    : `${(buchung?.erwachsene || 0) + (buchung?.kinder || 0) || 1} Person(en)`;

  return h(
    Document,
    { title: `Buchungsbestaetigung_${buchungId}` },
    h(
      Page,
      { size: 'A4', style: styles.page },

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
            h(Text, { style: styles.metaLabel }, isWohnung ? 'Gäste:' : 'Fahrgäste:'),
            h(Text, { style: styles.metaValue }, personenText)
          )
        )
      ),

      h(Text, { style: styles.docTitle }, `Buchungsbestätigung #${buchungId}`),
      h(
        Text,
        { style: styles.introText },
        `Sehr geehrte(r) ${gastName},\n` +
        'wir freuen uns über Ihre Reservierung und bestätigen Ihre gebuchte Nutzung verbindlich mit folgenden Daten:'
      ),

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
              { style: { fontFamily: 'Helvetica-Bold', fontSize: 7.5 } },
              `${formatDate(buchung?.anreise)} – ${formatDate(buchung?.abreise)}`
            ),
            h(Text, { style: styles.itemSubtitle }, zeitenText)
          ),
          h(Text, { style: styles.colPrice }, formatCurrency(gesamtpreis))
        )
      ),

      (() => {
        const oSatz = typeof einstellungen?.ortstaxe === 'number' ? einstellungen.ortstaxe : parseFloat(einstellungen?.ortstaxe) || 0;
        const mSatz = typeof einstellungen?.mwst_normal === 'number' ? einstellungen.mwst_normal : parseFloat(einstellungen?.mwst_normal) || 0;
        const moSatz = typeof einstellungen?.mwst_ortstaxe === 'number' ? einstellungen.mwst_ortstaxe : parseFloat(einstellungen?.mwst_ortstaxe) || 0;

        const startIso = buchung?.anreise?.includes('.') ? buchung.anreise.split('.').reverse().join('-') : buchung?.anreise;
        const endIso = buchung?.abreise?.includes('.') ? buchung.abreise.split('.').reverse().join('-') : buchung?.abreise;
        const an = new Date(startIso);
        const ab = new Date(endIso);

        const naechte = (!isNaN(an.getTime()) && !isNaN(ab.getTime())) ? Math.max(1, Math.ceil(Math.abs(ab - an) / 86400000)) : 1;

        const ortstaxeGesamt = isWohnung ? (erwachsene * naechte * oSatz) : 0;

        const nettoLeistung = gesamtpreis / (1 + (mSatz / 100));
        const mwstLeistung = gesamtpreis - nettoLeistung;

        const mwstOrtstaxe = moSatz > 0 ? ortstaxeGesamt - (ortstaxeGesamt / (1 + (moSatz / 100))) : 0;

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

      h(
        View,
        { wrap: false },
        h(
          Text,
          { style: styles.detailsHeading },
          isWohnung ? 'Informationen für Ihren Aufenthalt' : 'Informationen zur Fahrzeugnutzung'
        ),

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

export const BuchungsBestaetigungDocument = BuchungsbestaetigungDocument;
export default BuchungsbestaetigungDocument;