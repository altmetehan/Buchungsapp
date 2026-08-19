import "../styles/shared-ui.css";
import { useState, useMemo, useEffect } from "react";
import {
  istStundenbasiert,
  istWohnung,
  istBus,
  ueberschneidenSich,
  datumZeitUeberschneidenSich,
  germanToISO,
  toISO,
} from "../utils/javaUtils";
import { DateDropdown } from "./ui/DateDropdown";
import { TimeDropdown } from "./ui/TimeDropdown";
import { Toast } from "./ui/Toast";
import { useToast } from "../hooks/useToast";
import { useEinstellungen } from "../hooks/useEinstellungen";

/**
 * @file BuchungskarteModal.jsx
 * @description Detail- und Bearbeitungsmodal für eine bestehende Buchung (Buchungskarte).
 *              Ermöglicht das Einsehen aller Gästedaten, Buchungszeiträume, Preise und Preisanpassungshistorien,
 *              das Bearbeiten von Terminen/Zeiten/Zusatzbussen mit Live-Kollisionsprüfung und automatischer
 *              Preisneuberechnung sowie das Stornieren bevorstehender Buchungen.
 * @module components/BuchungskarteModal
 */

/** Endpunkt für Buchungs-API-Operationen */
const BUCHUNGEN_API = "/api/buchungen";

/** Endpunkt für Objekt-Stammdaten */
const OBJEKTE_API = "/api/objekte";

/**
 * Formatiert eine Zahl oder einen Betrag als deutschen Währungsstring (z. B. "1.234,50 €").
 *
 * @function
 * @param {number} zahl - Der zu formatierende numerische Betrag.
 * @returns {string} Der formatierte Währungsbetrag.
 */
const formatEuro = (zahl) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(zahl);

/**
 * Formatiert einen ISO-Datumszeitstempel in ein lesbares deutsches Format ("DD.MM.YYYY, HH:MM Uhr").
 *
 * @function
 * @param {string} isoStr - Der ISO-Datumszeitstempel (z. B. "2026-08-19T14:30:00.000Z").
 * @returns {string} Formatierter Datums- und Zeitstring oder Leerstring, falls keine Eingabe vorliegt.
 */
const formatZeitstempel = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.toLocaleDateString("de-DE")}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
};

/**
 * Wandelt ein Datum verlässlich in das ISO-Format "YYYY-MM-DD" um.
 * Akzeptiert sowohl "DD.MM.YYYY" als auch bereits vorhandenes "YYYY-MM-DD".
 *
 * @function
 * @param {string} dateStr - Das Eingangsdatum im deutschen oder ISO-Format.
 * @returns {string} Datum im Format "YYYY-MM-DD" oder Leerstring.
 */
const toIsoDate = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes("-")) return dateStr;
  const [d, m, y] = dateStr.split(".");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

/**
 * Wandelt ein Datum verlässlich in das deutsche Format "DD.MM.YYYY" um.
 * Akzeptiert sowohl "YYYY-MM-DD" als auch bereits deutsches "DD.MM.YYYY".
 *
 * @function
 * @param {string} isoStr - Das Eingangsdatum im ISO- oder deutschen Format.
 * @returns {string} Datum im Format "DD.MM.YYYY" oder Leerstring.
 */
const toGermanDate = (isoStr) => {
  if (!isoStr) return "";
  if (isoStr.includes(".")) return isoStr;
  const [y, m, d] = isoStr.split("-");
  return `${d}.${m}.${y}`;
};

/**
 * Berechnet die zeitliche Differenz zwischen Start- und Endzeitpunkt in Stunden.
 *
 * @function
 * @param {string} anreiseIso - Anreisedatum im ISO-Format (YYYY-MM-DD).
 * @param {string} abreiseIso - Abreisedatum im ISO-Format (YYYY-MM-DD).
 * @param {string} anreiseZeit - Beginn-Uhrzeit im Format "HH:MM".
 * @param {string} abreiseZeit - Ende-Uhrzeit im Format "HH:MM".
 * @returns {number} Differenz in Stunden (Gleitkommazahl) oder 0 bei ungültigen Angaben.
 */
const berechneStunden = (anreiseIso, abreiseIso, anreiseZeit, abreiseZeit) => {
  if (!anreiseIso || !abreiseIso || !anreiseZeit || !abreiseZeit) return 0;
  const [sh, sm] = anreiseZeit.split(":").map(Number);
  const [eh, em] = abreiseZeit.split(":").map(Number);
  const startD = new Date(anreiseIso);
  startD.setHours(sh, sm, 0, 0);
  const endD = new Date(abreiseIso);
  endD.setHours(eh, em, 0, 0);
  const diffMs = endD - startD;
  return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
};

/**
 * Berechnet den regulären Grundpreis einer Buchung (Hauptobjekt + optionaler Zusatzbus inkl. Rabatt).
 *
 * @function
 * @param {string} anreiseIso - Anreisedatum (YYYY-MM-DD).
 * @param {string} abreiseIso - Abreisedatum (YYYY-MM-DD).
 * @param {string} anreiseZeit - Beginn-Uhrzeit ("HH:MM").
 * @param {string} abreiseZeit - Ende-Uhrzeit ("HH:MM").
 * @param {number} unitPreis - Preis pro Einheit (pro Nacht oder pro Stunde) des Hauptobjekts.
 * @param {boolean} stundenbasiert - Ob das Hauptobjekt stundenweise abgerechnet wird.
 * @param {Object|null} [zusatzBusObjekt=null] - Optionales Bus-Objekt bei Kombibuchungen.
 * @param {number} [kombirabattProzent=0] - Prozentualer Kombirabatt auf den Zusatzbus.
 * @returns {number} Kaufmännisch auf 2 Nachkommastellen gerundeter Gesamtpreis.
 */
