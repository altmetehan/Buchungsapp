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
  istBus,
  datumZeitUeberschneidenSich,
} from "../utils/javaUtils";
import { useEinstellungen } from "./useEinstellungen";

const OBJEKTE_API = "/api/objekte";
const OEFFENTLICHE_BUCHUNGEN_API = "/api/buchungen/oeffentlich";
const ANFRAGEN_API = "/api/anfragen";

// Standard-Zeitfenster für JEDE Verfügbarkeitsprüfung eines
// stundenbasierten Objekts (Schritt 1-Liste UND Objektauswahl) - siehe
// ausführlichen Kommentar dazu in useBuchungsAssistent.js. Bewusst NICHT
// der "zeiten"-State, da der noch von einer vorherigen Objekt-/
// Datumsauswahl eine andere Uhrzeit enthalten kann.
const STANDARD_ANREISE_ZEIT = "09:00";
const STANDARD_ABREISE_ZEIT = "17:00";

const LEERES_GASTFORMULAR = {
  name: "", email: "", telnr: "", strasse: "", hausnummer: "", plz: "", stadt: "", land: "Österreich",
};

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

function toGermanDate(date) {
  if (!date) return "";
  const tag = String(date.getDate()).padStart(2, "0");
  const monat = String(date.getMonth() + 1).padStart(2, "0");
  return `${tag}.${monat}.${date.getFullYear()}`;
}

