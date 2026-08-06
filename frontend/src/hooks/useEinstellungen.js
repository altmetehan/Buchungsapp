import { useState, useEffect } from "react";

const EINSTELLUNGEN_API = "/api/einstellungen";

/**
 * useEinstellungen
 * ----------------
 * Lädt die zentralen App-Einstellungen (Check-in-/Check-out-Zeit für
 * Wohnungen, Mindestanzahl Nächte, Kombi-Rabatt) vom Backend. Jede
 * Stelle in der App, die diese Werte braucht (Buchungs-Assistent,
 * Buchungskarte, Dashboard, ...), nutzt diesen Hook statt eigener,
 * fest codierter Werte - eine Änderung auf der Einstellungen-Seite
 * wirkt sich dadurch überall aus, sobald die jeweilige Seite neu lädt.
 *
 * @returns {{
 *   einstellungen: {checkin_zeit: string, checkout_zeit: string, mindest_naechte_wohnung: number, kombirabatt: number},
 *   loading: boolean,
 *   error: string|null,
 *   reload: () => Promise<void>
 * }}
 */
export function useEinstellungen() {
  // Fallback-Werte, solange die echten Einstellungen noch nicht vom
  // Server da sind (kurzer Ladezustand beim ersten Rendern).
  const [einstellungen, setEinstellungen] = useState({
    checkin_zeit: "15:00",
    checkout_zeit: "11:00",
    mindest_naechte_wohnung: 7,
    kombirabatt: 75,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ladeEinstellungen = async () => {
    try {
      setLoading(true);
      const response = await fetch(EINSTELLUNGEN_API);
      if (!response.ok) throw new Error(`Server antwortete mit Status ${response.status}`);
      setEinstellungen(await response.json());
      setError(null);
    } catch (err) {
      console.error("useEinstellungen: Fehler beim Laden vom Backend:", err);
      setError("Einstellungen konnten nicht geladen werden - es werden Standardwerte verwendet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    ladeEinstellungen();
  }, []);

  return { einstellungen, loading, error, reload: ladeEinstellungen };
}