const berechneGesamtPreis = (
  anreiseIso,
  abreiseIso,
  anreiseZeit,
  abreiseZeit,
  unitPreis,
  stundenbasiert,
  zusatzBusObjekt = null,
  kombirabattProzent = 0
) => {
  if (!anreiseIso || !abreiseIso || !unitPreis) return 0;

  let mainPreis = 0;
  if (stundenbasiert) {
    const stunden = berechneStunden(anreiseIso, abreiseIso, anreiseZeit || "09:00", abreiseZeit || "17:00");
    mainPreis = stunden * unitPreis;
  } else {
    const startD = new Date(anreiseIso);
    const endD = new Date(abreiseIso);
    const naechte = Math.max(1, Math.round(Math.abs(endD - startD) / (1000 * 60 * 60 * 24)));
    mainPreis = naechte * unitPreis;
  }

  let zusatzPreis = 0;
  if (zusatzBusObjekt) {
    const busStunden = berechneStunden(anreiseIso, abreiseIso, anreiseZeit || "15:00", abreiseZeit || "11:00");
    const busRegulaer = busStunden * (Number(zusatzBusObjekt.preis) || 0);
    const rabattFaktor = kombirabattProzent > 0 ? 1 - kombirabattProzent / 100 : 1;
    zusatzPreis = busRegulaer * rabattFaktor;
  }

  return Math.round((mainPreis + zusatzPreis) * 100) / 100;
};

/**
 * Prüft, ob der Rückgabezeitpunkt chronologisch nach dem Abholzeitpunkt liegt.
 *
 * @function
 * @param {string} anreiseIso - Startdatum (YYYY-MM-DD).
 * @param {string} abreiseIso - Enddatum (YYYY-MM-DD).
 * @param {string} anreiseZeit - Startzeit ("HH:MM").
 * @param {string} abreiseZeit - Endzeit ("HH:MM").
 * @returns {boolean} `true`, wenn das Ende nach dem Start liegt, andernfalls `false`.
 */
const liegtRueckgabeNachAbholung = (anreiseIso, abreiseIso, anreiseZeit, abreiseZeit) => {
  if (!anreiseIso || !abreiseIso) return true;
  const [sh, sm] = (anreiseZeit || "00:00").split(":").map(Number);
  const [eh, em] = (abreiseZeit || "00:00").split(":").map(Number);
  const startD = new Date(anreiseIso);
  startD.setHours(sh, sm, 0, 0);
  const endD = new Date(abreiseIso);
  endD.setHours(eh, em, 0, 0);
  return endD > startD;
};

/**
 * BuchungskarteModal
 * ------------------
 * Modales Dialogfenster zur Anzeige, Bearbeitung und Stornierung einer Buchung.
 *
 * @component
 * @param {Object} props - Komponenten-Properties.
 * @param {Object|null} props.reservation - Das aktuell ausgewählte Buchungs-/Reservierungsobjekt.
 * @param {Function} props.onClose - Callback-Funktion zum Schließen des Modals.
 * @param {Function} [props.onDeleted] - Callback-Funktion nach erfolgreicher Stornierung: `(id, message) => void`.
 * @param {Function} [props.onUpdated] - Callback-Funktion nach erfolgreicher Aktualisierung: `(reservation, message) => void`.
 * @returns {JSX.Element|null} Das gerenderte Modal oder `null`, falls keine Reservierung übergeben wurde.
 */
