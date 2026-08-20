import "../styles/shared-ui.css";
import { useState, useMemo, useEffect } from "react";
import {
  istStundenbasiert,
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
 *              das Bearbeiten von Terminen/Zeiten/Notizen mit Live-Kollisionsprüfung und automatischer
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
 * Berechnet den regulären Grundpreis einer Buchung.
 *
 * @function
 * @param {string} anreiseIso - Anreisedatum (YYYY-MM-DD).
 * @param {string} abreiseIso - Abreisedatum (YYYY-MM-DD).
 * @param {string} anreiseZeit - Beginn-Uhrzeit ("HH:MM").
 * @param {string} abreiseZeit - Ende-Uhrzeit ("HH:MM").
 * @param {number} unitPreis - Preis pro Einheit (pro Nacht oder pro Stunde) des Objekts.
 * @param {boolean} stundenbasiert - Ob das Objekt stundenweise abgerechnet wird.
 * @returns {number} Kaufmännisch auf 2 Nachkommastellen gerundeter Gesamtpreis.
 */
const berechneGesamtPreis = (
  anreiseIso,
  abreiseIso,
  anreiseZeit,
  abreiseZeit,
  unitPreis,
  stundenbasiert
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

  return Math.round(mainPreis * 100) / 100;
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
    preis: 0,
    rabattProzent: "0",
    preisProEinheit: 0,
    infos: "",
    pkw: "",
  });

  /** Fehlermeldung bei Terminkonflikten oder ungültigen Eingaben */
  const [dateWarnung, setDateWarnung] = useState(null);
  /** Status während der asynchronen Verfügbarkeitsprüfung */
  const [pruefeLaeuft, setPruefeLaeuft] = useState(false);

  // Auflösung des Objektnamens
  const hauptobjektName = reservation?.hauptobjektName || reservation?.rawBooking?.Objekte?.name;

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

    const anrZeit = reservation.anreiseZeit || reservation.rawBooking?.anreise_zeit || "09:00";
    const abrZeit = reservation.abreiseZeit || reservation.rawBooking?.abreise_zeit || "17:00";

    let rawPrice = 0;
    if (typeof reservation.preis === "number") {
      rawPrice = reservation.preis;
    } else if (typeof reservation.preis === "string") {
      rawPrice = parseFloat(reservation.preis.replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
    }

    const unitPreis = reservation.preisProNacht || reservation.rawBooking?.Objekte?.preis || 0;

    const basePreis = berechneGesamtPreis(
      startIso,
      endIso,
      anrZeit,
      abrZeit,
      unitPreis,
      stundenbasiert
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
      preis: rawPrice > 0 ? rawPrice : basePreis,
      rabattProzent: initialRabatt,
      preisProEinheit: unitPreis,
      infos: reservation.infos || "",
      pkw: reservation.pkw || reservation.rawBooking?.pkw || "",
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
    stundenbasiert
  );

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
      const newBase = berechneGesamtPreis(
        updatedForm.anreise,
        updatedForm.abreise,
        updatedForm.anreiseZeit,
        updatedForm.abreiseZeit,
        editForm.preisProEinheit,
        stundenbasiert
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
   * Prüft serverseitig gegen alle Buchungen, ob das Objekt im neuen Zeitraum frei ist.
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

    const finaleAnreiseZeit = editForm.anreiseZeit;
    const finaleAbreiseZeit = editForm.abreiseZeit;

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
        infos: editForm.infos,
        preis: numericPrice,
        anreise_zeit: finaleAnreiseZeit,
        abreise_zeit: finaleAbreiseZeit,
        pkw: editForm.pkw || null,
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
      reservation.infos = editForm.infos;
      reservation.preis = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(numericPrice);
      reservation.pkw = editForm.pkw || null;

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
                    value={editForm.anreiseZeit}
                    onChange={(val) => handleFieldChange("anreiseZeit", val)}
                  />
                  <TimeDropdown
                    label="Rückgabezeit / Ende"
                    required
                    value={editForm.abreiseZeit}
                    onChange={(val) => handleFieldChange("abreiseZeit", val)}
                  />
                </>
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
                  Wird bei Datums-, Uhrzeit- oder Rabattänderung automatisch angepasst, kann aber manuell überschrieben werden.
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
              {/* PKW-Kennzeichen anzeigen, falls vorhanden */}
              {(reservation.pkw || reservation.rawBooking?.pkw) && (
                <p className="detail-secondary-text" style={{ marginTop: "6px", color: "#111827", fontWeight: "600" }}>
                  🚗 PKW: {reservation.pkw || reservation.rawBooking?.pkw}
                </p>
              )}
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