// hooks/usePortalAnfrage.js
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  formatDe,
  parseISO,
  isPastDate,
  toISO,
  germanToISO,
  ueberschneidenSich,
  istStundenbasiert,
  istWohnung,
  isSameDay,
  datumZeitUeberschneidenSich,
  entsprichtWochentag,
  getWochentagName,
  berechneLiveVerfuegbarkeit,
  ermittleFreieStundenSlots,
  findeBestenFreienSlot,
} from "../utils/javaUtils";
import { useEinstellungen } from "./useEinstellungen";
import { useToast } from "./useToast";

/**
 * usePortalAnfrage.js
 * --------------------
 * Zentrales "View-Model" für die öffentliche 2-Schritte-Anfrage-Seite
 * (PortalAnfrage.jsx + PortalAnfrageSchritt1/2). Bündelt sämtlichen
 * Zustand (gewählter Zeitraum, Objekt, Gästedaten, Preisberechnung,
 * Verfügbarkeitsprüfung) und die komplette Geschäftslogik an einer
 * Stelle - die Schritt-Komponenten selbst sind reine Anzeige und
 * greifen nur auf das hier zurückgegebene "vm"-Objekt zu.
 *
 * Pendant für den internen Buchungs-Assistenten: useBuchungsAssistent.js
 * (sehr ähnlicher Aufbau, aber dort mit Rabatt/Endpreis-Feinschliff,
 * Gäste-Autofill aus der Gästeliste und echter Buchungs- statt
 * Anfragen-Semantik - hier landet am Ende eine unverbindliche Anfrage
 * im Backend statt direkt einer Buchung).
 */

const OBJEKTE_API = "/api/objekte/oeffentlich";
const OEFFENTLICHE_BUCHUNGEN_API = "/api/buchungen/oeffentlich";
const ANFRAGEN_API = "/api/anfragen";

const STANDARD_ANREISE_ZEIT = "09:00";
const STANDARD_ABREISE_ZEIT = "17:00";

/** Leeres Gästeformular als Ausgangs-/Reset-Zustand von Schritt 2. */
const LEERES_GASTFORMULAR = {
  name: "", email: "", telnr: "", strasse: "", hausnummer: "", plz: "", stadt: "", land: "Österreich", pkw:"",
};

/**
 * Berechnet die Dauer zwischen zwei Datum+Uhrzeit-Punkten in Stunden.
 * Wird für die Preisberechnung stundenbasierter Objekte (Bus, Forum)
 * gebraucht.
 *
 * @param {Date|string} startDatum
 * @param {string} startZeit - "HH:MM"
 * @param {Date|string} endDatum
 * @param {string} endZeit - "HH:MM"
 * @returns {number} Stunden als Dezimalzahl, 0 falls Eingaben fehlen oder das Ende vor dem Start liegt
 */
const berechneStunden = (startDatum, startZeit, endDatum, endZeit) => {
  if (!startDatum || !endDatum || !startZeit || !endZeit) return 0;
  const [sh, sm] = startZeit.split(":").map(Number);
  const [eh, em] = endZeit.split(":").map(Number);

  const start = new Date(startDatum);
  start.setHours(sh, sm, 0, 0);
  const ende = new Date(endDatum);
  ende.setHours(eh, em, 0, 0);

  const diffMs = ende - start;
  return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
};

/**
 * usePortalAnfrage
 * -----------------
 * Lädt Objekt- und (bewusst gästedatenlose) Belegungs-Stammdaten vom
 * öffentlichen Backend-Endpunkt und stellt den kompletten
 * 2-Schritte-Anfrage-Wizard (Zeitraum & Objekt wählen -> Kontaktdaten
 * & Absenden) als ein einziges View-Model bereit.
 *
 * @returns {object} vm - enthält u.a.:
 *   - wizardStep, setWizardStep: aktueller Schritt (1 oder 2)
 *   - dateRange, handleDateClick, handleClearSelection: Zeitraumauswahl
 *   - objektStammdaten, verfuegbareObjekte, istVerfuegbar: Objekt-Verfügbarkeit
 *   - selectedObjekt, handleSelectObjekt, selectedObjektVerfuegbar: gewähltes Objekt
 *   - gastData, handleGastChange: Kontaktdaten des Anfragenden (Schritt 2)
 *   - zeiten, stundenHauptobjekt: Uhrzeiten & Dauer bei stundenbasierten Objekten
 *   - gesamtpreisBerechnet: reine Preisanzeige (kein Rabatt/Endpreis wie im internen Assistenten)
 *   - istAnfrageUngueltig, handleSubmitAnfrage: Validierung & Absenden
 *   - toast, dismissToast, wurdeGesendet, sendError, handleNeueAnfrage: Erfolgs-/Fehler-Feedback
 */
