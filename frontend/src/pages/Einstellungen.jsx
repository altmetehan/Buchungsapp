import { useState, useEffect } from "react";
import { TimeDropdown } from "../components/ui/TimeDropdown";
import { WeekdayDropdown } from "../components/ui/WeekdayDropdown";
import { Toast } from "../components/ui/Toast";
import { useEinstellungen } from "../hooks/useEinstellungen";
import "../styles/shared-ui.css";

/**
 * @file Einstellungen.jsx
 * @description Administrationsseite zur Konfiguration globaler Standardeinstellungen
 *              (Check-in/out-Zeiten, Mindestaufenthaltsdauer, Kombirabatte, Wochentagsrestriktionen).
 * @module pages/Einstellungen
 */

const EINSTELLUNGEN_API = "/api/einstellungen";

/** Index-Zuordnung für Wochentage zur Berechnung von Differenzen */
const WOCHENTAGE_INDEX = {
  Sonntag: 0,
  Montag: 1,
  Dienstag: 2,
  Mittwoch: 3,
  Donnerstag: 4,
  Freitag: 5,
  Samstag: 6,
};

/**
 * Berechnet einen logischen Vorschlag für die Mindestnächte basierend auf
 * den gewählten Wochentagen (z. B. Fr -> Fr = 7 Nächte, Fr -> So = 2 Nächte).
 *
 * @function
 * @param {string} checkin - Gewählter Anreise-Wochentag.
 * @param {string} checkout - Gewählter Abreise-Wochentag.
 * @returns {number|null} Vorgeschlagene Mindestnächteanzahl oder `null`.
 */
function berechneMindestNaechteVorschlag(checkin, checkout) {
  if (!checkin || !checkout) return null;
  const idxStart = WOCHENTAGE_INDEX[checkin];
  const idxEnd = WOCHENTAGE_INDEX[checkout];
  if (idxStart === undefined || idxEnd === undefined) return null;

  const diff = (idxEnd - idxStart + 7) % 7;
  return diff === 0 ? 7 : diff;
}

/**
 * Einstellungen-Seitenkomponente.
 *
 * @component
 * @returns {JSX.Element} Das Einstellungsformular.
 */
export function Einstellungen() {
  const { einstellungen, loading: apiLoading, error: apiError, reload } = useEinstellungen();

  /** @type {[Object, Function]} Lokaler Formularzustand */
  const [form, setForm] = useState(einstellungen);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!apiLoading) setForm(einstellungen);
  }, [apiLoading, einstellungen]);

  /**
   * Behandelt Änderungen am Check-in-Wochentag und aktualisiert den Mindestnächtevorschlag.
   *
   * @function
   * @param {string} neuerCheckin - Neuer Wochentag.
   * @returns {void}
   */
  const handleCheckinWochentagChange = (neuerCheckin) => {
    const vorschlag = berechneMindestNaechteVorschlag(neuerCheckin, form.checkout_wochentag);
    setForm((prev) => ({
      ...prev,
      checkin_wochentag: neuerCheckin,
      ...(vorschlag !== null ? { mindest_naechte_wohnung: vorschlag } : {}),
    }));
  };

  /**
   * Behandelt Änderungen am Check-out-Wochentag und aktualisiert den Mindestnächtevorschlag.
   *
   * @function
   * @param {string} neuerCheckout - Neuer Wochentag.
   * @returns {void}
   */
  const handleCheckoutWochentagChange = (neuerCheckout) => {
    const vorschlag = berechneMindestNaechteVorschlag(form.checkin_wochentag, neuerCheckout);
    setForm((prev) => ({
      ...prev,
      checkout_wochentag: neuerCheckout,
      ...(vorschlag !== null ? { mindest_naechte_wohnung: vorschlag } : {}),
    }));
  };

  /**
   * Speichert die Systemeinstellungen persistent per PUT-Request im Backend.
   *
   * @async
   * @function
   * @param {React.FormEvent<HTMLFormElement>} e - Submit-Event.
   * @returns {Promise<void>}
   */
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(EINSTELLUNGEN_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkin_zeit: form.checkin_zeit,
          checkout_zeit: form.checkout_zeit,
          mindest_naechte_wohnung: parseInt(form.mindest_naechte_wohnung, 10) || 1,
          kombirabatt: parseFloat(form.kombirabatt) || 0,
          checkin_wochentag: form.checkin_wochentag || "",
          checkout_wochentag: form.checkout_wochentag || "",
        }),
      });
      if (!response.ok) throw new Error("Speichern fehlgeschlagen");

      await reload();
      setToast({ type: "success", message: "Einstellungen wurden gespeichert." });
    } catch (err) {
      console.error("Einstellungen: Fehler beim Speichern:", err);
      setToast({ type: "error", message: "Speichern fehlgeschlagen. Bitte Backend prüfen." });
    } finally {
      setIsSaving(false);
    }
  };

  if (apiLoading) return <p style={{ padding: "24px" }}>Lade Einstellungen vom Server...</p>;

  return (
    <div className="einstellungen-container">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="page-header">
        <div className="header-text">
          <h2>Einstellungen</h2>
          <p className="subtitle">
            Zentrale Werte für Wohnungsbuchungen - gelten ab sofort überall in der App.
          </p>
        </div>
      </div>

      {apiError && <p style={{ color: "#e30000", marginBottom: "16px" }}>{apiError}</p>}

      <form onSubmit={handleSave} className="form-card" style={{ maxWidth: "650px" }}>
        <h4 style={{ marginBottom: "8px" }}>Zentrale Einstellungen für die Wohnungen</h4>
        <div className="form-grid">
          <TimeDropdown
            label="Check-in-Zeit"
            value={form.checkin_zeit}
            onChange={(val) => setForm({ ...form, checkin_zeit: val })}
          />
          <TimeDropdown
            label="Check-out-Zeit"
            value={form.checkout_zeit}
            onChange={(val) => setForm({ ...form, checkout_zeit: val })}
          />

          <WeekdayDropdown
            label="Check-in nur am Wochentag"
            value={form.checkin_wochentag || ""}
            onChange={handleCheckinWochentagChange}
            hint="z. B. „Freitag“ auswählen, falls Anreisen nur freitags erlaubt sind."
          />

          <WeekdayDropdown
            label="Check-out nur am Wochentag"
            value={form.checkout_wochentag || ""}
            onChange={handleCheckoutWochentagChange}
            hint="z. B. „Freitag“ auswählen, falls Abreisen nur freitags erlaubt sind."
          />

          <div className="input-group full-width">
            <label>Mindestanzahl Nächte pro Wohnungsbuchung *</label>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={form.mindest_naechte_wohnung}
              onChange={(e) => setForm({ ...form, mindest_naechte_wohnung: e.target.value })}
            />
            <span style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
              Wird bei Wochentagsänderung (z. B. Freitag bis Freitag) automatisch als Vorschlag angepasst, bleibt aber jederzeit frei editierbar.
            </span>
          </div>

          <div className="input-group full-width">
            <label>Kombi-Rabatt bei Zusatzbuchung von einem Bus (%) *</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              value={form.kombirabatt}
              onChange={(e) => setForm({ ...form, kombirabatt: e.target.value })}
            />
            <span style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
              Dieser Rabatt wird vom gesamten zusätzlichen Bus-Aufpreis abgezogen.
            </span>
          </div>
        </div>

        <div className="wizard-actions" style={{ marginTop: "24px" }}>
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? "Speichert..." : "Einstellungen speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}