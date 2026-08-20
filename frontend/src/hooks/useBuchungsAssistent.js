// hooks/useBuchungsAssistent.js
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  formatDe,
  toISO,
  parseISO,
  germanToISO,
  ueberschneidenSich,
  naechteZwischen,
  isSameDay,
  isPastDate,
  istStundenbasiert,
  istWohnung,
  datumZeitUeberschneidenSich,
  getNowIsoWithTime,
  entsprichtWochentag,
  getWochentagName,
  berechneLiveVerfuegbarkeit,
  ermittleFreieStundenSlots,
  findeBestenFreienSlot,
} from "../utils/javaUtils";
import { useEinstellungen } from "./useEinstellungen";
import { useToast } from "./useToast";

/**
 * useBuchungsAssistent.js
 * ------------------------
 * Zentrales "View-Model" für den internen Buchungs-Assistenten
 * (Seite Buchen.jsx + BuchenSchritt1/2/3). Bündelt sämtlichen Zustand
 * (gewählter Zeitraum, Objekt, Gästedaten, Preisberechnung,
 * Verfügbarkeitsprüfung) und die komplette Geschäftslogik an einer
 * Stelle - die Schritt-Komponenten selbst sind reine Anzeige und
 * greifen nur auf das hier zurückgegebene "vm"-Objekt zu.
 *
 * Pendant für die öffentliche Portal-Seite: usePortalAnfrage.js (sehr
 * ähnlicher Aufbau, aber ohne internen Rabatt/Endpreis-Feinschliff und
 * mit Anfragen- statt Buchungs-Semantik).
 */

const OBJEKTE_API = "/api/objekte";
const BUCHUNGEN_API = "/api/buchungen";
const GAESTE_API = "/api/gaeste";
const RECHNUNGEN_API = "/api/rechnungen";

const STANDARD_ANREISE_ZEIT = "09:00";
const STANDARD_ABREISE_ZEIT = "17:00";

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
 * useBuchungsAssistent
 * --------------------
 * Lädt Objekt-, Buchungs- und Gästestammdaten vom Backend und stellt
 * den kompletten 3-Schritte-Buchungs-Wizard (Zeitraum & Objekt wählen
 * -> Gästedaten -> Details/Preis/Abschluss) als ein einziges
 * View-Model bereit.
 *
 * @returns {object} vm - enthält u.a.:
 *   - wizardStep, setWizardStep: aktueller Schritt (2 oder 3) innerhalb einer neuen Buchung
 *   - dateRange, handleDateClick, handleClearSelection: Zeitraumauswahl
 *   - objektStammdaten, verfuegbareObjekte, istVerfuegbar: Objekt-Verfügbarkeit
 *   - selectedObjekt, handleSelectObjekt, selectedObjektVerfuegbar: gewähltes Objekt
 *   - guestData, handleGuestChange, gastVorschlaege, handleSelectGuestSuggestion: Gästedaten inkl. Autofill
 *   - zeiten, stundenHauptobjekt: Uhrzeiten & Dauer bei stundenbasierten Objekten
 *   - gesamtpreisBerechnet, rabattProzent, endpreisManuell, effektiverEndpreis: Preislogik
 *   - istBuchungUngueltig, handleFinalizeBooking: Validierung & Speichern
 *   - toast, dismissToast, angenommeneBuchungErfolg, resetAssistent: Erfolgs-/Fehler-Feedback
 */