export function usePortalAnfrage() {
  const { einstellungen } = useEinstellungen();
  const MINDEST_NAECHTE_WOHNUNG = einstellungen.mindest_naechte_wohnung;
  const ZUSATZOBJEKT_KOMBI_RABATT_PROZENT = einstellungen.kombirabatt ?? 0;

  const [wizardStep, setWizardStep] = useState(1);

  const [objektStammdaten, setObjektStammdaten] = useState([]);
  const [belegungen, setBelegungen] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [hoveredDate, setHoveredDate] = useState(null);

  const [guestCounts, setGuestCounts] = useState({ erwachsene: 2, kinder: 0 });
  const [isGuestPopupOpen, setIsGuestPopupOpen] = useState(false);

  const [selectedObjekt, setSelectedObjekt] = useState(null);

  const [zeiten, setZeiten] = useState({ anreiseZeit: STANDARD_ANREISE_ZEIT, abreiseZeit: STANDARD_ABREISE_ZEIT });

  const [bookingDetails, setBookingDetails] = useState({
    zusatzobjektMieten: "Nein",
    kennzeichen: "",
    info: "",
  });

  const [gastData, setGastData] = useState(LEERES_GASTFORMULAR);
  const [nachricht, setNachricht] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [wurdeGesendet, setWurdeGesendet] = useState(false);
  const [toast, setToast] = useState(null);
  const [sendError, setSendError] = useState(false);

  const showToast = (type, message) => setToast({ type, message });
  const dismissToast = () => setToast(null);

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
          [b.Objekte, b.ObjekteZusatz].forEach((obj) => {
            if (!obj) return;
            flach.push({
              name: obj.name,
              start: germanToISO(b.anreise),
              end: germanToISO(b.abreise),
              anreiseZeit: b.anreise_zeit,
              abreiseZeit: b.abreise_zeit
            });
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

  const handleDateClick = useCallback((info) => {
    const clicked = info.date;
    if (isPastDate(clicked)) return;

    setDateRange((prev) => {
      if (!prev.start || (prev.start && prev.end)) return { start: clicked, end: null };
      if (clicked < prev.start) return { start: clicked, end: prev.start };
      return { start: prev.start, end: clicked };
    });
  }, []);

  const handleClearSelection = () => {
    setDateRange({ start: null, end: null });
    setSelectedObjekt(null);
  };

  const startISO = dateRange.start ? toISO(dateRange.start) : "";
  const endISO = dateRange.end ? toISO(dateRange.end) : "";

  const naechteAnz = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return 0;
    return Math.max(1, Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)));
  }, [dateRange]);

  // Berücksichtigt Uhrzeiten bei stundenbasierten Objekten (identisch zur Admin-Prüfung).
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

  const freieZusatzobjekte = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    const checkin = einstellungen.checkin_zeit || "15:00";
    const checkout = einstellungen.checkout_zeit || "11:00";

    return objektStammdaten
      .filter((o) => istBus(o.name))
      .filter((o) => istVerfuegbar(o.name, startISO, endISO, checkin, checkout))
      .sort((a, b) => a.preisProNacht - b.preisProNacht);
  }, [objektStammdaten, dateRange.start, dateRange.end, startISO, endISO, istVerfuegbar, einstellungen]);

  const zusatzobjektVerfuegbar = freieZusatzobjekte.length > 0;

  const zugewiesenesZusatzobjekt = useMemo(() => {
    if (bookingDetails.zusatzobjektMieten !== "Ja" || !zusatzobjektVerfuegbar) return null;
    return freieZusatzobjekte[0];
  }, [bookingDetails.zusatzobjektMieten, zusatzobjektVerfuegbar, freieZusatzobjekte]);

  const istHauptobjektWohnung = istWohnung(selectedObjekt?.name);
  const istHauptobjektStundenbasiert = istStundenbasiert(selectedObjekt?.name);

  const stundenHauptobjekt = useMemo(() => {
    if (!istHauptobjektStundenbasiert) return 0;
    return berechneStunden(dateRange.start, zeiten.anreiseZeit, dateRange.end, zeiten.abreiseZeit);
  }, [istHauptobjektStundenbasiert, dateRange.start, dateRange.end, zeiten]);

  const gesamtpreisBerechnet = useMemo(() => {
    if (!selectedObjekt || !dateRange.start || !dateRange.end) return 0;

    const einzelpreis = selectedObjekt.preisProNacht || selectedObjekt.preis || 0;

    if (istHauptobjektStundenbasiert) {
      return stundenHauptobjekt * einzelpreis;
    }

    const basis = naechteAnz * einzelpreis;

    let zusatzAufpreis = 0;
    if (bookingDetails.zusatzobjektMieten === "Ja" && zugewiesenesZusatzobjekt) {
      const checkin = einstellungen.checkin_zeit || "15:00";
      const checkout = einstellungen.checkout_zeit || "11:00";

      const zusatzStunden = berechneStunden(
        dateRange.start,
        checkin,
        dateRange.end,
        checkout
      );

      const busStundensatz = zugewiesenesZusatzobjekt.preisProNacht || zugewiesenesZusatzobjekt.preis || 0;
      const zusatzPreisRegulaer = zusatzStunden * busStundensatz;

      const rabattFaktor = 1 - (ZUSATZOBJEKT_KOMBI_RABATT_PROZENT / 100);
      zusatzAufpreis = zusatzPreisRegulaer * rabattFaktor;
    }

    return basis + zusatzAufpreis;
  }, [
    selectedObjekt,
    dateRange.start,
    dateRange.end,
    istHauptobjektStundenbasiert,
    stundenHauptobjekt,
    naechteAnz,
    bookingDetails.zusatzobjektMieten,
    zugewiesenesZusatzobjekt,
    ZUSATZOBJEKT_KOMBI_RABATT_PROZENT,
    einstellungen.checkin_zeit,
    einstellungen.checkout_zeit,
  ]);

  const verfuegbareObjekte = useMemo(() => {
    const hatStart = dateRange.start !== null;
    const hatEnd = dateRange.end !== null;
    const gueltigerZeitraum = hatStart && hatEnd;
    const todayISO = toISO(new Date());

    return objektStammdaten.map((obj) => {
      const stundenbasiert = istStundenbasiert(obj.name);
      const wohnung = istWohnung(obj.name);

      let status;
      let info;
      let preis = null;

      if (gueltigerZeitraum && wohnung && naechteAnz < MINDEST_NAECHTE_WOHNUNG) {
        status = "nicht verfügbar";
        info = `Mindestaufenthalt: ${MINDEST_NAECHTE_WOHNUNG} Nächte`;
        preis = null;
      } else if (!gueltigerZeitraum) {
        const activeBooking = belegungen.find(
          (b) =>
            b.name?.toLowerCase() === obj.name?.toLowerCase() &&
            b.start <= todayISO &&
            b.end > todayISO
        );

        if (activeBooking) {
          status = "belegt";
          info = `Belegt bis ${formatDe(parseISO(activeBooking.end))}`;
        } else {
          const futureBookings = belegungen
            .filter((b) => b.name?.toLowerCase() === obj.name?.toLowerCase() && b.start > todayISO)
            .sort((a, b) => a.start.localeCompare(b.start));

          status = "frei";
          info =
            futureBookings.length > 0
              ? `Frei bis ${formatDe(parseISO(futureBookings[0].start))}`
              : "Durchgehend frei";
        }
        preis = null;
      } else {
          if (stundenbasiert) {
          // b.name OR b.resource prüfen, damit Haupt- und Zusatzobjekte sicher gefunden werden
          const tagesBelegungen = belegungen.filter(
            (b) => (b.name || b.resource)?.toLowerCase() === obj.name?.toLowerCase() && b.start <= endISO && b.end >= startISO
          );

          // WICHTIG: fest mit der Standardzeit prüfen, nicht mit dem
          // "zeiten"-State (siehe Kommentar am Kopf dieser Datei) -
          // sonst kann eine von einer früheren Auswahl übrig gebliebene
          // Uhrzeit einen tatsächlichen Konflikt verschleiern.
          const verfuegbarFuerUhrzeit = istVerfuegbar(
            obj.name,
            startISO,
            endISO,
            STANDARD_ANREISE_ZEIT,
            STANDARD_ABREISE_ZEIT
          );
          // Objekt ist ganztägig belegt, wenn eine mehrtägige Buchung (z.B. Wohnungs-Zusatzbus) über diesen Tag geht
          const durchgehendBelegt = tagesBelegungen.some(
            (b) => (b.anreiseZeit === "00:00" && b.abreiseZeit === "23:59") || !b.anreiseZeit || (b.start < startISO && b.end > endISO)
          );
          const istMehrtaegig = startISO !== endISO;

          if (verfuegbarFuerUhrzeit) {
            status = "verfügbar";
            info = tagesBelegungen.length > 0
              ? "Für gewählte Uhrzeit verfügbar"
              : "Im gewählten Zeitraum verfügbar";
            preis = null;
          } else if (istMehrtaegig || durchgehendBelegt) {
            status = "nicht verfügbar";
            info = durchgehendBelegt
              ? "Im gewählten Zeitraum ganztägig belegt"
              : "Im gewählten Zeitraum belegt";
            preis = null;
          } else {
            status = "verfügbar";
            info = "Teilweise belegt (Uhrzeit in Schritt 2 anpassbar)";
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
  ]);

  const unterschreitetMindestNaechte =
    istHauptobjektWohnung && naechteAnz < MINDEST_NAECHTE_WOHNUNG;

  const handleSelectObjekt = (obj) => {
    setSelectedObjekt(obj);

    if (istStundenbasiert(obj.name) && dateRange.start && dateRange.end) {
      // Siehe ausführlichen Kommentar in useBuchungsAssistent.js: immer
      // von der festen Standardzeit ausgehen statt vom evtl. noch
      // veralteten "zeiten"-State, und am Ende IMMER explizit setZeiten
      // aufrufen (auch als expliziter Reset auf die Standardzeit, falls
      // keine Alternativzeit gefunden wurde).
      const istStandardFrei = istVerfuegbar(
        obj.name,
        startISO,
        endISO,
        STANDARD_ANREISE_ZEIT,
        STANDARD_ABREISE_ZEIT
      );

      if (istStandardFrei) {
        setZeiten({ anreiseZeit: STANDARD_ANREISE_ZEIT, abreiseZeit: STANDARD_ABREISE_ZEIT });
      } else {
        const tagesBelegungen = belegungen.filter(
          (b) => b.name?.toLowerCase() === obj.name?.toLowerCase() && b.start <= endISO && b.end >= startISO
        );

        let neueZeitGefunden = false;

        if (tagesBelegungen.length > 0) {
          const sortiert = [...tagesBelegungen].sort((a, b) =>
            (b.abreiseZeit || "23:59").localeCompare(a.abreiseZeit || "23:59")
          );
          const naechsteFreieZeit = sortiert[0].abreiseZeit;

          if (naechsteFreieZeit && naechsteFreieZeit < "22:00") {
            const [h, m] = naechsteFreieZeit.split(":").map(Number);
            const endH = Math.min(23, h + 4);
            const endZeitStr = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

            if (istVerfuegbar(obj.name, startISO, endISO, naechsteFreieZeit, endZeitStr)) {
              setZeiten({ anreiseZeit: naechsteFreieZeit, abreiseZeit: endZeitStr });
              neueZeitGefunden = true;
            }
          }
        }

        if (!neueZeitGefunden) {
          setZeiten({ anreiseZeit: STANDARD_ANREISE_ZEIT, abreiseZeit: STANDARD_ABREISE_ZEIT });
        }
      }
    }

    setWizardStep(2);
  };

  // ─── GEBUCHTE UHRZEITEN AM GEWÄHLTEN TAG ERFASSEN ───
  const tagesBuchungen = useMemo(() => {
    if (!selectedObjekt || !dateRange.start || !dateRange.end) return [];
    return belegungen
      .filter((b) => {
        if (b.name?.toLowerCase() !== selectedObjekt.name?.toLowerCase()) return false;
        return b.start <= endISO && b.end >= startISO;
      })
      .sort((a, b) => (a.anreiseZeit || "00:00").localeCompare(b.anreiseZeit || "00:00"));
  }, [selectedObjekt, startISO, endISO, belegungen]);

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

  // ─── KOLLISIONSTEXT  ───
  const kollisionsText = useMemo(() => {
    if (tagesBuchungen.length === 0 || selectedObjektVerfuegbar) return null;

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
  }, [tagesBuchungen, selectedObjekt, istHauptobjektStundenbasiert, selectedObjektVerfuegbar]);

  const handleGastChange = (e) => {
    setGastData({ ...gastData, [e.target.name]: e.target.value });
  };

  const istAnfrageUngueltig =
    !selectedObjekt ||
    !dateRange.start ||
    !dateRange.end ||
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

  const handleSubmitAnfrage = async (e) => {
    if (e) e.preventDefault();
    if (istAnfrageUngueltig) {
      showToast("error", "Bitte alle Pflichtfelder ausfüllen.");
      return;
    }

    setIsSaving(true);
    setSendError(false);
    try {
      const zusatzobjektGebucht =
        !istHauptobjektStundenbasiert &&
        bookingDetails.zusatzobjektMieten === "Ja" &&
        zugewiesenesZusatzobjekt;

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
        objekt_id_2: zusatzobjektGebucht ? zugewiesenesZusatzobjekt.id : null,
        anreise: toGermanDate(dateRange.start),
        abreise: toGermanDate(dateRange.end),
        anreise_zeit: istHauptobjektStundenbasiert ? zeiten.anreiseZeit : einstellungen.checkin_zeit,
        abreise_zeit: istHauptobjektStundenbasiert ? zeiten.abreiseZeit : einstellungen.checkout_zeit,
        erwachsene: istWohnung(selectedObjekt?.name) ? guestCounts.erwachsene : null,
        kinder: istWohnung(selectedObjekt?.name) ? guestCounts.kinder : null,
        infos: nachricht || null,
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

  const handleNeueAnfrage = () => {
    setWizardStep(1);
    setDateRange({ start: null, end: null });
    setSelectedObjekt(null);
    setGastData(LEERES_GASTFORMULAR);
    setGuestCounts({ erwachsene: 2, kinder: 0 });
    setZeiten({ anreiseZeit: STANDARD_ANREISE_ZEIT, abreiseZeit: STANDARD_ABREISE_ZEIT });
    setBookingDetails({ zusatzobjektMieten: "Nein", kennzeichen: "", info: "" });
    setNachricht("");
    setWurdeGesendet(false);
    setSendError(false);
  };

  return {
    wizardStep, setWizardStep,
    apiLoading, apiError,
    dateRange, hoveredDate, setHoveredDate, handleDateClick, handleClearSelection,
    guestCounts, setGuestCounts, isGuestPopupOpen, setIsGuestPopupOpen,
    startISO, endISO, naechteAnz,
    verfuegbareObjekte, handleSelectObjekt,
    selectedObjekt, setSelectedObjekt, selectedObjektVerfuegbar, istVerfuegbar,
    objektStammdaten, gesamtpreisBerechnet, istHauptobjektWohnung, istHauptobjektStundenbasiert,
    zeiten, setZeiten, stundenHauptobjekt,
    bookingDetails, setBookingDetails, zusatzobjektVerfuegbar, zugewiesenesZusatzobjekt,
    gastData, setGastData, handleGastChange,
    nachricht, setNachricht,
    isSaving, wurdeGesendet, sendError, setSendError, handleSubmitAnfrage, handleNeueAnfrage, istAnfrageUngueltig,
    kollisionsText,
    toast, dismissToast,
    MINDEST_NAECHTE_WOHNUNG,
    unterschreitetMindestNaechte,
    ZUSATZOBJEKT_KOMBI_RABATT_PROZENT
  };
}