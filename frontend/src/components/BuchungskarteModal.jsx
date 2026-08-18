import "../styles/shared-ui.css";
import { useState } from "react";
import {
  istStundenbasiert,
  ueberschneidenSich,
  datumZeitUeberschneidenSich,
  germanToISO,
  toISO,
  parseGermanDate,
} from "../utils/javaUtils";
import { DateDropdown } from "./ui/DateDropdown";
import { TimeDropdown } from "./ui/TimeDropdown";
import { Toast } from "./ui/Toast";
import { useToast } from "../hooks/useToast";
import { useEinstellungen } from "../hooks/useEinstellungen";

const BUCHUNGEN_API = "/api/buchungen";

/** Formatiert eine Zahl als "€ 1.234,50". */
const formatEuro = (zahl) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(zahl);

/** Formatiert einen ISO-Zeitstempel als "DD.MM.YYYY, HH:MM Uhr". */
const formatZeitstempel = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.toLocaleDateString("de-DE")}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
};

/** Wandelt "DD.MM.YYYY" ODER "YYYY-MM-DD" verlässlich nach "YYYY-MM-DD" um. */
const toIsoDate = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes("-")) return dateStr;
  const [d, m, y] = dateStr.split(".");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

/** Wandelt "YYYY-MM-DD" ODER "DD.MM.YYYY" verlässlich nach "DD.MM.YYYY" um. */
const toGermanDate = (isoStr) => {
  if (!isoStr) return "";
  if (isoStr.includes(".")) return isoStr;
  const [y, m, d] = isoStr.split("-");
  return `${d}.${m}.${y}`;
};

/**
 * Berechnet den Grundpreis (ohne Rabatt) einer Buchung anhand von
 * Zeitraum, Uhrzeiten (bei stundenbasierten Objekten) und Objektpreis.
 *
 * @param {string} anreiseIso
 * @param {string} abreiseIso
 * @param {string} anreiseZeit - "HH:MM"
 * @param {string} abreiseZeit - "HH:MM"
 * @param {number} unitPreis - Preis pro Nacht ODER Stunde, je nach stundenbasiert
 * @param {boolean} stundenbasiert
 * @returns {number}
 */
const berechnePreis = (anreiseIso, abreiseIso, anreiseZeit, abreiseZeit, unitPreis, stundenbasiert) => {
  if (!anreiseIso || !abreiseIso || !unitPreis) return 0;

  if (stundenbasiert) {
    const [sh, sm] = (anreiseZeit || "09:00").split(":").map(Number);
    const [eh, em] = (abreiseZeit || "17:00").split(":").map(Number);

    const startD = new Date(anreiseIso);
    startD.setHours(sh, sm, 0, 0);

    const endD = new Date(abreiseIso);
    endD.setHours(eh, em, 0, 0);

    const diffMs = endD - startD;
    const stunden = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
    return Math.round(stunden * unitPreis * 100) / 100;
  } else {
    const startD = new Date(anreiseIso);
    const endD = new Date(abreiseIso);
    const naechte = Math.max(1, Math.round(Math.abs(endD - startD) / (1000 * 60 * 60 * 24)));
    return Math.round(naechte * unitPreis * 100) / 100;
  }
};

/**
 * Prüft, ob der Rückgabe-/Endzeitpunkt (Datum + Uhrzeit zusammen) auch
 * wirklich nach dem Abhol-/Startzeitpunkt liegt. Wird nur für
 * stundenbasierte Objekte gebraucht (Bus/Forum), weil dort Anreise und
 * Abreise am selben Tag liegen können - berechnePreis() würde eine
 * verdrehte Reihenfolge sonst stillschweigend auf 0 Stunden/0€ runden,
 * statt eine Warnung anzuzeigen.
 *
 * @param {string} anreiseIso
 * @param {string} abreiseIso
 * @param {string} anreiseZeit - "HH:MM"
 * @param {string} abreiseZeit - "HH:MM"
 * @returns {boolean}
 */