export function BuchungskarteModal({ reservation, onClose, onDeleted, onUpdated }) {
  const { einstellungen } = useEinstellungen();
  const { toast, showToast, dismissToast } = useToast();

  /** Ladezustand für Stornierungsvorgang */
  const [isDeleting, setIsDeleting] = useState(false);
  /** Ladezustand für Speichervorgang bei Änderungen */
  const [isSaving, setIsSaving] = useState(false);
  /** Steuert, ob das Modal im Bearbeitungsmodus (Formular) ist */
  const [isEditing, setIsEditing] = useState(false);
  /** Steuert die Sicherheitsabfrage für die Stornierung */
  const [showConfirm, setShowConfirm] = useState(false);

  /** Liste aller Mietobjekte (Wohnungen, Busse etc.) */
  const [objekte, setObjekte] = useState([]);
  /** Liste aller Buchungen zur Kollisions- und Verfügbarkeitsprüfung */
  const [buchungen, setBuchungen] = useState([]);

  /**
   * Lädt initiale Objekt- und Buchungsdaten beim Mounten der Komponente.
   */
  useEffect(() => {
    fetch(OBJEKTE_API)
      .then((res) => (res.ok ? res.json() : []))
      .then(setObjekte)
      .catch((err) => console.error("Fehler beim Laden der Objekte:", err));

    fetch(BUCHUNGEN_API)
      .then((res) => (res.ok ? res.json() : []))
      .then(setBuchungen)
      .catch((err) => console.error("Fehler beim Laden der Buchungen:", err));
  }, []);

  /** Heutiges Datum im ISO-Format */
  const todayISO = toISO(new Date());
  /** Gibt an, ob die Buchung in der Vergangenheit liegt */
  const istVergangen = reservation?.status === "vergangen";
  /** Gibt an, ob die Buchung noch storniert werden darf */
  const kannStornieren = reservation?.status === "bevorstehend";

  /**
   * Zustand des Bearbeitungsformulars.
   * @type {[Object, Function]}
   */
  const [editForm, setEditForm] = useState({
    anreise: "",
    abreise: "",
    anreiseZeit: "09:00",
    abreiseZeit: "17:00",
    objekt_id_2: null,
    preis: 0,
    rabattProzent: "0",
    preisProEinheit: 0,
    infos: "",
  });

  /** Fehlermeldung bei Terminkonflikten oder ungültigen Eingaben */
  const [dateWarnung, setDateWarnung] = useState(null);
  /** Status während der asynchronen Verfügbarkeitsprüfung */
  const [pruefeLaeuft, setPruefeLaeuft] = useState(false);

  // Auflösung von Haupt- und Zusatzobjektinformationen
  const hauptobjektName = reservation?.hauptobjektName || reservation?.rawBooking?.Objekte?.name;
  const zusatzobjektName = reservation?.zusatzobjektName || reservation?.rawBooking?.ObjekteZusatz?.name;
  const istZusatzEintrag = Boolean(zusatzobjektName && reservation?.resource === zusatzobjektName);
  const partnerObjektName = istZusatzEintrag ? hauptobjektName : zusatzobjektName;
  const istKombiBuchung = Boolean(zusatzobjektName || editForm.objekt_id_2);

  /** Prozentualer Kombirabatt aus den globalen Einstellungen */
  const kombirabatt = Number(einstellungen?.kombirabatt) || 0;

  /**
   * Filtert und sortiert alle Bus-Objekte aufsteigend nach Preis.
   * @type {Array<Object>}
   */
  const busObjekteSortiert = useMemo(() => {
    return (objekte || [])
      .filter((o) => istBus(o.name))
      .sort((a, b) => (Number(a.preis) || 0) - (Number(b.preis) || 0));
  }, [objekte]);

  /**
   * Prüft, ob ein konkretes Bus-Objekt im aktuell gewählten Zeitraum frei ist.
   *
   * @function
   * @param {Object} bus - Das zu prüfende Bus-Objekt.
   * @returns {boolean} `true`, falls der Bus verfügbar ist, sonst `false`.
   */
  const checkBusVerfuegbarkeit = (bus) => {
    if (!bus || !editForm.anreise || !editForm.abreise) return false;

    const startISO = editForm.anreise;
    const endISO = editForm.abreise;
    const startZeit = istKombiBuchung ? einstellungen?.checkin_zeit || "15:00" : editForm.anreiseZeit || "15:00";
    const endZeit = istKombiBuchung ? einstellungen?.checkout_zeit || "11:00" : editForm.abreiseZeit || "11:00";

    return !buchungen.some((b) => {
      if (b.id === reservation?.id) return false;
      const belegtDiesenBus = b.objekt_id === bus.id || b.objekt_id_2 === bus.id;
      if (!belegtDiesenBus) return false;

      const bStartISO = germanToISO(b.anreise);
      const bEndISO = germanToISO(b.abreise);

      return datumZeitUeberschneidenSich(
        startISO,
        startZeit,
        endISO,
        endZeit,
        bStartISO,
        b.anreise_zeit || "00:00",
        bEndISO,
        b.abreise_zeit || "23:59"
      );
    });
  };

  /**
   * Ermittelt den preislich günstigsten, aktuell verfügbaren Bus.
   * @type {Object|null}
   */
  const guenstigsterFreierBus = useMemo(() => {
    return busObjekteSortiert.find((bus) => checkBusVerfuegbarkeit(bus)) || null;
  }, [busObjekteSortiert, editForm.anreise, editForm.abreise, editForm.anreiseZeit, editForm.abreiseZeit, buchungen, reservation?.id]);

  /**
   * Liefert das Objekt des aktuell im Formular gewählten Zusatzbusses.
   * @type {Object|null}
   */
  const aktuellGewaehlterBus = useMemo(() => {
    if (!editForm.objekt_id_2) return null;
    return objekte.find((o) => o.id === editForm.objekt_id_2) || null;
  }, [objekte, editForm.objekt_id_2]);

  const zielBus = aktuellGewaehlterBus || guenstigsterFreierBus;
  const isBusVerfuegbar = Boolean(guenstigsterFreierBus || editForm.objekt_id_2);

  /**
   * Berechnet den Zusatzaufpreis des Busses (inkl. eventuellem Kombirabatt) für die UI.
   * @type {number}
   */
  const berechneterBusZusatzpreis = useMemo(() => {
    if (!zielBus || !editForm.anreise || !editForm.abreise) return 0;
    const stunden = berechneStunden(
      editForm.anreise,
      editForm.abreise,
      einstellungen?.checkin_zeit || "15:00",
      einstellungen?.checkout_zeit || "11:00"
    );
    const regulaer = stunden * (Number(zielBus.preis) || 0);
    const rabattFaktor = kombirabatt > 0 ? 1 - kombirabatt / 100 : 1;
    return Math.round(regulaer * rabattFaktor * 100) / 100;
  }, [zielBus, editForm.anreise, editForm.abreise, einstellungen, kombirabatt]);

  if (!reservation) return null;

  const stundenbasiert = istStundenbasiert(reservation.resource);
  const erwachsene = reservation.erwachsene ?? reservation.rawBooking?.erwachsene;
  const kinder = reservation.kinder ?? reservation.rawBooking?.kinder;

  /** Formatierte Gästeangabe (Erwachsene & Kinder) */
  const gaesteInfoText =
    erwachsene !== null && erwachsene !== undefined
      ? `${erwachsene} Erwachsene${kinder ? ` · ${kinder} Kind${kinder > 1 ? "er" : ""}` : ""}`
      : null;

  /**
   * Initialisiert das Formular und wechselt in den Bearbeitungsmodus.
   *
   * @function
   * @returns {void}
   */
  const handleStartEditing = () => {
    const startIso = toIsoDate(reservation.checkIn || reservation.start);
    const endIso = toIsoDate(reservation.checkOut || reservation.end);

    const anrZeit = istKombiBuchung
      ? einstellungen.checkin_zeit
      : reservation.anreiseZeit || reservation.rawBooking?.anreise_zeit || "09:00";
    const abrZeit = istKombiBuchung
      ? einstellungen.checkout_zeit
      : reservation.abreiseZeit || reservation.rawBooking?.abreise_zeit || "17:00";

    let rawPrice = 0;
    if (typeof reservation.preis === "number") {
      rawPrice = reservation.preis;
    } else if (typeof reservation.preis === "string") {
      rawPrice = parseFloat(reservation.preis.replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
    }

    const unitPreis = reservation.preisProNacht || reservation.rawBooking?.Objekte?.preis || 0;
    const initialZusatzId = reservation.objekt_id_2 || reservation.rawBooking?.objekt_id_2 || null;
    const initialZusatzObj = objekte.find((o) => o.id === initialZusatzId) || null;

    const basePreis = berechneGesamtPreis(
      startIso,
      endIso,
      anrZeit,
      abrZeit,
      unitPreis,
      stundenbasiert,
      initialZusatzObj,
      kombirabatt
    );

    let initialRabatt = "0";
    if (basePreis > 0 && rawPrice > 0 && rawPrice < basePreis) {
      const calcRabatt = ((basePreis - rawPrice) / basePreis) * 100;
      const clamped = Math.max(0, Math.min(100, calcRabatt));
      initialRabatt = clamped % 1 === 0 ? clamped.toFixed(0) : clamped.toFixed(1);
    }

    setEditForm({
      anreise: startIso,
      abreise: endIso,
      anreiseZeit: anrZeit,
      abreiseZeit: abrZeit,
      objekt_id_2: initialZusatzId,
      preis: rawPrice > 0 ? rawPrice : basePreis,
      rabattProzent: initialRabatt,
      preisProEinheit: unitPreis,
      infos: reservation.infos || "",
    });

    setDateWarnung(null);
    setIsEditing(true);
  };

  /**
   * Aktueller Grundpreis basierend auf den momentanen Formulareingaben.
   * @type {number}
   */
  const aktuellerBasePreis = berechneGesamtPreis(
    editForm.anreise,
    editForm.abreise,
    editForm.anreiseZeit,
    editForm.abreiseZeit,
    editForm.preisProEinheit,
    stundenbasiert,
    aktuellGewaehlterBus,
    kombirabatt
  );

  /**
   * Schaltet die Bus-Zusatzoption im Formular ein/aus und passt den Preis an.
   *
   * @function
   * @param {boolean} mitBus - `true`, wenn ein Bus hinzugefügt werden soll.
   * @returns {void}
   */
  const handleZusatzobjektToggle = (mitBus) => {
    const neuerBusId = mitBus ? (guenstigsterFreierBus?.id || editForm.objekt_id_2 || busObjekteSortiert[0]?.id) : null;
    const gewaehlterBus = mitBus ? objekte.find((o) => o.id === neuerBusId) : null;

    const newBase = berechneGesamtPreis(
      editForm.anreise,
      editForm.abreise,
      editForm.anreiseZeit,
      editForm.abreiseZeit,
      editForm.preisProEinheit,
      stundenbasiert,
      gewaehlterBus,
      kombirabatt
    );

    const rabatt = parseFloat(editForm.rabattProzent?.replace(",", ".")) || 0;
    const neuerPreis = Math.round(newBase * (1 - rabatt / 100) * 100) / 100;

    setEditForm((prev) => ({
      ...prev,
      objekt_id_2: neuerBusId,
      preis: neuerPreis,
    }));
  };

  /**
   * Aktualisiert ein Formularfeld und führt bei Datums-/Zeitänderungen die Preisneuberechnung durch.
   *
   * @function
   * @param {string} field - Der Feldname im `editForm`-State.
   * @param {*} value - Der neue Feldwert.
   * @returns {void}
   */
  const handleFieldChange = (field, value) => {
    let updatedForm = { ...editForm, [field]: value };

    if (field === "anreise" && value) {
      if (stundenbasiert) {
        if (updatedForm.abreise < updatedForm.anreise) updatedForm.abreise = value;
      }
    }

    if (["anreise", "abreise", "anreiseZeit", "abreiseZeit"].includes(field)) {
      const busObj = objekte.find((o) => o.id === updatedForm.objekt_id_2);
      const newBase = berechneGesamtPreis(
        updatedForm.anreise,
        updatedForm.abreise,
        updatedForm.anreiseZeit,
        updatedForm.abreiseZeit,
        editForm.preisProEinheit,
        stundenbasiert,
        busObj,
        kombirabatt
      );
      const rabatt = parseFloat(editForm.rabattProzent?.replace(",", ".")) || 0;
      updatedForm.preis = Math.round(newBase * (1 - rabatt / 100) * 100) / 100;
    }

    setEditForm(updatedForm);
    setDateWarnung(null);
  };

  /**
   * Verarbeitet manuelle Rabatt-Änderungen in Prozent und passt den Gesamtpreis an.
   *
   * @function
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input-Event.
   * @returns {void}
   */
  const handleRabattChange = (e) => {
    const rawVal = e.target.value;
    if (rawVal === "") {
      setEditForm((prev) => ({ ...prev, rabattProzent: "", preis: aktuellerBasePreis }));
      return;
    }

    let num = parseFloat(rawVal.replace(",", "."));
    if (isNaN(num)) return;

    num = Math.max(0, Math.min(100, num));
    const neuerEndpreis = aktuellerBasePreis * (1 - num / 100);

    setEditForm((prev) => ({
      ...prev,
      rabattProzent: num.toString(),
      preis: (Math.round(neuerEndpreis * 100) / 100).toString(),
    }));
  };

  /**
   * Verarbeitet manuelle Preisüberschreibungen und berechnet den Rabattprozentsatz rückwärts.
   *
   * @function
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input-Event.
   * @returns {void}
   */
  const handlePreisChange = (e) => {
    const rawVal = e.target.value;
    const neuerPreis = parseFloat(rawVal.replace(",", "."));

    let berechneterRabatt = "0";
    if (!isNaN(neuerPreis) && aktuellerBasePreis > 0) {
      let r = ((aktuellerBasePreis - neuerPreis) / aktuellerBasePreis) * 100;
      r = Math.max(0, Math.min(100, r));
      berechneterRabatt = r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
    }

    setEditForm((prev) => ({ ...prev, preis: rawVal, rabattProzent: berechneterRabatt }));
  };

  /**
   * Prüft serverseitig gegen alle Buchungen, ob das Haupt- und Zusatzobjekt im neuen Zeitraum frei sind.
   *
   * @async
   * @function
   * @param {string} neuAnreiseIso - Neues Startdatum (YYYY-MM-DD).
   * @param {string} neuAbreiseIso - Neues Enddatum (YYYY-MM-DD).
   * @param {string} neuAnreiseZeit - Neue Startzeit ("HH:MM").
   * @param {string} neuAbreiseZeit - Neue Endzeit ("HH:MM").
   * @returns {Promise<boolean>} `true` bei freier Verfügbarkeit, sonst `false`.
   */
  const pruefeVerfuegbarkeit = async (neuAnreiseIso, neuAbreiseIso, neuAnreiseZeit, neuAbreiseZeit) => {
    setPruefeLaeuft(true);
    try {
      const response = await fetch(BUCHUNGEN_API);
      if (!response.ok) throw new Error("Verfügbarkeit konnte nicht geprüft werden");
      const alleBuchungen = await response.json();

      const belegungen = [];
      alleBuchungen
        .filter((b) => b.id !== reservation.id)
        .forEach((b) => {
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

      const pruefeObjekt = (resourceName) => {
        if (!resourceName) return true;
        const isStunden = istStundenbasiert(resourceName);
        return !belegungen.some((bel) => {
          if (bel.resource?.toLowerCase() !== resourceName.toLowerCase()) return false;
          if (isStunden) {
            return datumZeitUeberschneidenSich(
              neuAnreiseIso,
              neuAnreiseZeit || "00:00",
              neuAbreiseIso,
              neuAbreiseZeit || "23:59",
              bel.start,
              bel.anreiseZeit || "00:00",
              bel.end,
              bel.abreiseZeit || "23:59"
            );
          }
          return ueberschneidenSich(neuAnreiseIso, neuAbreiseIso, bel.start, bel.end);
        });
      };

      if (!pruefeObjekt(reservation.resource)) {
        setDateWarnung(`⚠ ${reservation.resource} ist im neu gewählten Zeitraum bereits belegt.`);
        return false;
      }

      if (editForm.objekt_id_2) {
        const gewaehlterBus = objekte.find((o) => o.id === editForm.objekt_id_2);
        if (gewaehlterBus && !pruefeObjekt(gewaehlterBus.name)) {
          setDateWarnung(`⚠ ${gewaehlterBus.name} ist im neu gewählten Zeitraum bereits belegt.`);
          return false;
        }
      } else if (partnerObjektName && !pruefeObjekt(partnerObjektName)) {
        setDateWarnung(`⚠ ${partnerObjektName} ist im neu gewählten Zeitraum bereits belegt.`);
        return false;
      }

      setDateWarnung(null);
      return true;
    } catch (err) {
      console.error("Fehler bei der Verfügbarkeitsprüfung:", err);
      setDateWarnung("Verfügbarkeit konnte nicht geprüft werden. Bitte erneut versuchen.");
      return false;
    } finally {
      setPruefeLaeuft(false);
    }
  };

  /**
   * Validiert und speichert die vorgenommenen Änderungen an der Buchung über die PUT-Schnittstelle.
   *
   * @async
   * @function
   * @param {React.FormEvent<HTMLFormElement>} e - Submit-Event des Formulars.
   * @returns {Promise<void>}
   */
  const handleSaveEdit = async (e) => {
    e.preventDefault();

    const finaleAnreiseZeit = istKombiBuchung ? einstellungen.checkin_zeit : editForm.anreiseZeit;
    const finaleAbreiseZeit = istKombiBuchung ? einstellungen.checkout_zeit : editForm.abreiseZeit;

    if (stundenbasiert && !liegtRueckgabeNachAbholung(editForm.anreise, editForm.abreise, finaleAnreiseZeit, finaleAbreiseZeit)) {
      setDateWarnung("⚠ Die Rückgabezeit muss nach der Abholzeit liegen.");
      return;
    }

    if (!stundenbasiert) {
      const naechteNeu = Math.max(
        1,
        Math.round(Math.abs(new Date(editForm.abreise) - new Date(editForm.anreise)) / (1000 * 60 * 60 * 24))
      );
      if (naechteNeu < einstellungen.mindest_naechte_wohnung) {
        setDateWarnung(
          `⚠ Mindestaufenthaltsdauer für Wohnungen: ${einstellungen.mindest_naechte_wohnung} Nächte (aktuell gewählt: ${naechteNeu}).`
        );
        return;
      }
    }

    const istVerfuegbar = await pruefeVerfuegbarkeit(editForm.anreise, editForm.abreise, finaleAnreiseZeit, finaleAbreiseZeit);
    if (!istVerfuegbar) return;

    setIsSaving(true);
    try {
      const updatedAnreiseGerman = toGermanDate(editForm.anreise);
      const updatedAbreiseGerman = toGermanDate(editForm.abreise);
      const numericPrice = Number(editForm.preis) || 0;

      const payload = {
        anreise: updatedAnreiseGerman,
        abreise: updatedAbreiseGerman,
        objekt_id_2: editForm.objekt_id_2 ? Number(editForm.objekt_id_2) : null,
        infos: editForm.infos,
        preis: numericPrice,
        anreise_zeit: finaleAnreiseZeit,
        abreise_zeit: finaleAbreiseZeit,
      };

      const response = await fetch(`${BUCHUNGEN_API}/${reservation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Aktualisieren fehlgeschlagen");

      reservation.checkIn = updatedAnreiseGerman;
      reservation.start = editForm.anreise;
      reservation.checkOut = updatedAbreiseGerman;
      reservation.end = editForm.abreise;
      reservation.anreiseZeit = finaleAnreiseZeit;
      reservation.abreiseZeit = finaleAbreiseZeit;
      reservation.objekt_id_2 = editForm.objekt_id_2;
      reservation.zusatzobjektName = zielBus?.name || null;
      reservation.infos = editForm.infos;
      reservation.preis = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(numericPrice);

      onUpdated?.(reservation, `Buchung #${reservation.id} wurde erfolgreich aktualisiert.`);

      setIsEditing(false);
      onClose();
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      showToast("error", "Speichern fehlgeschlagen. Bitte Backend prüfen.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Führt das Stornieren (Löschen) der Buchung über die DELETE-Schnittstelle aus.
   *
   * @async
   * @function
   * @returns {Promise<void>}
   */
  const handleConfirmDelete = async () => {
    if (!kannStornieren) {
      showToast("error", "Nur bevorstehende Buchungen können storniert werden.");
      setShowConfirm(false);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`${BUCHUNGEN_API}/${reservation.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Löschen fehlgeschlagen");

      onDeleted?.(reservation.id, `Buchung #${reservation.id} wurde storniert.`);
      setShowConfirm(false);
      onClose();
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
      showToast("error", "Löschen fehlgeschlagen. Bitte prüfen, ob das Backend läuft.");
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Berechnet das minimal wählbare Abreisedatum für das Formular.
   *
   * @function
   * @returns {string} ISO-Datumsstring.
   */
  const getMinAbreise = () => {
    if (!editForm.anreise) return todayISO;
    if (!stundenbasiert) {
      const d = new Date(editForm.anreise);
      d.setDate(d.getDate() + 1);
      return toISO(d);
    }
    return editForm.anreise;
  };

  /**
   * Berechnet das minimal wählbare Anreisedatum für das Formular.
   *
   * @function
   * @returns {string} ISO-Datumsstring.
   */
  const getMinAnreise = () => {
    const anreiseIso = toIsoDate(reservation.start || reservation.checkIn || reservation.rawBooking?.anreise);
    const today = toISO(new Date());
    return anreiseIso && anreiseIso < today ? anreiseIso : today;
  };

  const anrZeit = reservation.anreiseZeit || reservation.rawBooking?.anreise_zeit;
  const abrZeit = reservation.abreiseZeit || reservation.rawBooking?.abreise_zeit;
  const zeigeAnreiseZeit = Boolean(anrZeit);
  const zeigeAbreiseZeit = Boolean(abrZeit);

  /** Preisanpassungshistorie sortiert nach Erstellungsdatum */
  const rawHistorie = reservation.preisanpassungen || reservation.rawBooking?.Preisanpassungen || [];
  const preisHistorie = [...rawHistorie].sort((a, b) => new Date(a.erstellt_am) - new Date(b.erstellt_am));

  let inhalt;

  // ─── ANSICHT 1: STORNIERUNGS-BESTÄTIGUNGSDIALOG ───
  if (showConfirm) {
    inhalt = (
      <div className="modal-backdrop">
        <div className="modal-content modal-delete form-card">
          <h3>Buchung stornieren?</h3>
          <p className="modal-delete-text">
            Möchtest du die Buchung <strong>#{reservation.id} ({reservation.name})</strong> unwiderruflich stornieren?
          </p>
          <div className="wizard-actions" style={{ marginTop: "24px" }}>
            <button type="button" className="btn-outline" onClick={() => setShowConfirm(false)} disabled={isDeleting}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: "10px 20px", fontSize: "14px" }}
              onClick={handleConfirmDelete}
              disabled={isDeleting || !kannStornieren}
            >
              {isDeleting ? "Storniert..." : "Ja, stornieren."}
            </button>
          </div>
        </div>
      </div>
    );
  // ─── ANSICHT 2: BEARBEITUNGSFORMULAR ───
  } else if (isEditing) {
    inhalt = (
      <div className="modal-backdrop">
        <div className="modal-content form-card">
          <h3>Buchung #{reservation.id} bearbeiten</h3>

          <form onSubmit={handleSaveEdit}>
            <div className="form-grid" style={{ marginTop: "16px" }}>
              <DateDropdown
                label="Anreise"
                required
                minDate={getMinAnreise()}
                value={editForm.anreise}
                onChange={(val) => handleFieldChange("anreise", val)}
              />
              <DateDropdown
                label="Abreise"
                required
                minDate={getMinAbreise()}
                value={editForm.abreise}
                onChange={(val) => handleFieldChange("abreise", val)}
              />

              {stundenbasiert && (
                <>
                  <TimeDropdown
                    label="Abholzeit / Beginn"
                    required
                    disabled={istKombiBuchung}
                    value={editForm.anreiseZeit}
                    onChange={(val) => handleFieldChange("anreiseZeit", val)}
                  />
                  <TimeDropdown
                    label="Rückgabezeit / Ende"
                    required
                    disabled={istKombiBuchung}
                    value={editForm.abreiseZeit}
                    onChange={(val) => handleFieldChange("abreiseZeit", val)}
                  />
                  {istKombiBuchung && (
                    <div className="input-group full-width">
                      <span style={{ fontSize: "12px", color: "#e30000", fontWeight: "500" }}>
                        ℹ Bei einer Kombibuchung (Wohnung + Bus) sind die Buszeiten fest an die Wohnungsbuchung
                        gekoppelt ({einstellungen.checkin_zeit} bis {einstellungen.checkout_zeit}) und können nicht verändert werden.
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Zusatzobjekt-Sektion (Bus zur Wohnung hinzubuchen) */}
              {istWohnung(hauptobjektName || reservation.resource) && busObjekteSortiert.length > 0 && (
                <div className="input-group full-width" style={{ marginTop: "12px" }}>
                  <label style={{ fontWeight: "600", marginBottom: "6px", display: "block" }}>
                    Zusatzobjekt
                  </label>

                  {/* Grünes Banner: Erscheint, wenn bei dieser Buchung bereits ein Bus enthalten ist */}
                  {Boolean(zusatzobjektName || reservation.objekt_id_2) && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        color: "#15803d",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: "600",
                        marginBottom: "10px",
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>✓</span>
                      <span>
                        {zusatzobjektName || zielBus?.name || "Bus"} mitgebucht (im Preis enthalten
                        {kombirabatt > 0 ? `, inkl. ${kombirabatt}% Kombirabatt` : ""})
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: "20px",
                      alignItems: "center",
                      padding: "10px 14px",
                      backgroundColor: "#00000005",
                      borderRadius: "8px",
                      border: "1px solid #e4e4e7",
                    }}
                  >
                    {/* Option 1: Kein Zusatzobjekt */}
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="zusatzobjekt"
                        checked={!editForm.objekt_id_2}
                        onChange={() => handleZusatzobjektToggle(false)}
                      />
                      <span>Kein Zusatzobjekt</span>
                    </label>

                    {/* Option 2: [Bus-Name] mitbuchen */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: isBusVerfuegbar ? "pointer" : "not-allowed",
                        opacity: isBusVerfuegbar ? 1 : 0.5,
                      }}
                    >
                      <input
                        type="radio"
                        name="zusatzobjekt"
                        checked={Boolean(editForm.objekt_id_2)}
                        disabled={!isBusVerfuegbar}
                        onChange={() => handleZusatzobjektToggle(true)}
                      />
                      <span style={{ fontWeight: editForm.objekt_id_2 ? "600" : "normal" }}>
                        {zielBus ? `${zielBus.name} mitbuchen` : "Bus mitbuchen"}

                        {/* Zeigt den Aufpreis nur an, wenn der Bus aktuell NICHT ausgewählt ist */}
                        {!editForm.objekt_id_2 && isBusVerfuegbar && (
                          <span style={{ fontSize: "12px", color: "#52525b", fontWeight: "normal", marginLeft: "6px" }}>
                            (+{formatEuro(berechneterBusZusatzpreis)}{kombirabatt > 0 ? ` inkl. ${kombirabatt}% Kombirabatt` : ""})
                          </span>
                        )}
                      </span>

                      {!isBusVerfuegbar && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            marginLeft: "4px",
                            color: "#b91c1c",
                          }}
                        >
                          (Im Zeitraum belegt)
                        </span>
                      )}
                    </label>
                  </div>
                </div>
              )}

              <div className="input-group">
                <label>Berechneter Preis (€)</label>
                <input type="text" disabled className="select-disabled-mock" value={aktuellerBasePreis.toFixed(2)} />
              </div>

              <div className="input-group">
                <label>Rabatt (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  value={editForm.rabattProzent}
                  onChange={handleRabattChange}
                />
              </div>

              <div className="input-group full-width">
                <label>Gesamtpreis (€) *</label>
                <input type="number" step="0.01" min="0" required value={editForm.preis} onChange={handlePreisChange} />
                <span style={{ fontSize: "12px", color: "#71717a", marginTop: "2px" }}>
                  Wird bei Datums-, Uhrzeit-, Bus- oder Rabattänderung automatisch angepasst, kann aber manuell überschrieben werden.
                </span>
              </div>

              <div className="input-group full-width">
                <label>Notizen / Buchungsinfos</label>
                <textarea
                  rows={3}
                  value={editForm.infos}
                  onChange={(e) => setEditForm({ ...editForm, infos: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                />
              </div>

              {dateWarnung && (
                <div className="input-group full-width">
                  <p style={{ color: "#ef4444", fontSize: "13px", fontWeight: "600", margin: 0 }}>{dateWarnung}</p>
                </div>
              )}
            </div>

            {istVergangen && (
              <p style={{ color: "#71717a", fontSize: "13px", fontStyle: "italic", marginTop: "12px", textAlign: "right" }}>
                🔒 Diese Buchung liegt in der Vergangenheit und kann nicht mehr bearbeitet werden.
              </p>
            )}

            <div className="wizard-actions" style={{ marginTop: "24px" }}>
              <button type="button" className="btn-outline" onClick={() => setIsEditing(false)} disabled={isSaving || pruefeLaeuft}>
                Abbrechen
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSaving || istVergangen}
                style={{
                  opacity: istVergangen ? 0.5 : 1,
                  cursor: istVergangen ? "not-allowed" : "pointer",
                }}
              >
                {isSaving ? "Speichert..." : "Änderungen speichern"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  // ─── ANSICHT 3: DETAILS-ÜBERSICHTSKARTE (STANDARD) ───
  } else {
    inhalt = (
      <div className="modal-backdrop">
        <div className="modal-content modal-details form-card">
          <div className="modal-header-flex">
            <h3 className="modal-header-title">Buchungskarte #{reservation.id}</h3>
            <span className={`tag ${reservation.status} modal-header-tag`}>{reservation.status}</span>
          </div>

          <div className="details-grid">
            <div className="detail-card-block">
              <h4 className="detail-block-title">Gästedaten</h4>
              <p className="detail-primary-text">{reservation.name}</p>
              {gaesteInfoText && (
                <p className="detail-secondary-text" style={{ marginTop: "2px", color: "#111827", fontWeight: "600" }}>
                  👥 {gaesteInfoText}
                </p>
              )}
              <p className="detail-secondary-text">✉ {reservation.email}</p>
              <p className="detail-secondary-text">📞 {reservation.phone || "Keine Telefonnummer"}</p>
              <p className="detail-address-divider">
                📍 {reservation.strasse} {reservation.hnr}, {reservation.plz} {reservation.stadt}, {reservation.land?.toUpperCase()}
              </p>
            </div>

            <div className="detail-card-block">
              <h4 className="detail-block-title">Objekt</h4>
              <p className="detail-primary-text">{reservation.resource}</p>
              <p className="detail-secondary-text" style={{ marginTop: "4px" }}>
                {reservation.objectinfo || "Keine weiteren Details"}
              </p>
              {partnerObjektName && partnerObjektName !== reservation.resource && (
                <p className="detail-secondary-text" style={{ marginTop: "4px", color: "#e30000", fontWeight: "600" }}>
                  + {istZusatzEintrag ? "Gebucht zusammen mit" : "Mitgebuchter Bus"}: {partnerObjektName}
                </p>
              )}
            </div>

            <div className="detail-card-block-full">
              <h4 className="detail-block-title" style={{ marginBottom: "0" }}>
                Buchungsinfos / Notizen
              </h4>
              <p
                className="detail-primary-text"
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: "14px",
                  fontWeight: "normal",
                  color: reservation.infos ? "#000" : "#71717a",
                  marginBottom: "0",
                }}
              >
                {reservation.infos || "Keine zusätzlichen Informationen vom Gast hinterlegt."}
              </p>
            </div>

            <div className="detail-card-block-full">
              <div>
                <h4 className="detail-block-title">Zeitraum</h4>
                <p className="detail-primary-text">
                  {reservation.checkIn || reservation.start}
                  {zeigeAnreiseZeit && ` (${anrZeit} Uhr)`} bis {reservation.checkOut || reservation.end}
                  {zeigeAbreiseZeit && ` (${abrZeit} Uhr)`}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <h4 className="detail-block-title">Gesamtpreis</h4>
                <p className="detail-price-text">{reservation.preis || "€ 0,00"}</p>
              </div>
            </div>

            {preisHistorie.length > 0 && (
              <div className="detail-card-block-full" style={{ display: "block" }}>
                <h4 className="detail-block-title">Preisänderungen</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                  {preisHistorie.map((a) => (
                    <div key={a.id} style={{ fontSize: "13px" }}>
                      <strong>
                        {formatEuro(a.alter_betrag)} → {formatEuro(a.neuer_betrag)}
                      </strong>{" "}
                      <span style={{ color: "#71717a" }}>· {formatZeitstempel(a.erstellt_am)}</span>
                      <p className="detail-secondary-text" style={{ marginTop: "2px" }}>
                        {a.grund}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer-flex">
            <button
              type="button"
              className="btn-delete-modal"
              style={{
                padding: "14px 24px",
                fontSize: "14px",
                opacity: kannStornieren ? 1 : 0.5,
                cursor: kannStornieren ? "pointer" : "not-allowed",
              }}
              disabled={isDeleting || !kannStornieren}
              onClick={() => setShowConfirm(true)}
              title={!kannStornieren ? "Nur bevorstehende Buchungen können storniert werden." : undefined}
            >
              Buchung stornieren
            </button>

            <div className="modal-footer-right">
              <button type="button" className="btn-primary" onClick={handleStartEditing} disabled={isDeleting}>
                Bearbeiten
              </button>
              <button type="button" className="btn-outline" onClick={onClose} disabled={isDeleting}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toast toast={toast} onClose={dismissToast} />
      {inhalt}
    </>
  );
}