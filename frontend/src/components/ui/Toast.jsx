import { useEffect } from "react";
import "../../styles/Toast.css";

/**
 * Toast
 * -----
 * Kleine, sich selbst schließende Erfolgs-/Fehlermeldung oben rechts im
 * Bildschirm - ersetzt die Browser-alert()-Popups, die optisch nichts
 * mit dem Rest der App zu tun hatten. Schließt sich nach ein paar
 * Sekunden von selbst, kann aber auch jederzeit per Klick auf das ×
 * sofort weggeklickt werden.
 *
 * Bewusst als eigene, wiederverwendbare Komponente gebaut (nicht nur
 * für den Buchungs-Assistenten) - andere Seiten, die aktuell noch
 * alert() für Fehler nutzen (Gäste, Objekte, Rechnungen), können sie
 * später genauso einbinden.
 *
 * Props:
 * - toast:   { type: "success" | "error", message: string } | null
 * - onClose: () => void
 */
export function Toast({ toast, onClose }) {
  // Schließt die Meldung automatisch nach 5 Sekunden - der Timer startet
  // neu, sobald ein NEUER Toast reinkommt (z.B. Fehler direkt nach Erfolg).
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="toast-container">
      <div className={`toast toast--${toast.type}`}>
        <span className="toast-icon">{toast.type === "success" ? "✓" : "!"}</span>
        <p className="toast-message">{toast.message}</p>
        <button type="button" className="toast-close" onClick={onClose} aria-label="Meldung schließen">
          ×
        </button>
      </div>
    </div>
  );
}