const liegtRueckgabeNachAbholung = (anreiseIso, abreiseIso, anreiseZeit, abreiseZeit) => {
  if (!anreiseIso || !abreiseIso) return true; // fehlendes Datum wird schon vom required-Feld abgefangen

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
 * -------------------
 * Zeigt eine einzelne Buchung im Detail an und bietet von dort aus drei
 * Zustände: Detailansicht, Bearbeiten (Zeitraum/Uhrzeiten/Preis/Notizen
 * ändern) und eine Lösch-Bestätigung. Wird von Dashboard, Kalender und
 * Reservierungen gleichermaßen genutzt.
 *
 * @param {object} props
 * @param {object|null} props.reservation - die anzuzeigende Buchung, oder null (Modal geschlossen)
 * @param {() => void} props.onClose
 * @param {(id: number) => void} props.onDeleted - wird nach erfolgreichem Löschen aufgerufen
 * @param {(updated: object) => void} props.onUpdated - wird nach erfolgreichem Speichern aufgerufen
 * @returns {JSX.Element|null}
 */
export function BuchungskarteModal({ reservation, onClose, onDeleted, onUpdated }) {
  const { einstellungen } = useEinstellungen();
  const { toast, showToast, dismissToast } = useToast();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const todayISO = toISO(new Date());

  const istVergangen = reservation?.status === "vergangen";

  // Stornieren darf NUR bei einer noch bevorstehenden Buchung passieren
  const kannStornieren = reservation?.status === "bevorstehend";

  const [editForm, setEditForm] = useState({
    anreise: "",
    abreise: "",
    anreiseZeit: "09:00",
    abreiseZeit: "17:00",
    preis: 0,
    rabattProzent: "0",
    preisProEinheit: 0,
    infos: "",
  });

  const [dateWarnung, setDateWarnung] = useState(null);
  const [pruefeLaeuft, setPruefeLaeuft] = useState(false);

  if (!reservation) return null;

  const stundenbasiert = istStundenbasiert(reservation.resource);

  // ─── GÄSTE-ANZAHL ERMITTELN ───
  const erwachsene = reservation.erwachsene ?? reservation.rawBooking?.erwachsene;
  const kinder = reservation.kinder ?? reservation.rawBooking?.kinder;

  const gaesteInfoText =
    erwachsene !== null && erwachsene !== undefined
      ? `${erwachsene} Erwachsene${kinder ? ` · ${kinder} Kind${kinder > 1 ? "er" : ""}` : ""}`
      : null;


  // ─── HAUPT-/ZUSATZOBJEKT ZENTRAL ERMITTELN ───
  // "reservation" wird je nach aufrufender Seite (Dashboard/Kalender/
  // Reservierungen) leicht unterschiedlich zusammengebaut - manche
  // Seiten liefern "zusatzobjektName" direkt mit, andere nicht. Deshalb
  // hier immer zusätzlich auf "rawBooking" zurückfallen (das die
  // komplette Buchung inkl. Objekte/ObjekteZusatz vom Backend enthält),
  // statt das an mehreren Stellen unterschiedlich zu handhaben - sonst
  // würde bei einer Kombibuchung (Wohnung + Bus) je nach aufrufender
  // Seite nur eines der beiden Objekte auf Verfügbarkeit geprüft.
  const hauptobjektName = reservation.hauptobjektName || reservation.rawBooking?.Objekte?.name;
  const zusatzobjektName = reservation.zusatzobjektName || reservation.rawBooking?.ObjekteZusatz?.name;

  // Zeigt diese Karte gerade das Zusatzobjekt (z.B. den Bus-Eintrag im
  // Kalender) statt das Hauptobjekt an?
  const istZusatzEintrag = Boolean(zusatzobjektName && reservation.resource === zusatzobjektName);

  // Das jeweils ANDERE Objekt der Kombibuchung - unabhängig davon, ob
  // gerade die Wohnung oder der Bus in der Karte angezeigt wird.
  const partnerObjektName = istZusatzEintrag ? hauptobjektName : zusatzobjektName;

  // Eine Kombibuchung ist eine Wohnung MIT mitgebuchtem Bus - erkennbar
  // daran, dass es überhaupt ein Zusatzobjekt gibt.
  const istKombiBuchung = Boolean(zusatzobjektName);

  /** Befüllt das Bearbeiten-Formular mit den aktuellen Werten der Buchung und wechselt in den Bearbeiten-Modus. */
  const handleStartEditing = () => {
    const startIso = toIsoDate(reservation.checkIn || reservation.start);
    const endIso = toIsoDate(reservation.checkOut || reservation.end);

    // Bei einer Kombibuchung sind die Buszeiten fest an die Wohnung
    // gekoppelt (15:00 Abholung / 11:00 Rückgabe) und nicht editierbar.
    const anrZeit = istKombiBuchung ? einstellungen.checkin_zeit : reservation.anreiseZeit || reservation.rawBooking?.anreise_zeit || "09:00";
    const abrZeit = istKombiBuchung ? einstellungen.checkout_zeit : reservation.abreiseZeit || reservation.rawBooking?.abreise_zeit || "17:00";

    let rawPrice = 0;
    if (typeof reservation.preis === "number") {
      rawPrice = reservation.preis;
    } else if (typeof reservation.preis === "string") {
      rawPrice = parseFloat(reservation.preis.replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
    }

    const unitPreis = reservation.preisProNacht || reservation.rawBooking?.Objekte?.preis || 0;
    const basePreis = berechnePreis(startIso, endIso, anrZeit, abrZeit, unitPreis, stundenbasiert);

    // Initialen Rabatt ermitteln, falls der vorhandene Preis kleiner als der Grundpreis ist.
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
    });

    setDateWarnung(null);
    setIsEditing(true);
  };

  // Aktueller Grundpreis (vor Rabatt), live aus dem Formularzustand berechnet.
  const aktuellerBasePreis = berechnePreis(
    editForm.anreise,
    editForm.abreise,
    editForm.anreiseZeit,
    editForm.abreiseZeit,
    editForm.preisProEinheit,
    stundenbasiert,
  );

  /** Reagiert auf Änderungen an Datum/Uhrzeit: rechnet den Preis (unter Berücksichtigung des aktuellen Rabatts) neu. */
  const handleFieldChange = (field, value) => {
    let updatedForm = { ...editForm, [field]: value };

    // ── AUTOMATISCHE ABREISE-/RÜCKGABEDATUM-LOGIK ──
    if (field === "anreise" && value) {
      if (stundenbasiert) {
        // Bei stundenbasierten Objekten: Rückgabedatum ist automatisch derselbe Tag
        updatedForm.abreise = value;
      }
    }

    if (["anreise", "abreise", "anreiseZeit", "abreiseZeit"].includes(field)) {
      const newBase = berechnePreis(
        updatedForm.anreise,
        updatedForm.abreise,
        updatedForm.anreiseZeit,
        updatedForm.abreiseZeit,
        editForm.preisProEinheit,
        stundenbasiert,
      );
      const rabatt = parseFloat(editForm.rabattProzent?.replace(",", ".")) || 0;
      updatedForm.preis = Math.round(newBase * (1 - rabatt / 100) * 100) / 100;
    }

    setEditForm(updatedForm);
    setDateWarnung(null);
  };

  /** Reagiert auf eine manuelle Rabatt-Eingabe (0-100%) und rechnet den Gesamtpreis neu. */
  const handleRabattChange = (e) => {
    const rawVal = e.target.value;
    if (rawVal === "") {
      setEditForm((prev) => ({ ...prev, rabattProzent: "", preis: aktuellerBasePreis }));
      return;
    }

    let num = parseFloat(rawVal.replace(",", "."));
    if (isNaN(num)) return;

    num = Math.max(0, Math.min(100, num)); // Strikte Begrenzung auf 0-100%
    const neuerEndpreis = aktuellerBasePreis * (1 - num / 100);

    setEditForm((prev) => ({
      ...prev,
      rabattProzent: num.toString(),
      preis: (Math.round(neuerEndpreis * 100) / 100).toString(),
    }));
  };

  /** Reagiert auf eine händische Gesamtpreis-Eingabe und rechnet den entsprechenden Rabatt zurück. */
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
   * Prüft vorm Speichern, ob das Haupt- und ein evtl. Zusatzobjekt im
   * neu gewählten Zeitraum noch verfügbar sind (die eigene, alte Buchung
   * wird dabei natürlich ausgeklammert).
   *
   * @returns {Promise<boolean>}
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
              bel.abreiseZeit || "23:59",
            );
          }
          return ueberschneidenSich(neuAnreiseIso, neuAbreiseIso, bel.start, bel.end);
        });
      };

      // Zuerst das in der Karte gerade angezeigte Objekt prüfen (Wohnung
      // ODER Bus, je nachdem welcher Eintrag geöffnet wurde) ...
      if (!pruefeObjekt(reservation.resource)) {
        setDateWarnung(`⚠ ${reservation.resource} ist im neu gewählten Zeitraum bereits belegt.`);
        return false;
      }

      // ... und bei einer Kombibuchung immer auch das jeweils andere
      // mitgebuchte Objekt (partnerObjektName statt dem u.U. leeren
      // reservation.zusatzobjektName - siehe Kommentar weiter oben).
      if (!pruefeObjekt(partnerObjektName)) {
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

  /** Prüft Verfügbarkeit und speichert die Änderungen per PUT-Request beim Backend. */
  const handleSaveEdit = async (e) => {
    e.preventDefault();

    const finaleAnreiseZeit = istKombiBuchung ? einstellungen.checkin_zeit : editForm.anreiseZeit;
    const finaleAbreiseZeit = istKombiBuchung ? einstellungen.checkout_zeit : editForm.abreiseZeit;

    // Bei stundenbasierten Objekten (Bus/Forum) muss die Rückgabezeit
    // wirklich nach der Abholzeit liegen - sonst würde berechnePreis()
    // das stillschweigend auf 0 Stunden/0€ runden, ohne dass irgendwo
    // eine Warnung kommt.
    if (stundenbasiert && !liegtRueckgabeNachAbholung(editForm.anreise, editForm.abreise, finaleAnreiseZeit, finaleAbreiseZeit)) {
      setDateWarnung("⚠ Die Rückgabezeit muss nach der Abholzeit liegen.");
      return;
    }

    // Die Mindestaufenthaltsdauer für Wohnungen (aus den zentralen
    // Einstellungen) gilt auch beim nachträglichen Bearbeiten - sonst
    // könnte man eine bestehende Wohnungsbuchung hier auf 1 Nacht
    // runterkürzen, ganz ohne Warnung.
    if (!stundenbasiert) {
      const naechteNeu = Math.max(
        1,
        Math.round(Math.abs(new Date(editForm.abreise) - new Date(editForm.anreise)) / (1000 * 60 * 60 * 24)),
      );
      if (naechteNeu < einstellungen.mindest_naechte_wohnung) {
        setDateWarnung(
          `⚠ Mindestaufenthaltsdauer für Wohnungen: ${einstellungen.mindest_naechte_wohnung} Nächte (aktuell gewählt: ${naechteNeu}).`,
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
      };

      const response = await fetch(`${BUCHUNGEN_API}/${reservation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Aktualisieren fehlgeschlagen");

      // Die aufrufende Seite hält ihre eigene Liste im State - hier
      // direkt das übergebene reservation-Objekt anpassen und per
      // onUpdated zurückmelden, statt komplett neu vom Server zu laden.
      reservation.checkIn = updatedAnreiseGerman;
      reservation.start = editForm.anreise;
      reservation.checkOut = updatedAbreiseGerman;
      reservation.end = editForm.abreise;
      reservation.anreiseZeit = finaleAnreiseZeit;
      reservation.abreiseZeit = finaleAbreiseZeit;
      reservation.infos = editForm.infos;
      reservation.preis = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(numericPrice);

      onUpdated?.(reservation, `Buchung #${reservation.id} wurde erfolgreich aktualisiert.`);

      setIsEditing(false);
      onClose();
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      // Die Karte bleibt bei einem Fehler bewusst offen (kein onClose()
      // im catch-Block), damit der Toast auch tatsächlich sichtbar
      // bleibt, statt mit dem Modal sofort wieder zu verschwinden.
      showToast("error", "Speichern fehlgeschlagen. Bitte Backend prüfen.");
    } finally {
      setIsSaving(false);
    }
  };

  /** Löscht die Buchung endgültig per DELETE-Request beim Backend. */
  const handleConfirmDelete = async () => {
    // Zusätzliche Absicherung direkt hier (nicht nur über den
    // deaktivierten Button) - falls "showConfirm" aus irgendeinem
    // Grund doch für eine nicht-bevorstehende Buchung geöffnet würde,
    // wird das Stornieren trotzdem verweigert.
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

  /** Mindest-Abreisedatum: bei Wohnungen mindestens 1 Tag nach Anreise, bei stundenbasierten Objekten der gleiche Tag. */
  const getMinAbreise = () => {
    if (!editForm.anreise) return todayISO;
    if (!stundenbasiert) {
      const d = new Date(editForm.anreise);
      d.setDate(d.getDate() + 1);
      return toISO(d);
    }
    return editForm.anreise;
  };

  /** Mindest-Anreisedatum: heute, außer die Buchung lag ohnehin schon in der Vergangenheit (dann bleibt ihr altes Datum erlaubt). */
  const getMinAnreise = () => {
    const anreiseIso = toIsoDate(reservation.start || reservation.checkIn || reservation.rawBooking?.anreise);
    const todayISO = toISO(new Date());
    return anreiseIso && anreiseIso < todayISO ? anreiseIso : todayISO;
  };

  const anrZeit = reservation.anreiseZeit || reservation.rawBooking?.anreise_zeit;
  const abrZeit = reservation.abreiseZeit || reservation.rawBooking?.abreise_zeit;
  const zeigeAnreiseZeit = Boolean(anrZeit);
  const zeigeAbreiseZeit = Boolean(abrZeit);

  // Historie aller nachträglichen Preisanpassungen dieser Buchung - wird
  // von Rechnungen.jsx angelegt, ist hier aber genauso sichtbar, weil
  // beide Ansichten auf dieselbe Buchung schauen. "rawBooking?.Preisanpassungen"
  // als Fallback, falls "preisanpassungen" (noch) nicht explizit durchgereicht wurde.
  const rawHistorie = reservation.preisanpassungen || reservation.rawBooking?.Preisanpassungen || [];
  // Älteste Änderung zuerst; für die umgekehrte Reihenfolge einfach rawHistorie direkt anzeigen.
  const preisHistorie = [...rawHistorie].sort((a, b) => new Date(a.erstellt_am) - new Date(b.erstellt_am));

  // Die drei möglichen Zustände (Detailansicht / Bearbeiten / Lösch-
  // Bestätigung) werden hier in "inhalt" gesammelt statt als separate
  // frühe returns, damit EIN gemeinsamer <Toast /> am Ende für alle drei
  // Zustände gilt, unabhängig davon, welcher gerade aktiv ist.
  let inhalt;

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
                style={{ whiteSpace: "pre-wrap", fontSize: "14px", fontWeight: "normal", color: reservation.infos ? "#000" : "#71717a", marginBottom: "0" }}
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