import { useState, useEffect } from "react";
import { TimeDropdown } from "../components/ui/TimeDropdown";
import { Toast } from "../components/ui/Toast";
import { useEinstellungen } from "../hooks/useEinstellungen";
import "../styles/shared-ui.css";

const EINSTELLUNGEN_API = "/api/einstellungen";

/**
 * Einstellungen
 * -------------
 * Zentrale Konfigurationsseite der App. Aktuell drei Werte, alle rund
 * um Wohnungsbuchungen:
 *  - Check-in-Zeit  -> wird beim Anlegen JEDER Wohnungsbuchung
 *                      automatisch als anreise_zeit gespeichert
 *                      (siehe useBuchungsAssistent.js)
 *  - Check-out-Zeit -> analog als abreise_zeit
 *  - Mindestanzahl Nächte -> blockiert zu kurze Wohnungsbuchungen im
 *                      Buchungs-Assistenten
 *
 * WICHTIG: Diese Seite ändert nichts an BESTEHENDEN Buchungen - sie
 * legt nur fest, welche Werte ab sofort als Standard für NEUE
 * Buchungen bzw. für die Verfügbarkeitsprüfung gelten.
 */
export function Einstellungen() {
  const { einstellungen, loading: apiLoading, error: apiError, reload } = useEinstellungen();

  const [form, setForm] = useState(einstellungen);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Sobald die echten Einstellungen vom Server da sind, das Formular damit befüllen.
  useEffect(() => {
    if (!apiLoading) setForm(einstellungen);
  }, [apiLoading, einstellungen]);

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
          // Als echte Zahl speichern, auch wenn der Input als Text reinkommt.
          mindest_naechte_wohnung: parseInt(form.mindest_naechte_wohnung, 10) || 1,
          kombirabatt: parseInt(form.kombirabatt, 10) || 0,
        }),
      });
      if (!response.ok) throw new Error("Speichern fehlgeschlagen");

      // Zentrale Werte im Hook neu laden, damit z.B. der Buchungs-
      // Assistent (falls in einem anderen Tab/derselben Session offen)
      // sofort die neuen Werte sieht statt der alten aus dem Cache.
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

      <form onSubmit={handleSave} className="form-card" style={{ maxWidth: "600px" }}>
        <h4 style={{ marginBottom: "8px"}}>Zentrale Einstellungen für die Wohnungen</h4>
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
              Der Buchungs-Assistent blockiert Wohnungsbuchungen, die kürzer sind als dieser Wert.
            </span>
          </div>
          <div className="input-group full-width">
            <label>Kombi-Rabatt bei Zusatzbuchung von einem Bus *</label>
            <input 
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={form.kombirabatt}
                onChange={(e) => setForm({ ...form, kombirabatt: e.target.value})}
            />
            <span style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>Dieser Rabatt wird vom gesamten zusätzlichen Bus Aufpreis abgezogen.</span>
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