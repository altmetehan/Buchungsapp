/**
 * searchUtils.js
 * --------------
 * Zentrale Such-Hilfsfunktion für alle Suchleisten der App.
 *
 * Behebt zwei Hauptprobleme:
 * 1. Trailing-Leerzeichen & Mehrwort-Suche (AND über Begriffe, OR über Felder).
 * 2. Exakte Zahlen-Grenzprüfung: Ein Suchbegriff wie "2" matcht NICHT
 *    mehr fälschlicherweise eine ID oder Hausnummer wie "29".
 *
 * @param {string} query - die rohe Sucheingabe aus dem Suchfeld
 * @param {Array<string|number|null|undefined>} felder - alle zu durchsuchenden Felder
 * @returns {boolean} true, wenn JEDER Suchbegriff in mindestens einem Feld vorkommt
 */
export function matchesSearchQuery(query, felder) {
  const suchbegriffe = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  // Leere Suche -> Alles anzeigen
  if (suchbegriffe.length === 0) return true;

  // Alle Felder zu Texten normalisieren
  const felderNormalisiert = felder.map((f) => (f ?? "").toString().toLowerCase());

  // JEDER Suchbegriff muss in MINDESTENS einem Feld vorkommen
  return suchbegriffe.every((begriff) => {
    const istEineZahl = /^\d+$/.test(begriff);

    return felderNormalisiert.some((feld) => {
      if (istEineZahl) {
        // Bei reinen Zahlen (z. B. "2"): Prüfen, ob die Zahl an einer "Zahlengrenze" steht.
        // Matcht z. B. "2", "#2", "Wohnung 2", "2. Stock" -> Aber NICHT "29" oder "102".
        const regex = new RegExp(`(?:^|\\D)${begriff}(?:\\D|$)`);
        return regex.test(feld);
      }

      // Normaler Textabgleich für alle anderen Wörter
      return feld.includes(begriff);
    });
  });
}