export function useBuchungsAssistent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { einstellungen } = useEinstellungen();
  const MINDEST_NAECHTE_WOHNUNG = einstellungen.mindest_naechte_wohnung;
  const CHECKIN_WOCHENTAG = einstellungen.checkin_wochentag;
  const CHECKOUT_WOCHENTAG = einstellungen.checkout_wochentag;

  const istNeueBuchungRoute = location.pathname.startsWith("/buchen/neu");
  const [wizardStep, setWizardStep] = useState(2);

  // ─── BACKEND-DATEN ───
  const [objektStammdaten, setObjektStammdaten] = useState([]);
  const [bestehendeBuchungen, setBestehendeBuchungen] = useState([]);
  const [alleGaeste, setAlleGaeste] = useState([]);

  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [angenommeneBuchungErfolg, setAngenommeneBuchungErfolg] = useState(null);

  // ─── ZEITRAUM & GÄSTE ───
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [hoveredDate, setHoveredDate] = useState(null);
  const [guestCounts, setGuestCounts] = useState({ erwachsene: 2, kinder: 0 });
  const [isGuestPopupOpen, setIsGuestPopupOpen] = useState(false);

  const naechteAnz = naechteZwischen(dateRange.start, dateRange.end);
  const startISO = toISO(dateRange.start);
  const endISO = toISO(dateRange.end);

  const [selectedObjekt, setSelectedObjekt] = useState(null);
  const istHauptobjektStundenbasiert = istStundenbasiert(selectedObjekt?.name);
  const istHauptobjektWohnung = istWohnung(selectedObjekt?.name);

  // ─── FORMULARDATEN ───
  const [guestData, setGuestData] = useState({
    name: "",
    email: "",
    telefon: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    stadt: "",
    land: "Österreich",
  });

  const [matchedGuestId, setMatchedGuestId] = useState(null);
  const [isGuestSuggestOpen, setIsGuestSuggestOpen] = useState(false);
  const guestSuggestRef = useRef(null);

  /**
   * Bis zu 5 Namensvorschläge aus der bestehenden Gästeliste, sobald
   * mindestens 2 Zeichen im Namensfeld eingegeben wurden (Autofill für
   * wiederkehrende Gäste in Schritt 2).
   */
  const gastVorschlaege = useMemo(() => {
    const query = guestData.name.trim().toLowerCase();
    if (query.length < 2) return [];
    return alleGaeste
      .filter((g) => g.name?.toLowerCase().includes(query))
      .slice(0, 5);
  }, [guestData.name, alleGaeste]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        isGuestSuggestOpen &&
        guestSuggestRef.current &&
        !guestSuggestRef.current.contains(event.target)
      ) {
        setIsGuestSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isGuestSuggestOpen]);

  /** Handler für alle einfachen Textfelder im Gästeformular (Schritt 2). */
  const handleGuestChange = (e) => {
    const { name, value } = e.target;
    setGuestData((prev) => ({ ...prev, [name]: value }));
    if (name === "name") {
      setMatchedGuestId(null);
      setIsGuestSuggestOpen(true);
    }
  };

  /** Übernimmt einen Gast-Vorschlag aus der Autofill-Liste ins Formular. */
  const handleSelectGuestSuggestion = (gast) => {
    setGuestData({
      name: gast.name || "",
      email: gast.email || "",
      telefon: gast.telnr || "",
      strasse: gast.strasse || "",
      hausnummer: gast.hnr || "",
      plz: gast.plz || "",
      stadt: gast.stadt || "",
      land: gast.land || "Österreich",
    });
    setMatchedGuestId(gast.id);
    setIsGuestSuggestOpen(false);
  };

  const [zeiten, setZeiten] = useState({ anreiseZeit: STANDARD_ANREISE_ZEIT, abreiseZeit: STANDARD_ABREISE_ZEIT });

  const [bookingDetails, setBookingDetails] = useState({
    pkw: "",
    info: "",
  });

  const [rabattProzent, setRabattProzent] = useState("0");
  const [endpreisManuell, setEndpreisManuell] = useState("");

  const { toast, showToast, dismissToast } = useToast();

  /**
   * Lädt Objekte, Buchungen und Gäste parallel vom Backend und baut
   * daraus die flache "bestehendeBuchungen"-Belegungsliste (ein
   * Eintrag pro belegtem Objekt). Wird initial UND nach jeder
   * erfolgreichen Buchung erneut aufgerufen, um die Verfügbarkeit
   * aktuell zu halten.
   *
   * @returns {Promise<void>}
   */
  const ladeStammdaten = async () => {
    try {
      const [objekteRes, buchungenRes, gaesteRes] = await Promise.all([
        fetch(OBJEKTE_API),
        fetch(BUCHUNGEN_API),
        fetch(GAESTE_API),
      ]);
      if (!objekteRes.ok || !buchungenRes.ok || !gaesteRes.ok) {
        throw new Error("Server antwortete mit einem Fehlerstatus");
      }

      const objekteData = await objekteRes.json();
      setObjektStammdaten(
        objekteData.map((o) => ({
          ...o,
          details: o.beschreibung,
          preisProNacht: o.preis,
        }))
      );

      const buchungenData = await buchungenRes.json();
      const belegungen = [];
      buchungenData.forEach((b) => {
        const start = germanToISO(b.anreise);
        const end = germanToISO(b.abreise);
        const anreiseZeit = b.anreise_zeit;
        const abreiseZeit = b.abreise_zeit;
        if (b.Objekte) {
          belegungen.push({ resource: b.Objekte.name, start, end, anreiseZeit, abreiseZeit });
        }
      });
      setBestehendeBuchungen(belegungen);
      setAlleGaeste(await gaesteRes.json());
      setApiError(null);
    } catch (err) {
      console.error("Buchen: Fehler beim Laden vom Backend:", err);
      setApiError(
        "Backend nicht erreichbar. Läuft der Server (node src/server.js im backend-Ordner)?"
      );
    }
  };

  useEffect(() => {
    async function initialLaden() {
      setApiLoading(true);
      await ladeStammdaten();
      setApiLoading(false);
    }
    initialLaden();
  }, []);

  // Schützt die Route "/buchen/neu": ohne gewähltes Objekt (z.B. nach
  // einem Reload mitten in Schritt 2/3) zurück auf die Übersicht.
  useEffect(() => {
    if (istNeueBuchungRoute && !selectedObjekt && objektStammdaten.length > 0) {
      navigate("/buchen", { replace: true });
    }
  }, [istNeueBuchungRoute, selectedObjekt, navigate, objektStammdaten]);

  /**
   * Prüft, ob ein Objekt im gegebenen Zeitraum (bei stundenbasierten
   * Objekten optional inkl. Uhrzeit) noch frei ist - zentrale
   * Verfügbarkeitsprüfung, die von so gut wie jeder anderen
   * abgeleiteten Größe in diesem Hook genutzt wird.
   *
   * @param {string} objektName
   * @param {string} startISO
   * @param {string} endISO
   * @param {string|null} [startZeit] - "HH:MM", nur bei stundenbasierten Objekten relevant
   * @param {string|null} [endZeit] - "HH:MM"
   * @returns {boolean}
   */
  const istVerfuegbar = (objektName, startISO, endISO, startZeit = null, endZeit = null) => {
    const stundenbasiert = istStundenbasiert(objektName);

    return !bestehendeBuchungen.some((b) => {
      if (b.resource?.toLowerCase() !== objektName?.toLowerCase()) return false;

      if (stundenbasiert) {
        // Wenn in Schritt 1 noch keine Uhrzeit gewählt wurde, prüfen wir 00:00 - 23:59 Uhr
        const sZeit = startZeit || "00:00";
        const eZeit = endZeit || "23:59";

        return datumZeitUeberschneidenSich(
          startISO,
          sZeit,
          endISO,
          eZeit,
          b.start,
          b.anreiseZeit || "00:00",
          b.end,
          b.abreiseZeit || "23:59"
        );
      } else {
        return ueberschneidenSich(startISO, endISO, b.start, b.end);
      }
    });
  };

  /** Ob das aktuell gewählte Hauptobjekt im gewählten Zeitraum (+ ggf. Uhrzeit) noch verfügbar ist. */
  const selectedObjektVerfuegbar = useMemo(() => {
    // Wenn das Erfolgs-Modal offen ist, Verfügbarkeitswarnung im Hintergrund unterdrücken
    if (angenommeneBuchungErfolg !== null) return true;

    if (!selectedObjekt || !dateRange.start || !dateRange.end) return true;

    const stundenbasiert = istStundenbasiert(selectedObjekt.name);

    if (!stundenbasiert && isSameDay(dateRange.start, dateRange.end)) {
      return false;
    }

    if (stundenbasiert) {
      // Prüft direkt mit den ausgewählten/automatisch angepassten Uhrzeiten
      return istVerfuegbar(
        selectedObjekt.name,
        startISO,
        endISO,
        zeiten.anreiseZeit,
        zeiten.abreiseZeit
      );
    }

    return istVerfuegbar(selectedObjekt.name, startISO, endISO);
  }, [
    selectedObjekt,
    dateRange.start,
    dateRange.end,
    startISO,
    endISO,
    zeiten,
    istVerfuegbar,
    angenommeneBuchungErfolg,
  ]);

  /** Bereits bestehende Buchungen des gewählten Objekts am gewählten Tag (für den Kollisionshinweis). */
  const tagesBuchungen = useMemo(() => {
    if (!selectedObjekt || !dateRange.start || !dateRange.end) return [];
    return bestehendeBuchungen
      .filter((b) => {
        if (b.resource?.toLowerCase() !== selectedObjekt.name?.toLowerCase()) return false;
        return b.start <= endISO && b.end >= startISO;
      })
      .sort((a, b) => (a.anreiseZeit || "00:00").localeCompare(b.anreiseZeit || "00:00"));
  }, [selectedObjekt, startISO, endISO, bestehendeBuchungen]);

  /** Menschenlesbarer Warntext bei Terminkollision (fasst bis zu 3 Kollisionen konkret zusammen, sonst pauschal). */
  const kollisionsText = useMemo(() => {
    // Wenn das Erfolgs-Modal angezeigt wird, soll kein Kollisionshinweis erscheinen
    if (angenommeneBuchungErfolg !== null || tagesBuchungen.length === 0 || selectedObjektVerfuegbar) return null;

    const objName = selectedObjekt?.name;

    if (istHauptobjektStundenbasiert) {
      // Bei mehr als 3 Kollisionen kompakte Übersicht anzeigen
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
  }, [tagesBuchungen, selectedObjekt, istHauptobjektStundenbasiert, selectedObjektVerfuegbar, angenommeneBuchungErfolg]);

  /** Gesamtdauer des Hauptobjekts in Stunden, nur relevant bei stundenbasierten Objekten. */
  const stundenHauptobjekt = useMemo(() => {
    if (!istHauptobjektStundenbasiert) return 0;
    return berechneStunden(dateRange.start, zeiten.anreiseZeit, dateRange.end, zeiten.abreiseZeit);
  }, [istHauptobjektStundenbasiert, dateRange.start, dateRange.end, zeiten]);

  /** Automatisch berechneter Gesamtpreis des Hauptobjekts, vor manuellem Rabatt. */
  const gesamtpreisBerechnet = useMemo(() => {
    if (!selectedObjekt || !dateRange.start || !dateRange.end) return 0;

    if (istHauptobjektStundenbasiert) {
      return stundenHauptobjekt * selectedObjekt.preisProNacht;
    }

    const reineNaechte = Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
    return selectedObjekt.preisProNacht * reineNaechte;
  }, [selectedObjekt, dateRange.start, dateRange.end, istHauptobjektStundenbasiert, stundenHauptobjekt]);

  /** Rabatt-Prozent-Feld geändert -> Endpreis proportional neu berechnen. */
  const handleRabattChange = (e) => {
    const rawVal = e.target.value;
    if (rawVal === "") {
      setRabattProzent("");
      setEndpreisManuell(gesamtpreisBerechnet.toFixed(2));
      return;
    }

    let num = parseFloat(rawVal.replace(",", "."));
    if (isNaN(num)) return;

    num = Math.max(0, Math.min(100, num));
    setRabattProzent(num.toString());

    const neuerEndpreis = gesamtpreisBerechnet * (1 - num / 100);
    setEndpreisManuell(neuerEndpreis.toFixed(2));
  };

  /** Endpreis-Feld manuell geändert -> passenden Rabatt-Prozentsatz zurückrechnen (umgekehrte Richtung zu handleRabattChange). */
  const handleEndpreisChange = (e) => {
    const rawVal = e.target.value;
    setEndpreisManuell(rawVal);

    const neuerPreis = parseFloat(rawVal.replace(",", "."));
    if (!isNaN(neuerPreis) && gesamtpreisBerechnet > 0) {
      if (neuerPreis < 0) return;

      let berechneterRabatt = ((gesamtpreisBerechnet - neuerPreis) / gesamtpreisBerechnet) * 100;
      berechneterRabatt = Math.max(0, Math.min(100, berechneterRabatt));

      setRabattProzent(
        berechneterRabatt % 1 === 0 ? berechneterRabatt.toFixed(0) : berechneterRabatt.toFixed(1)
      );
    } else if (rawVal === "") {
      setRabattProzent("0");
    }
  };

  // Hält den Endpreis synchron, sobald sich der automatisch berechnete
  // Grundpreis ändert (z.B. weil Zeitraum/Objekt gewechselt wurde), ohne
  // den aktuell gesetzten Rabatt zu verlieren.
  useEffect(() => {
    const rabatt = parseFloat(rabattProzent?.toString().replace(",", ".")) || 0;
    const berechnet = gesamtpreisBerechnet * (1 - rabatt / 100);
    setEndpreisManuell(berechnet.toFixed(2));
  }, [gesamtpreisBerechnet, rabattProzent]);

  /** Der tatsächlich zu zahlende Endpreis (manuelles Feld hat Vorrang, mit Fallback auf den berechneten Preis). */
  const effektiverEndpreis = useMemo(() => {
    const p = parseFloat(endpreisManuell?.toString().replace(",", "."));
    return !isNaN(p) ? p : gesamtpreisBerechnet;
  }, [endpreisManuell, gesamtpreisBerechnet]);

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
   * bei stundenbasierten Objekten.
   */
  const verfuegbareObjekte = useMemo(() => {
    return objektStammdaten.map((obj) => {
      const hatStart = dateRange.start !== null;
      const hatEnd = dateRange.end !== null;
      const gueltigerZeitraum = hatStart && hatEnd;
      const stundenbasiert = istStundenbasiert(obj.name);

      const dauer = gueltigerZeitraum
        ? Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24))
        : 0;

      let status;
      let info;
      let preis = null;

      const checkinPasst = !gueltigerZeitraum || stundenbasiert || entsprichtWochentag(dateRange.start, CHECKIN_WOCHENTAG);
      const checkoutPasst = !gueltigerZeitraum || stundenbasiert || entsprichtWochentag(dateRange.end, CHECKOUT_WOCHENTAG);
      if (gueltigerZeitraum && !stundenbasiert && (!checkinPasst || !checkoutPasst)) {
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
      } else if (gueltigerZeitraum && !stundenbasiert && dauer < MINDEST_NAECHTE_WOHNUNG) {
        status = "nicht verfügbar";
        info = `Mindestaufenthalt: ${MINDEST_NAECHTE_WOHNUNG} Nächte`;
      } else if (!gueltigerZeitraum) {
        // ZENTRALE LIVE-VERFÜGBARKEIT: berücksichtigt lückenlose Anschlussbuchungen und Tagesanreisen
        const live = berechneLiveVerfuegbarkeit(obj.name, bestehendeBuchungen, einstellungen);
        status = live.status;
        info = live.info;
      } else {
          if (stundenbasiert) {
            const istMehrtaegig = startISO !== endISO;

            if (!istMehrtaegig) {
              // Prüft, ob zwischen 06:00 und 22:00 mindestens 1 Stunde frei ist
              const freieSlots = ermittleFreieStundenSlots(obj.name, startISO, bestehendeBuchungen, 60, "06:00", "22:00");
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
                  const tagesBelegungen = bestehendeBuchungen.filter(
                    (b) => b.resource?.toLowerCase() === obj.name?.toLowerCase() && b.start <= endISO && b.end >= startISO
                  );
                  info = tagesBelegungen.length > 0
                    ? "Für Standardzeit (09:00–17:00) verfügbar"
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
            preis = obj.preisProNacht * dauer;
            info = verfuegbar ? "Im gewählten Zeitraum verfügbar" : "Im Zeitraum belegt";
          }
      }

      return { ...obj, status, info, preis };
    });
  }, [
    objektStammdaten,
    bestehendeBuchungen,
    startISO,
    endISO,
    dateRange.start,
    dateRange.end,
    istVerfuegbar,
    MINDEST_NAECHTE_WOHNUNG,
    CHECKIN_WOCHENTAG,
    CHECKOUT_WOCHENTAG,
    einstellungen,
  ]);

  // Buchung ist ungültig, wenn: das Objekt kollidiert, ODER eine Wohnung
  // den geforderten Checkin-/Checkout-Wochentag nicht einhält, ODER
  // die Mindestaufenthaltsdauer unterschreitet, ODER bei stundenbasierten
  // Objekten Rückgabe- vor Abholzeit liegt (bzw. 0 Stunden Dauer).
  const istBuchungUngueltig =
    !selectedObjektVerfuegbar ||
    (istHauptobjektWohnung && !checkinWochentagPasst) ||
    (istHauptobjektWohnung && !checkoutWochentagPasst) ||
    (!istHauptobjektStundenbasiert && naechteAnz < MINDEST_NAECHTE_WOHNUNG) ||
    (istHauptobjektStundenbasiert && stundenHauptobjekt <= 0);

  /**
   * Wählt ein Objekt in Schritt 1 aus, passt Start/Ende automatisch an
   * den Objekttyp an (stundenbasiert -> gleicher Tag, Wohnung ->
   * mindestens 1 Folgetag) und schlägt bei stundenbasierten Objekten
   * automatisch die nächste freie Uhrzeit vor, falls die Standardzeit
   * (09:00-17:00) am gewählten Tag schon belegt ist.
   *
   * @param {object} obj - Objekt aus verfuegbareObjekte
   * @returns {void}
   */
  const handleSelectObjekt = (obj) => {
    setSelectedObjekt(obj);

    let start = dateRange.start;
    let end = dateRange.end;

    // Automatische Anpassung von Start & Ende je nach Typ
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

    // Beide ISO-Variablen sauber definieren:
    const aktuellesStartISO = toISO(start);

    if (istStundenbasiert(obj.name) && start) {
      const besterSlot = findeBestenFreienSlot(
        obj.name,
        aktuellesStartISO,
        bestehendeBuchungen,
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
    navigate("/buchen/neu");
  };

  /**
   * Speichert Gast (neu oder aktualisiert) und die Buchung, erstellt
   * automatisch die Rechnung und setzt den Assistenten anschließend in
   * den Erfolgs-Zustand (angenommeneBuchungErfolg).
   *
   * @returns {Promise<void>}
   */
  const handleFinalizeBooking = async () => {
    setIsSaving(true);
    try {
      const gastPayload = {
        name: guestData.name,
        email: guestData.email,
        telnr: guestData.telefon,
        strasse: guestData.strasse,
        hnr: guestData.hausnummer,
        plz: guestData.plz,
        stadt: guestData.stadt,
        land: guestData.land,
      };

      let gastId;

      if (matchedGuestId) {
        const updateRes = await fetch(`${GAESTE_API}/${matchedGuestId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gastPayload),
        });
        if (!updateRes.ok) throw new Error("Gast konnte nicht aktualisiert werden");
        gastId = matchedGuestId;
      } else {
        const createRes = await fetch(GAESTE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gastPayload),
        });
        if (!createRes.ok) throw new Error("Gast konnte nicht angelegt werden");
        const neuerGast = await createRes.json();
        gastId = neuerGast.id;
      }

      const endpreisZahl =
        parseFloat(endpreisManuell.toString().replace(",", ".")) || gesamtpreisBerechnet;

      const buchungPayload = {
        gast_id: gastId,
        objekt_id: selectedObjekt.id,
        anreise: formatDe(dateRange.start),
        abreise: formatDe(dateRange.end),
        infos: bookingDetails.info || null,
        preis: endpreisZahl,
        pkw: istHauptobjektStundenbasiert ? null : (bookingDetails.pkw?.trim() || "keine angegeben"),        
        erwachsene: istWohnung(selectedObjekt?.name) ? guestCounts.erwachsene : null,
        kinder: istWohnung(selectedObjekt?.name) ? guestCounts.kinder : null,
      };

      if (istHauptobjektStundenbasiert) {
        buchungPayload.anreise_zeit = zeiten.anreiseZeit;
        buchungPayload.abreise_zeit = zeiten.abreiseZeit;
      } else {
        // Wohnungen bekommen immer die zentralen Check-in/-out-Zeiten
        // aus den Einstellungen
        buchungPayload.anreise_zeit = einstellungen.checkin_zeit;
        buchungPayload.abreise_zeit = einstellungen.checkout_zeit;
      }

      const buchungRes = await fetch(BUCHUNGEN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buchungPayload),
      });
      if (!buchungRes.ok) {
        const fehlerText = await buchungRes.text();
        throw new Error(`Buchung konnte nicht gespeichert werden (${buchungRes.status}): ${fehlerText}`);
      }
      const neueBuchung = await buchungRes.json();

      let erzeugteRechnungsnummer = null;
      let erzeugteRechnungId = null;
      try {
        const rechnungRes = await fetch(RECHNUNGEN_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buchung_id: neueBuchung.id,
            rechnungs_datum: formatDe(dateRange.end),
          }),
        });
        if (rechnungRes.ok) {
          const neueRechnung = await rechnungRes.json();
          erzeugteRechnungsnummer = neueRechnung.rechnungs_nummer;
          erzeugteRechnungId = neueRechnung.id;
        }
      } catch (rechnungErr) {
        console.error("Buchen: Rechnung konnte nicht automatisch erstellt werden:", rechnungErr);
      }

      setAngenommeneBuchungErfolg({
        gastName: guestData.name,
        buchungId: neueBuchung.id,
        rechnungId: erzeugteRechnungId,
        rechnungsNummer: erzeugteRechnungsnummer,
      });

      await ladeStammdaten();
    } catch (err) {
      console.error("Buchen: Fehler beim Speichern:", err);
      showToast("error", `Speichern fehlgeschlagen: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * FullCalendar-Klick-Handler für den Sidebar-Kalender: verzweigt je
   * nachdem, ob bereits ein Objekt gewählt ist (dann wird nur der
   * Zeitraum neu gesetzt, mit passender Logik für stundenbasiert vs.
   * Wohnung) oder ob wir uns noch in der reinen Zeitraum-Auswahl von
   * Schritt 1 befinden (Start-/Enddatum schrittweise setzen).
   *
   * @param {{date: Date}} info - FullCalendar dateClick-Event-Info
   * @returns {void}
   */
  const handleDateClick = (info) => {
    const clickedDate = info.date;
    if (isPastDate(clickedDate)) return;

    if (dateRange.start && !dateRange.end) {
      if (clickedDate < dateRange.start) {
        // Klick liegt vor der Anreise -> Anreise auf diesen Tag umsetzen
        setDateRange({ start: clickedDate, end: null });
      } else {
        // 2. Klick: Abreisedatum setzen (egal ob gleicher Tag bei Bus oder Folgetage bei Wohnungen)
        setDateRange({ start: dateRange.start, end: clickedDate });
        setHoveredDate(null);
      }
    } else {
      // 1. Klick: Neues Anreisedatum wählen, Abreise leeren
      setDateRange({ start: clickedDate, end: null });
      setHoveredDate(null);
    
    }
  };

  /** Setzt die Zeitraumauswahl komplett zurück (Kalender "× Auswahl aufheben"). */
  const handleClearSelection = () => {
    setDateRange({ start: null, end: null });
    setHoveredDate(null);
  };

  /** Setzt den kompletten Assistenten auf den Ausgangszustand zurück und navigiert zur Übersicht - z.B. nach "Fertig/Schließen" im Erfolgs-Modal. */
  const resetAssistent = () => {
    setWizardStep(2);
    setSelectedObjekt(null);
    setDateRange({ start: null, end: null });
    setGuestData({
      name: "",
      email: "",
      telefon: "",
      strasse: "",
      hausnummer: "",
      plz: "",
      stadt: "",
      land: "Österreich",
    });
    setMatchedGuestId(null);
    setBookingDetails({ pkw: "", info: "" });
    setRabattProzent("0");
    setAngenommeneBuchungErfolg(null);
    navigate("/buchen");
  };

  return {
    navigate,
    istNeueBuchungRoute,
    wizardStep,
    setWizardStep,
    apiLoading,
    apiError,
    isSaving,
    dateRange,
    hoveredDate,
    setHoveredDate,
    handleDateClick,
    handleClearSelection,
    guestCounts,
    setGuestCounts,
    isGuestPopupOpen,
    setIsGuestPopupOpen,
    naechteAnz,
    handleRabattChange,
    handleEndpreisChange,
    effektiverEndpreis,
    objektStammdaten,
    verfuegbareObjekte,
    istVerfuegbar,
    kollisionsText,
    startISO,
    endISO,
    selectedObjekt,
    setSelectedObjekt,
    istHauptobjektStundenbasiert,
    istHauptobjektWohnung,
    handleSelectObjekt,
    selectedObjektVerfuegbar,
    guestData,
    setGuestData,
    handleGuestChange,
    matchedGuestId,
    isGuestSuggestOpen,
    guestSuggestRef,
    gastVorschlaege,
    handleSelectGuestSuggestion,
    zeiten,
    setZeiten,
    stundenHauptobjekt,
    MINDEST_NAECHTE_WOHNUNG,
    CHECKIN_WOCHENTAG,
    CHECKOUT_WOCHENTAG,
    checkinWochentagPasst,
    checkoutWochentagPasst,
    startWochentag: getWochentagName(dateRange.start),
    endWochentag: getWochentagName(dateRange.end),
    bookingDetails,
    setBookingDetails,
    rabattProzent,
    setRabattProzent,
    endpreisManuell,
    setEndpreisManuell,
    gesamtpreisBerechnet,
    istBuchungUngueltig,
    handleFinalizeBooking,
    toast,
    dismissToast,
    angenommeneBuchungErfolg,
    setAngenommeneBuchungErfolg,
    resetAssistent,
  };
}