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
  istBus,
  datumZeitUeberschneidenSich,
  getNowIsoWithTime,
  entsprichtWochentag,
  getWochentagName,
  berechneLiveVerfuegbarkeit,
} from "../utils/javaUtils";
import { useEinstellungen } from "./useEinstellungen";
import { useToast } from "./useToast";

const OBJEKTE_API = "/api/objekte";
const BUCHUNGEN_API = "/api/buchungen";
const GAESTE_API = "/api/gaeste";
const RECHNUNGEN_API = "/api/rechnungen";

const STANDARD_ANREISE_ZEIT = "09:00";
const STANDARD_ABREISE_ZEIT = "17:00";

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

export function useBuchungsAssistent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { einstellungen } = useEinstellungen();
  const MINDEST_NAECHTE_WOHNUNG = einstellungen.mindest_naechte_wohnung;
  const ZUSATZOBJEKT_KOMBI_RABATT_PROZENT = einstellungen.kombirabatt;
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

  const handleGuestChange = (e) => {
    const { name, value } = e.target;
    setGuestData((prev) => ({ ...prev, [name]: value }));
    if (name === "name") {
      setMatchedGuestId(null);
      setIsGuestSuggestOpen(true);
    }
  };

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
    zusatzobjektMieten: "Nein",
    kennzeichen: "",
    info: "",
  });

  const [rabattProzent, setRabattProzent] = useState("0");
  const [endpreisManuell, setEndpreisManuell] = useState("");

  const { toast, showToast, dismissToast } = useToast();

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
        if (b.ObjekteZusatz) {
          belegungen.push({ resource: b.ObjekteZusatz.name, start, end, anreiseZeit, abreiseZeit });
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

  useEffect(() => {
    if (istNeueBuchungRoute && !selectedObjekt && objektStammdaten.length > 0) {
      navigate("/buchen", { replace: true });
    }
  }, [istNeueBuchungRoute, selectedObjekt, navigate, objektStammdaten]);

  // ─── VERFÜGBARKEITSPRÜFUNG ───
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

  // ─── GEBUCHTE UHRZEITEN AM GEWÄHLTEN TAG ERFASSEN ───
  const tagesBuchungen = useMemo(() => {
    if (!selectedObjekt || !dateRange.start || !dateRange.end) return [];
    return bestehendeBuchungen
      .filter((b) => {
        if (b.resource?.toLowerCase() !== selectedObjekt.name?.toLowerCase()) return false;
        return b.start <= endISO && b.end >= startISO;
      })
      .sort((a, b) => (a.anreiseZeit || "00:00").localeCompare(b.anreiseZeit || "00:00"));
  }, [selectedObjekt, startISO, endISO, bestehendeBuchungen]);

  // ─── KOLLISIONSTEXT ───
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

  const stundenHauptobjekt = useMemo(() => {
    if (!istHauptobjektStundenbasiert) return 0;
    return berechneStunden(dateRange.start, zeiten.anreiseZeit, dateRange.end, zeiten.abreiseZeit);
  }, [istHauptobjektStundenbasiert, dateRange.start, dateRange.end, zeiten]);

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

  // ─── BERECHNETER PREIS ───
  const gesamtpreisBerechnet = useMemo(() => {
    if (!selectedObjekt || !dateRange.start || !dateRange.end) return 0;

    if (istHauptobjektStundenbasiert) {
      return stundenHauptobjekt * selectedObjekt.preisProNacht;
    }

    const reineNaechte = Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
    const basis = selectedObjekt.preisProNacht * reineNaechte;

    let zusatzAufpreis = 0;
    if (bookingDetails.zusatzobjektMieten === "Ja" && zugewiesenesZusatzobjekt) {
      // der tatsächlich gebuchten Dauer ab.
      const zusatzStunden = berechneStunden(
        dateRange.start,
        einstellungen.checkin_zeit,
        dateRange.end,
        einstellungen.checkout_zeit
      );
      const zusatzPreisRegulaer = zusatzStunden * zugewiesenesZusatzobjekt.preisProNacht;
      zusatzAufpreis = zusatzPreisRegulaer * (1 - ZUSATZOBJEKT_KOMBI_RABATT_PROZENT / 100);
    }

    return basis + zusatzAufpreis;
  }, [
    selectedObjekt,
    dateRange.start,
    dateRange.end,
    istHauptobjektStundenbasiert,
    stundenHauptobjekt,
    bookingDetails.zusatzobjektMieten,
    zugewiesenesZusatzobjekt,
    ZUSATZOBJEKT_KOMBI_RABATT_PROZENT,
    einstellungen.checkin_zeit,
    einstellungen.checkout_zeit,
  ]);

  // ─── HANDLER FÜR RABATT & ENDPREIS ───
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

  useEffect(() => {
    const rabatt = parseFloat(rabattProzent?.toString().replace(",", ".")) || 0;
    const berechnet = gesamtpreisBerechnet * (1 - rabatt / 100);
    setEndpreisManuell(berechnet.toFixed(2));
  }, [gesamtpreisBerechnet, rabattProzent]);

  const effektiverEndpreis = useMemo(() => {
    const p = parseFloat(endpreisManuell?.toString().replace(",", "."));
    return !isNaN(p) ? p : gesamtpreisBerechnet;
  }, [endpreisManuell, gesamtpreisBerechnet]);

  // ─── WOCHENTAGS-PRÜFUNG ───
  const checkinWochentagPasst = useMemo(() => {
    return entsprichtWochentag(dateRange.start, CHECKIN_WOCHENTAG);
  }, [dateRange.start, CHECKIN_WOCHENTAG]);

  const checkoutWochentagPasst = useMemo(() => {
    return entsprichtWochentag(dateRange.end, CHECKOUT_WOCHENTAG);
  }, [dateRange.end, CHECKOUT_WOCHENTAG]);

  // ─── VERFÜGBARE OBJEKTE FÜR SCHRITT 1 (erlaubt stundenbasierte Teilbelegung am selben Tag) ───
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
        if (!checkinPasst && !checkoutPasst && CHECKIN_WOCHENTAG === CHECKOUT_WOCHENTAG) {
          info = `Nur ${CHECKIN_WOCHENTAG} bis ${CHECKOUT_WOCHENTAG} buchbar`;
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
          const tagesBelegungen = bestehendeBuchungen.filter(
            (b) => b.resource?.toLowerCase() === obj.name?.toLowerCase() && b.start <= endISO && b.end >= startISO
          );

          const verfuegbarFuerUhrzeit = istVerfuegbar(
            obj.name,
            startISO,
            endISO,
            STANDARD_ANREISE_ZEIT,
            STANDARD_ABREISE_ZEIT
          );
          const durchgehendBelegt = tagesBelegungen.some(
            (b) => (b.anreiseZeit === "00:00" && b.abreiseZeit === "23:59") || !b.anreiseZeit || (b.start < startISO && b.end > endISO)
          );
          const istMehrtaegig = startISO !== endISO;

          if (verfuegbarFuerUhrzeit) {
            status = "verfügbar";
            info = tagesBelegungen.length > 0
              ? "Für gewählte Uhrzeit verfügbar"
              : "Im gewählten Zeitraum verfügbar";
            preis = null; // <-- IMMER null, damit im 1. Schritt der Stundensatz ("3,00 € / Std.") steht!
          } else if (istMehrtaegig || durchgehendBelegt) {
            status = "nicht verfügbar";
            info = durchgehendBelegt
              ? "Im gewählten Zeitraum ganztägig belegt"
              : "Im gewählten Zeitraum belegt";
            preis = null;
          } else {
            status = "verfügbar";
            info = "Teilweise belegt (Uhrzeit in Schritt 3 anpassbar)";
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

  // Wählt ein Objekt in Schritt 1 aus und schlägt bei stundenbasierten
  // Objekten automatisch die nächste freie Uhrzeit vor, falls die
  // Standardzeit (09:00-17:00) am gewählten Tag schon belegt ist.
  const handleSelectObjekt = (obj) => {
    setSelectedObjekt(obj);

    let start = dateRange.start;
    let end = dateRange.end;

    // Automatische Anpassung von Start & Ende je nach Typ
    if (start) {
      if (istStundenbasiert(obj.name)) {
        // Stundenbasiert -> Rückgabedatum ist automatisch Anreisedatum (gleicher Tag)
        end = start;
        setDateRange({ start, end: start });
      } else {
        // Wohnung -> Abreisedatum ist mindestens der Folgetag
        if (!end || isSameDay(start, end)) {
          const folgetag = new Date(start);
          folgetag.setDate(folgetag.getDate() + 1);
          end = folgetag;
          setDateRange({ start, end: folgetag });
        }
      }
    }

    const sISO = toISO(start);
    const eISO = toISO(end);

    if (istStundenbasiert(obj.name) && start && end) {
      const istStandardFrei = istVerfuegbar(
        obj.name,
        sISO,
        eISO,
        STANDARD_ANREISE_ZEIT,
        STANDARD_ABREISE_ZEIT
      );

      if (istStandardFrei) {
        setZeiten({ anreiseZeit: STANDARD_ANREISE_ZEIT, abreiseZeit: STANDARD_ABREISE_ZEIT });
      } else {
        const tagesBelegungen = bestehendeBuchungen.filter(
          (b) => b.resource?.toLowerCase() === obj.name?.toLowerCase() && b.start <= eISO && b.end >= sISO
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

            if (istVerfuegbar(obj.name, sISO, eISO, naechsteFreieZeit, endZeitStr)) {
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
    navigate("/buchen/neu");
  };

  /** Speichert Gast (neu oder aktualisiert) und die Buchung, erstellt automatisch die Rechnung und setzt den Assistenten zurück. */
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

      const infosGesamt = [
        bookingDetails.kennzeichen ? `PKW-Kennzeichen: ${bookingDetails.kennzeichen}` : null,
        bookingDetails.info || null,
      ]
        .filter(Boolean)
        .join(" · ");

      const endpreisZahl =
        parseFloat(endpreisManuell.toString().replace(",", ".")) || gesamtpreisBerechnet;

      const zusatzobjektGebucht =
        !istHauptobjektStundenbasiert &&
        bookingDetails.zusatzobjektMieten === "Ja" &&
        zugewiesenesZusatzobjekt;

      const buchungPayload = {
        gast_id: gastId,
        objekt_id: selectedObjekt.id,
        objekt_id_2: zusatzobjektGebucht ? zugewiesenesZusatzobjekt.id : null,
        anreise: formatDe(dateRange.start),
        abreise: formatDe(dateRange.end),
        infos: infosGesamt || null,
        preis: endpreisZahl,
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

  const handleDateClick = (info) => {
    const clickedDate = info.date;
    if (isPastDate(clickedDate)) return;

    // Wenn bereits ein Objekt gewählt ist (z.B. im "Zeitraum ändern"-Modal in Schritt 2/3):
    if (selectedObjekt) {
      if (istStundenbasiert(selectedObjekt.name)) {
        // Stundenbasiert -> gleicher Tag als Start und Ende
        setDateRange({ start: clickedDate, end: clickedDate });
        setHoveredDate(null);
        return;
      } else {
        // Wohnung:
        if (!dateRange.start || (dateRange.start && dateRange.end)) {
          const nextDay = new Date(clickedDate);
          nextDay.setDate(nextDay.getDate() + 1);
          setDateRange({ start: clickedDate, end: nextDay });
          setHoveredDate(null);
          return;
        } else if (dateRange.start && !dateRange.end) {
          if (clickedDate <= dateRange.start) {
            const nextDay = new Date(clickedDate);
            nextDay.setDate(nextDay.getDate() + 1);
            setDateRange({ start: clickedDate, end: nextDay });
          } else {
            setDateRange({ start: dateRange.start, end: clickedDate });
          }
          return;
        }
      }
    }

    // In Schritt 1 (noch kein Objekt ausgewählt):
    if (dateRange.start && !dateRange.end) {
      if (clickedDate < dateRange.start) {
        setDateRange({ start: clickedDate, end: null });
      } else {
        setDateRange({ start: dateRange.start, end: clickedDate });
      }
    } else {
      setDateRange({ start: clickedDate, end: null });
      setHoveredDate(null);
    }
  };

  const handleClearSelection = () => {
    setDateRange({ start: null, end: null });
    setHoveredDate(null);
  };

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
    setBookingDetails({ zusatzobjektMieten: "Nein", kennzeichen: "", info: "" });
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
    zusatzobjektVerfuegbar,
    zugewiesenesZusatzobjekt,
    ZUSATZOBJEKT_KOMBI_RABATT_PROZENT,
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