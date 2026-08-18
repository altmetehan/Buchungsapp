import { useState, useEffect } from "react";
import { TimeDropdown } from "../components/ui/TimeDropdown";
import { Toast } from "../components/ui/Toast";
import { useEinstellungen } from "../hooks/useEinstellungen";
import "../styles/shared-ui.css";

const EINSTELLUNGEN_API = "/api/einstellungen";

const WOCHENTAG_OPTIONEN = [
  { value: "", label: "Keine Einschränkung (Beliebig)" },
  { value: "Montag", label: "Montag" },
  { value: "Dienstag", label: "Dienstag" },
  { value: "Mittwoch", label: "Mittwoch" },
  { value: "Donnerstag", label: "Donnerstag" },
  { value: "Freitag", label: "Freitag" },
  { value: "Samstag", label: "Samstag" },
  { value: "Sonntag", label: "Sonntag" },
];

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
 */
function berechneMindestNaechteVorschlag(checkin, checkout) {
  if (!checkin || !checkout) return null;
  const idxStart = WOCHENTAGE_INDEX[checkin];
  const idxEnd = WOCHENTAGE_INDEX[checkout];
  if (idxStart === undefined || idxEnd === undefined) return null;

  const diff = (idxEnd - idxStart + 7) % 7;
  // Wenn gleicher Wochentag (z.B. Freitag bis Freitag) -> 7 Nächte
  return diff === 0 ? 7 : diff;
}

export function Einstellungen() {
  const { einstellungen, loading: apiLoading, error: apiError, reload } = useEinstellungen();

  const [form, setForm] = useState(einstellungen);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!apiLoading) setForm(einstellungen);
  }, [apiLoading, einstellungen]);

  // Passt den Wochentag an und schlägt automatisch eine passende Mindestaufenthaltsdauer vor
  const handleCheckinWochentagChange = (neuerCheckin) => {
    const vorschlag = berechneMindestNaechteVorschlag(neuerCheckin, form.checkout_wochentag);
    setForm((prev) => ({
      ...prev,
      checkin_wochentag: neuerCheckin,
      ...(vorschlag !== null ? { mindest_naechte_wohnung: vorschlag } : {}),
    }));
  };

  const handleCheckoutWochentagChange = (neuerCheckout) => {
    const vorschlag = berechneMindestNaechteVorschlag(form.checkin_wochentag, neuerCheckout);
    setForm((prev) => ({
      ...prev,
      checkout_wochentag: neuerCheckout,
      ...(vorschlag !== null ? { mindest_naechte_wohnung: vorschlag } : {}),
    }));
  };

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

          <div className="input-group">
            <label>Check-in nur am Wochentag</label>
            <select
              value={form.checkin_wochentag || ""}
              onChange={(e) => handleCheckinWochentagChange(e.target.value)}
              className="select-dropdown-trigger"
              style={{
                width: "100%",
                height: "42px",
                padding: "0 12px",
                border: "1px solid #e4e4e7",
                borderRadius: "6px",
                background: "#ffffff",
              }}
            >
              {WOCHENTAG_OPTIONEN.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
              z. B. „Freitag“ auswählen, falls Anreisen nur freitags erlaubt sind.
            </span>
          </div>

          <div className="input-group">
            <label>Check-out nur am Wochentag</label>
            <select
              value={form.checkout_wochentag || ""}
              onChange={(e) => handleCheckoutWochentagChange(e.target.value)}
              className="select-dropdown-trigger"
              style={{
                width: "100%",
                height: "42px",
                padding: "0 12px",
                border: "1px solid #e4e4e7",
                borderRadius: "6px",
                background: "#ffffff",
              }}
            >
              {WOCHENTAG_OPTIONEN.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
              z. B. „Freitag“ auswählen, falls Abreisen nur freitags erlaubt sind.
            </span>
          </div>

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