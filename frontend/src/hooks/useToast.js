import { useState } from "react";

/**
 * useToast
 * --------
 * Zentrale Toast-Zustandsverwaltung für Erfolgs-/Fehlermeldungen. Jede
 * Seite kann diesen Hook aufrufen und bekommt dieselbe Toast-Erfahrung,
 * ohne den State-Umgang jedes Mal neu zu schreiben.
 *
 * Verwendung:
 *   const { toast, showToast, dismissToast } = useToast();
 *   showToast("error", "Etwas ist schiefgelaufen.");
 *   <Toast toast={toast} onClose={dismissToast} />
 */
export function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => setToast({ type, message, id: Date.now() });
  const dismissToast = () => setToast(null);
  return { toast, showToast, dismissToast };
}