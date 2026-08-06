import { useState } from "react";
import '../../styles/shared-ui.css';

/**
 * GuestCountModal
 * ----------------
 * Popup-Fenster zur Auswahl der Gästeanzahl (Erwachsene / Kinder).
 * Wird im ersten Schritt des Buchungs-Assistenten über den
 * "GÄSTE"-Knopf geöffnet.
 *
 * Props:
 * - isOpen:          ob das Modal angezeigt wird
 * - initialAdults:   aktuelle Anzahl Erwachsene
 * - initialChildren: aktuelle Anzahl Kinder
 * - onClose:         Modal schließen ohne zu übernehmen
 * - onConfirm:       (erwachsene, kinder) => void
 */
export function GuestCountModal({ isOpen, initialAdults, initialChildren, onClose, onConfirm }) {
  // Eigener, lokaler Zwischenstand, damit ein "Abbrechen" die
  // ursprünglichen Werte nicht überschreibt
  const [erwachsene, setErwachsene] = useState(initialAdults ?? 2);
  const [kinder, setKinder] = useState(initialChildren ?? 0);

  if (!isOpen) return null;

  // Inline-Styles für die beiden Stepper-Zeilen (Erwachsene/Kinder) -
  // bewusst hier lokal gehalten, weil dieses Layout nirgendwo sonst in
  // der App vorkommt und deshalb keine eigene CSS-Klasse verdient.
  const stepperRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 0",
  };

  const stepperButtonStyle = {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
  };

  return (
      <div className="modal-backdrop">
        <div className="modal-content form-card" style={{ maxWidth: "380px" }}>
          <h3 style={{ marginBottom: "8px" }}>Gästeanzahl</h3>
          <p className="modal-delete-text" style={{ marginTop: 0 }}>
            Wie viele Personen reisen an?
          </p>

          {/* Stepper: Erwachsene (mind. 1 Person) */}
          <div style={{ ...stepperRowStyle, borderBottom: "1px solid #e4e4e7" }}>
            <div>
              <p className="detail-primary-text" style={{ marginBottom: 0 }}>Erwachsene</p>
              <p className="detail-secondary-text">Ab 13 Jahren</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <button
                  type="button"
                  className="btn-outline"
                  style={stepperButtonStyle}
                  disabled={erwachsene <= 1}
                  onClick={() => setErwachsene(Math.max(1, erwachsene - 1))}
              >
                −
              </button>
              <strong>{erwachsene}</strong>
              <button
                  type="button"
                  className="btn-outline"
                  style={stepperButtonStyle}
                  disabled={erwachsene >= 4}
                  onClick={() => setErwachsene(erwachsene + 1)}
              >
                +
              </button>
            </div>
          </div>

          {/* Stepper: Kinder (kann auch 0 sein) */}
          <div style={stepperRowStyle}>
            <div>
              <p className="detail-primary-text" style={{ marginBottom: 0 }}>Kinder</p>
              <p className="detail-secondary-text">0 bis 12 Jahre</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <button
                  type="button"
                  className="btn-outline"
                  style={stepperButtonStyle}
                  disabled={kinder <= 0}
                  onClick={() => setKinder(Math.max(0, kinder - 1))}
              >
                −
              </button>
              <strong>{kinder}</strong>
              <button
                  type="button"
                  className="btn-outline"
                  style={stepperButtonStyle}
                  disabled={kinder >= 2}
                  onClick={() => setKinder(kinder + 1)}
              >
                +
              </button>
            </div>
          </div>

          <div className="wizard-actions">
            <button type="button" className="btn-outline btn-outline--lg" onClick={onClose}>Abbrechen</button>
            <button type="button" className="btn-primary" onClick={() => onConfirm(erwachsene, kinder)}>
              Übernehmen
            </button>
          </div>
        </div>
      </div>
  );
}