export function usePortalAnfrage() {
  const { einstellungen } = useEinstellungen();
  const { toast, showToast, dismissToast } = useToast();

  const MINDEST_NAECHTE_WOHNUNG = einstellungen.mindest_naechte_wohnung;
  const CHECKIN_WOCHENTAG = einstellungen.checkin_wochentag;
  const CHECKOUT_WOCHENTAG = einstellungen.checkout_wochentag;

  const [wizardStep, setWizardStep] = useState(1);

  // ─── BACKEND-DATEN ───
  const [objektStammdaten, setObjektStammdaten] = useState([]);
  const [belegungen, setBelegungen] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // ─── ZEITRAUM & GÄSTE ───
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [hoveredDate, setHoveredDate] = useState(null);

  const [guestCounts, setGuestCounts] = useState({ erwachsene: 2, kinder: 0 });
  const [isGuestPopupOpen, setIsGuestPopupOpen] = useState(false);

  const [selectedObjekt, setSelectedObjekt] = useState(null);
  const [zeiten, setZeiten] = useState({ anreiseZeit: STANDARD_ANREISE_ZEIT, abreiseZeit: STANDARD_ABREISE_ZEIT });

  // ─── FORMULARDATEN (KONTAKTDATEN DES ANFRAGENDEN) ───
  const [gastData, setGastData] = useState(LEERES_GASTFORMULAR);
  const [nachricht, setNachricht] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [wurdeGesendet, setWurdeGesendet] = useState(false);
  const [sendError, setSendError] = useState(false);

  /**
   * Lädt beim ersten Rendern Objekte UND die öffentliche,
   * gästedatenlose Belegungsliste vom Backend (GET /api/buchungen/oeffentlich
   * - liefert bewusst NUR Objektname + Zeitraum, siehe
   * buchungen.routes.js) und baut daraus eine flache
   * "belegungen"-Liste - exakt dasselbe Muster wie ladeStammdaten() im
   * internen Buchungs-Assistenten, nur eben ohne Gast-/Preisdaten,
   * weil die Portal-Seite dafür kein Recht hat.
   */
  useEffect(() => {
    async function ladeStammdaten() {
      try {
        setApiLoading(true);
        const [objekteRes, belegungenRes] = await Promise.all([
          fetch(OBJEKTE_API),
          fetch(OEFFENTLICHE_BUCHUNGEN_API),
        ]);
        if (!objekteRes.ok || !belegungenRes.ok) throw new Error("Server antwortete mit einem Fehlerstatus");

        const rawObjekte = await objekteRes.json();
        setObjektStammdaten(
          rawObjekte.map((o) => ({
            ...o,
            details: o.beschreibung,
            preisProNacht: o.preis,
          }))
        );

        const rohBelegungen = await belegungenRes.json();
        const flach = [];
        rohBelegungen.forEach((b) => {
          if (!b.Objekte) return;
          flach.push({
            name: b.Objekte.name,
            start: germanToISO(b.anreise),
            end: germanToISO(b.abreise),
            anreiseZeit: b.anreise_zeit,
            abreiseZeit: b.abreise_zeit,
          });
        });
        setBelegungen(flach);
        setApiError(null);
      } catch (err) {
        console.error("usePortalAnfrage: Fehler beim Laden vom Backend:", err);
        setApiError("Diese Seite ist gerade nicht erreichbar. Bitte später erneut versuchen.");
      } finally {
        setApiLoading(false);
      }
    }
    ladeStammdaten();
  }, []);

  /**
   * FullCalendar-Klick-Handler für den Sidebar-Kalender: verzweigt je
   * nachdem, ob bereits ein Objekt gewählt ist (dann wird nur der
   * Zeitraum neu gesetzt, mit passender Logik für stundenbasiert vs.
   * Wohnung) oder ob wir uns noch in der reinen Zeitraum-Auswahl von
   * Schritt 1 befinden (Start-/Enddatum schrittweise setzen) - exakt
   * dasselbe Verzweigungsmuster wie handleDateClick im internen
   * Buchungs-Assistenten.
   *
   * @param {{date: Date}} info - FullCalendar dateClick-Event-Info
   * @returns {void}
   */
  const handleDateClick = useCallback((info) => {
    const clickedDate = info.date;
    if (isPastDate(clickedDate)) return;

    setDateRange((prev) => {
      if (prev.start && !prev.end) {
        if (clickedDate < prev.start) {
          // Klick liegt vor der Anreise -> Anreise auf diesen Tag umsetzen
          return { start: clickedDate, end: null };
        } else {
          // 2. Klick: Abreisedatum setzen
          return { start: prev.start, end: clickedDate };
        }
      } else {
        // 1. Klick: Neues Anreisedatum wählen, Abreise leeren
        return { start: clickedDate, end: null };
      }
    });
    setHoveredDate(null);
  }, []);

  /** Setzt die Zeitraumauswahl UND das gewählte Objekt komplett zurück (Kalender "× Auswahl aufheben"). */
  const handleClearSelection = () => {
    setDateRange({ start: null, end: null });
    setSelectedObjekt(null);
  };

  const startISO = dateRange.start ? toISO(dateRange.start) : "";
  const endISO = dateRange.end ? toISO(dateRange.end) : "";

  /** Anzahl der Nächte zwischen Start und Ende (mind. 1, sobald beide Daten gewählt sind). */
  const naechteAnz = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return 0;
    return Math.max(1, Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)));
  }, [dateRange]);

  /**
   * Prüft, ob ein Objekt im gegebenen Zeitraum (bei stundenbasierten
   * Objekten optional inkl. Uhrzeit) noch frei ist - zentrale
   * Verfügbarkeitsprüfung, die von so gut wie jeder anderen
   * abgeleiteten Größe in diesem Hook genutzt wird (identisches
   * Muster zu istVerfuegbar() im internen Buchungs-Assistenten, hier
   * aber auf Basis der gästedatenlosen "belegungen"-Liste).
   *
   * @param {string} objektName
   * @param {string} sISO
   * @param {string} eISO
   * @param {string|null} [startZeit] - "HH:MM", nur bei stundenbasierten Objekten relevant
   * @param {string|null} [endZeit] - "HH:MM"
   * @returns {boolean}
   */
  const istVerfuegbar = useCallback(
    (objektName, sISO, eISO, startZeit = null, endZeit = null) => {
      if (!objektName || !sISO || !eISO) return true;
      const stundenbasiert = istStundenbasiert(objektName);

      return !belegungen.some((bel) => {
        if (bel.name.toLowerCase() !== objektName.toLowerCase()) return false;

        if (stundenbasiert) {
          const sZeit = startZeit || "00:00";
          const eZeit = endZeit || "23:59";

          return datumZeitUeberschneidenSich(
            sISO,
            sZeit,
            eISO,
            eZeit,
            bel.start,
            bel.anreiseZeit || "00:00",
            bel.end,
            bel.abreiseZeit || "23:59"
          );
        } else {
          return ueberschneidenSich(sISO, eISO, bel.start, bel.end);
        }
      });
    },
    [belegungen]
  );

  const istHauptobjektWohnung = istWohnung(selectedObjekt?.name);
  const istHauptobjektStundenbasiert = istStundenbasiert(selectedObjekt?.name);

  /** Gesamtdauer des Hauptobjekts in Stunden, nur relevant bei stundenbasierten Objekten. */
  const stundenHauptobjekt = useMemo(() => {
    if (!istHauptobjektStundenbasiert) return 0;
    return berechneStunden(dateRange.start, zeiten.anreiseZeit, dateRange.end, zeiten.abreiseZeit);
  }, [istHauptobjektStundenbasiert, dateRange.start, dateRange.end, zeiten]);

  /**
   * Reine Preisanzeige des Hauptobjekts - dient hier nur zur
   * unverbindlichen Orientierung des Anfragenden, anders als im
   * internen Buchungs-Assistenten gibt es auf dieser öffentlichen
   * Seite bewusst KEIN manuelles Rabatt-/Endpreis-Feld (der finale
   * Preis wird erst beim Annehmen der Anfrage im Backoffice
   * festgelegt).
   */
  const gesamtpreisBerechnet = useMemo(() => {
    if (!selectedObjekt || !dateRange.start || !dateRange.end) return 0;

    const einzelpreis = selectedObjekt.preisProNacht || selectedObjekt.preis || 0;

    if (istHauptobjektStundenbasiert) {
      return stundenHauptobjekt * einzelpreis;
    }

    return naechteAnz * einzelpreis;
  }, [selectedObjekt, dateRange.start, dateRange.end, istHauptobjektStundenbasiert, stundenHauptobjekt, naechteAnz]);

  // ─── WOCHENTAGS-PRÜFUNG ───
  /** Ob das gewählte Anreisedatum dem zentral vorgegebenen Check-in-Wochentag entspricht (immer true ohne Einschränkung). */
  const checkinWochentagPasst = useMemo(() => {
    return entsprichtWochentag(dateRange.start, CHECKIN_WOCHENTAG);
  }, [dateRange.start, CHECKIN_WOCHENTAG]);

  /** Analog zu checkinWochentagPasst, aber für das Abreisedatum. */
  const checkoutWochentagPasst = useMemo(() => {
    return entsprichtWochentag(dateRange.end, CHECKOUT_WOCHENTAG);
  }, [dateRange.end, CHECKOUT_WOCHENTAG]);

  /**
   * Baut für Schritt 1 die komplette Verfügbarkeitsliste aller
   * Objekte auf - berücksichtigt je nach Objekt-Typ und
   * Auswahlzustand unterschiedliche Regeln: Wochentags-Restriktionen
   * und Mindestaufenthalt bei Wohnungen, Live-Status ohne gewählten
   * Zeitraum, sowie erlaubte stundenweise Teilbelegung am selben Tag
   * bei stundenbasierten Objekten (identisches Muster zu
   * verfuegbareObjekte im internen Buchungs-Assistenten).
   */
  const verfuegbareObjekte = useMemo(() => {
    const hatStart = dateRange.start !== null;
    const hatEnd = dateRange.end !== null;
    const gueltigerZeitraum = hatStart && hatEnd;

    return objektStammdaten.map((obj) => {
      const stundenbasiert = istStundenbasiert(obj.name);
      const wohnung = istWohnung(obj.name);

      let status;
      let info;
      let preis = null;

      const checkinPasst = !gueltigerZeitraum || stundenbasiert || entsprichtWochentag(dateRange.start, CHECKIN_WOCHENTAG);
      const checkoutPasst = !gueltigerZeitraum || stundenbasiert || entsprichtWochentag(dateRange.end, CHECKOUT_WOCHENTAG);

      if (gueltigerZeitraum && wohnung && (!checkinPasst || !checkoutPasst)) {
        status = "nicht verfügbar";
        if (!checkinPasst && !checkoutPasst) {
          info = CHECKIN_WOCHENTAG === CHECKOUT_WOCHENTAG
            ? `Anreise und Abreise nur am ${CHECKIN_WOCHENTAG} möglich`
            : `Anreise nur am ${CHECKIN_WOCHENTAG}, Abreise nur am ${CHECKOUT_WOCHENTAG} möglich`;
        } else if (!checkinPasst) {
          info = `Anreise nur am ${CHECKIN_WOCHENTAG} möglich`;
        } else {
          info = `Abreise nur am ${CHECKOUT_WOCHENTAG} möglich`;
        }
        preis = null;
      } else if (gueltigerZeitraum && wohnung && naechteAnz < MINDEST_NAECHTE_WOHNUNG) {
        status = "nicht verfügbar";
        info = `Mindestaufenthalt: ${MINDEST_NAECHTE_WOHNUNG} Nächte`;
        preis = null;
      } else if (!gueltigerZeitraum) {
        // ZENTRALE LIVE-VERFÜGBARKEIT: berücksichtigt lückenlose Anschlussbuchungen und Tagesanreisen
        const live = berechneLiveVerfuegbarkeit(obj.name, belegungen, einstellungen);
        status = live.status;
        info = live.info;
        preis = null;
      } else {
        if (stundenbasiert) {
          const istMehrtaegig = startISO !== endISO;

          if (!istMehrtaegig) {
            const freieSlots = ermittleFreieStundenSlots(obj.name, startISO, belegungen, 60, "06:00", "22:00");
            const hatSlot = freieSlots.length > 0;

            if (hatSlot) {
              status = "verfügbar";
              const standardFrei = istVerfuegbar(
                obj.name,
                startISO,
                endISO,
                STANDARD_ANREISE_ZEIT,
                STANDARD_ABREISE_ZEIT
              );
              if (standardFrei) {
                const tagesBelegungen = belegungen.filter(
                  (b) => (b.name || b.resource)?.toLowerCase() === obj.name?.toLowerCase() && b.start <= endISO && b.end >= startISO
                );
                info = tagesBelegungen.length > 0
                  ? "Für gewählte Uhrzeit verfügbar"
                  : "Im gewählten Zeitraum verfügbar";
              } else {
                const ersterSlot = freieSlots[0];
                info = `Teilweise belegt (z. B. ${ersterSlot.startStr}–${ersterSlot.endStr} frei)`;
              }
              preis = null;
            } else {
              status = "nicht verfügbar";
              info = "Im gewählten Zeitraum belegt";
              preis = null;
            }
          } else {
            const verfuegbar = istVerfuegbar(obj.name, startISO, endISO, STANDARD_ANREISE_ZEIT, STANDARD_ABREISE_ZEIT);
            status = verfuegbar ? "verfügbar" : "nicht verfügbar";
            info = verfuegbar ? "Im gewählten Zeitraum verfügbar" : "Im gewählten Zeitraum belegt";
            preis = null;
          }
        } else {
          const verfuegbar = istVerfuegbar(obj.name, startISO, endISO);
          status = verfuegbar ? "verfügbar" : "nicht verfügbar";
          preis = obj.preisProNacht * naechteAnz;
          info = verfuegbar ? "Im gewählten Zeitraum verfügbar" : "Im Zeitraum belegt";
        }
      }

      return { ...obj, status, info, preis };
    });
  }, [
    objektStammdaten,
    belegungen,
    dateRange.start,
    dateRange.end,
    startISO,
    endISO,
    naechteAnz,
    istVerfuegbar,
    MINDEST_NAECHTE_WOHNUNG,
    CHECKIN_WOCHENTAG,
    CHECKOUT_WOCHENTAG,
    einstellungen,
  ]);

  /** Ob die Wohnungs-Mindestaufenthaltsdauer beim aktuell gewählten Zeitraum unterschritten wird. */
  const unterschreitetMindestNaechte =
    istHauptobjektWohnung && naechteAnz < MINDEST_NAECHTE_WOHNUNG;

  /**
   * Wählt ein Objekt in Schritt 1 aus, passt Start/Ende automatisch an
   * den Objekttyp an (stundenbasiert -> gleicher Tag, Wohnung ->
   * mindestens 1 Folgetag) und schlägt bei stundenbasierten Objekten
   * automatisch die nächste freie Uhrzeit vor, falls die Standardzeit
   * (09:00-17:00) am gewählten Tag schon belegt ist - identisches
   * Verhalten zu handleSelectObjekt im internen Buchungs-Assistenten.
   *
   * @param {object} obj - Objekt aus verfuegbareObjekte
   * @returns {void}
   */
  const handleSelectObjekt = (obj) => {
    setSelectedObjekt(obj);

    let start = dateRange.start;
    let end = dateRange.end;

    if (start) {
      if (istStundenbasiert(obj.name)) {
        end = start;
        setDateRange({ start, end: start });
      } else {
        if (!end || isSameDay(start, end)) {
          const folgetag = new Date(start);
          folgetag.setDate(folgetag.getDate() + 1);
          end = folgetag;
          setDateRange({ start, end: folgetag });
        }
      }
    }

    const aktuellesStartISO = toISO(start);

    if (istStundenbasiert(obj.name) && start) {
      const besterSlot = findeBestenFreienSlot(
        obj.name,
        aktuellesStartISO,
        belegungen,
        STANDARD_ANREISE_ZEIT,
        STANDARD_ABREISE_ZEIT,
        "06:00",
        "22:00"
      );

      if (besterSlot) {
        setZeiten({ anreiseZeit: besterSlot.anreiseZeit, abreiseZeit: besterSlot.abreiseZeit });
      } else {
        setZeiten({ anreiseZeit: STANDARD_ANREISE_ZEIT, abreiseZeit: STANDARD_ABREISE_ZEIT });
      }
    }

    setWizardStep(2);
  };

  /** Bereits bestehende Belegungen des gewählten Objekts am gewählten Tag (für den Kollisionshinweis). */
  const tagesBuchungen = useMemo(() => {
    if (!selectedObjekt || !dateRange.start || !dateRange.end) return [];
    return belegungen
      .filter((b) => {
        if (b.name?.toLowerCase() !== selectedObjekt.name?.toLowerCase()) return false;
        return b.start <= endISO && b.end >= startISO;
      })
      .sort((a, b) => (a.anreiseZeit || "00:00").localeCompare(b.anreiseZeit || "00:00"));
  }, [selectedObjekt, startISO, endISO, belegungen]);

  /** Ob das aktuell gewählte Hauptobjekt im gewählten Zeitraum (+ ggf. Uhrzeit) noch verfügbar ist. */
  const selectedObjektVerfuegbar = useMemo(() => {
    if (!selectedObjekt || !dateRange.start || !dateRange.end) return true;

    const stundenbasiert = istStundenbasiert(selectedObjekt.name);

    if (stundenbasiert) {
      return istVerfuegbar(
        selectedObjekt.name,
        startISO,
        endISO,
        zeiten.anreiseZeit,
        zeiten.abreiseZeit
      );
    }

    return istVerfuegbar(selectedObjekt.name, startISO, endISO);
  }, [selectedObjekt, dateRange.start, dateRange.end, startISO, endISO, zeiten, istVerfuegbar]);

  /** Menschenlesbarer Warntext bei Terminkollision (fasst bis zu 3 Kollisionen konkret zusammen, sonst pauschal). */
  const kollisionsText = useMemo(() => {
    if (tagesBuchungen.length === 0 || selectedObjektVerfuegbar) return null;

    const objName = selectedObjekt?.name;

    if (istHauptobjektStundenbasiert) {
      if (tagesBuchungen.length > 3) {
        return `⚠ ${objName} ist im gewählten Zeitraum mehrfach belegt (siehe Kalender für Details zur Verfügbarkeit).`;
      }

      const zeitenListe = tagesBuchungen
        .map((b) => {
          const bStartDe = formatDe(parseISO(b.start));
          const bEndDe = formatDe(parseISO(b.end));
          const isSingleDay = b.start === b.end;

          if (isSingleDay) {
            return b.anreiseZeit && b.abreiseZeit
              ? `${b.anreiseZeit} bis ${b.abreiseZeit} Uhr`
              : "ganztägig";
          } else {
            return `vom ${bStartDe} (${b.anreiseZeit || "15:00"} Uhr) bis ${bEndDe} (${b.abreiseZeit || "11:00"} Uhr)`;
          }
        })
        .join(", ");

      return `⚠ ${objName} ist im gewählten Zeitraum bereits belegt (${zeitenListe}).`;
    }

    return `⚠ ${objName} ist im gewählten Zeitraum bereits belegt.`;
  }, [tagesBuchungen, selectedObjekt, istHauptobjektStundenbasiert, selectedObjektVerfuegbar]);

  /** Handler für alle einfachen Textfelder im Kontaktformular (Schritt 2). */
  const handleGastChange = (e) => {
    setGastData({ ...gastData, [e.target.name]: e.target.value });
  };

  // Anfrage ist ungültig, wenn: kein Objekt/Zeitraum gewählt, ODER eine
  // Wohnung den geforderten Checkin-/Checkout-Wochentag nicht einhält,
  // ODER die Mindestaufenthaltsdauer unterschreitet, ODER das Objekt
  // kollidiert, ODER bei stundenbasierten Objekten 0 Stunden Dauer
  // herauskommt, ODER Pflichtfelder im Kontaktformular fehlen.
  const istAnfrageUngueltig =
    !selectedObjekt ||
    !dateRange.start ||
    !dateRange.end ||
    (istHauptobjektWohnung && !checkinWochentagPasst) ||
    (istHauptobjektWohnung && !checkoutWochentagPasst) ||
    unterschreitetMindestNaechte ||
    !selectedObjektVerfuegbar ||
    (istHauptobjektStundenbasiert && stundenHauptobjekt <= 0) ||
    !gastData.name.trim() ||
    !gastData.email.trim() ||
    !gastData.strasse.trim() ||
    !gastData.hausnummer.trim() ||
    !gastData.plz.trim() ||
    !gastData.stadt.trim() ||
    !gastData.land.trim();

  /**
   * Sendet die Anfrage ans Backend (POST /api/anfragen) - anders als
   * beim internen Buchungs-Assistenten entsteht hier bewusst noch
   * KEINE Buchung, keine Rechnung und kein Gast-Datensatz im
   * "echten" Gäste-Stamm; das passiert erst, wenn ein Admin die
   * Anfrage in Anfragen.jsx annimmt.
   *
   * @param {React.FormEvent} [e]
   * @returns {Promise<void>}
   */
  const handleSubmitAnfrage = async (e) => {
    if (e) e.preventDefault();
    if (istAnfrageUngueltig) {
      showToast("error", "Bitte alle Pflichtfelder ausfüllen.");
      return;
    }

    setIsSaving(true);
    setSendError(false);
    try {
      const payload = {
        name: gastData.name,
        email: gastData.email,
        telnr: gastData.telnr || null,
        strasse: gastData.strasse,
        hnr: gastData.hausnummer,
        plz: gastData.plz,
        stadt: gastData.stadt,
        land: gastData.land,
        objekt_id: selectedObjekt.id,
        anreise: formatDe(dateRange.start),
        abreise: formatDe(dateRange.end),
        anreise_zeit: istHauptobjektStundenbasiert ? zeiten.anreiseZeit : einstellungen.checkin_zeit,
        abreise_zeit: istHauptobjektStundenbasiert ? zeiten.abreiseZeit : einstellungen.checkout_zeit,
        erwachsene: istWohnung(selectedObjekt?.name) ? guestCounts.erwachsene : null,
        kinder: istWohnung(selectedObjekt?.name) ? guestCounts.kinder : null,
        infos: nachricht || null,
        pkw: gastData.pkw || "keine angegeben",
      };

      const response = await fetch(ANFRAGEN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Anfrage konnte nicht gesendet werden");

      setWurdeGesendet(true);
    } catch (err) {
      console.error("usePortalAnfrage: Fehler beim Senden:", err);
      setSendError(true);
    } finally {
      setIsSaving(false);
    }
  };

  /** Setzt den kompletten Assistenten auf den Ausgangszustand zurück - z.B. nach "Zurück zur Startseite" im Erfolgs-Modal. */
  const handleNeueAnfrage = () => {
    setWizardStep(1);
    setDateRange({ start: null, end: null });
    setSelectedObjekt(null);
    setGastData(LEERES_GASTFORMULAR);
    setGuestCounts({ erwachsene: 2, kinder: 0 });
    setZeiten({ anreiseZeit: STANDARD_ANREISE_ZEIT, abreiseZeit: STANDARD_ABREISE_ZEIT });
    setNachricht("");
    setWurdeGesendet(false);
    setSendError(false);
  };

  return {
    wizardStep,
    setWizardStep,
    apiLoading,
    apiError,
    dateRange,
    hoveredDate,
    setHoveredDate,
    handleDateClick,
    handleClearSelection,
    guestCounts,
    setGuestCounts,
    isGuestPopupOpen,
    setIsGuestPopupOpen,
    startISO,
    endISO,
    naechteAnz,
    verfuegbareObjekte,
    handleSelectObjekt,
    selectedObjekt,
    setSelectedObjekt,
    selectedObjektVerfuegbar,
    istVerfuegbar,
    objektStammdaten,
    gesamtpreisBerechnet,
    istHauptobjektWohnung,
    istHauptobjektStundenbasiert,
    zeiten,
    setZeiten,
    stundenHauptobjekt,
    gastData,
    setGastData,
    handleGastChange,
    nachricht,
    setNachricht,
    isSaving,
    wurdeGesendet,
    sendError,
    setSendError,
    handleSubmitAnfrage,
    handleNeueAnfrage,
    istAnfrageUngueltig,
    kollisionsText,
    toast,
    dismissToast,
    MINDEST_NAECHTE_WOHNUNG,
    unterschreitetMindestNaechte,
    CHECKIN_WOCHENTAG,
    CHECKOUT_WOCHENTAG,
    checkinWochentagPasst,
    checkoutWochentagPasst,
    startWochentag: getWochentagName(dateRange.start),
    endWochentag: getWochentagName(dateRange.end),
  };
}