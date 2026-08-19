/**
 * dateUtils.js
 * ------------
 * Backend-seitige Datums- und Zeitraum-Hilfsfunktionen. Bewusst
 * unabhängig von frontend/src/utils/javaUtils.js gehalten (kein
 * gemeinsames Package, da Front- und Backend getrennt deployt
 * werden) - beide Seiten implementieren dieselbe Logik parallel.
 *
 * Zwei Datumsformate tauchen durchgängig auf:
 * - "deutsches Format": String "DD.MM.YYYY", z.B. "14.07.2026"
 * - "ISO-Format":       String "YYYY-MM-DD", z.B. "2026-07-14"
 */

/**
 * Wandelt ein deutsches Datum "DD.MM.YYYY" in ISO-Format "YYYY-MM-DD" um.
 *
 * @param {string} dateStr - z.B. "14.07.2026"
 * @returns {string} z.B. "2026-07-14", oder "" bei leerem/ungültigem Input
 */
export function germanToISO(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split(".");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

/**
 * Wandelt ein deutsches Datum "DD.MM.YYYY" in ein echtes Date-Objekt um.
 *
 * @param {string} dateStr - z.B. "14.07.2026"
 * @returns {Date} bei fehlendem/ungültigem String: der Unix-Epoch (01.01.1970) als klar erkennbarer Fallback
 */
export function parseGermanDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return new Date(0);
  const parts = dateStr.split(".").map(Number);
  if (parts.length !== 3) return new Date(0);
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

/**
 * Ob ein Objekt stundenweise (statt nächteweise) abgerechnet wird.
 * Regel: alles außer einer Wohnung ist stundenbasiert (Bus, Forum, ...).
 *
 * Hinweis: nimmt bewusst das ganze Objekt (mit .name-Feld) entgegen,
 * nicht nur den Namen als String - anders als das gleichnamige
 * Pendant in frontend/src/utils/javaUtils.js, das direkt einen
 * Objektnamen erwartet. Beim Lesen/Anpassen beider Seiten also auf
 * diesen Unterschied in der Signatur achten.
 *
 * @param {{name?: string}|null|undefined} objekt - Objekt-Datensatz mit mindestens einem "name"-Feld
 * @returns {boolean}
 */
export function istStundenbasiert(objekt) {
  return !objekt?.name?.toLowerCase().includes("wohnung");
}

/**
 * Prüft, ob sich zwei Zeiträume [startA, endA) und [startB, endB) auf
 * reiner Datumsebene überschneiden (ohne Uhrzeit-Berücksichtigung).
 *
 * @param {string} startA - ISO-Datum
 * @param {string} endA - ISO-Datum
 * @param {string} startB - ISO-Datum
 * @param {string} endB - ISO-Datum
 * @returns {boolean}
 */
export function ueberschneidenSich(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

/**
 * Präzise Überschneidungsprüfung auf Datum+Uhrzeit-Ebene - wird für
 * stundenbasierte Objekte (Bus, Forum, ...) gebraucht, bei denen zwei
 * Buchungen am selben Tag koexistieren können, solange sich die
 * Uhrzeiten nicht überlappen (reine Datumsprüfung würde das nicht
 * erkennen, siehe javaUtils.js für Details zur Begründung).
 *
 * @param {string} startA - ISO-Datum
 * @param {string} zeitStartA - "HH:MM", Fallback "00:00"
 * @param {string} endA - ISO-Datum
 * @param {string} zeitEndA - "HH:MM", Fallback "23:59"
 * @param {string} startB - ISO-Datum
 * @param {string} zeitStartB - "HH:MM", Fallback "00:00"
 * @param {string} endB - ISO-Datum
 * @param {string} zeitEndB - "HH:MM", Fallback "23:59"
 * @returns {boolean}
 */
export function datumZeitUeberschneidenSich(
  startA,
  zeitStartA,
  endA,
  zeitEndA,
  startB,
  zeitStartB,
  endB,
  zeitEndB
) {
  const a1 = new Date(`${startA}T${zeitStartA || "00:00"}`);
  const a2 = new Date(`${endA}T${zeitEndA || "23:59"}`);
  const b1 = new Date(`${startB}T${zeitStartB || "00:00"}`);
  const b2 = new Date(`${endB}T${zeitEndB || "23:59"}`);
  return a1 < b2 && a2 > b1;
}

/**
 * Berechnet die Dauer zwischen zwei Datum+Uhrzeit-Punkten in Stunden.
 * Wird für die Preisberechnung stundenbasierter Objekte genutzt.
 *
 * @param {string} startISO - ISO-Datum des Beginns
 * @param {string} startZeit - "HH:MM"
 * @param {string} endISO - ISO-Datum des Endes
 * @param {string} endZeit - "HH:MM"
 * @returns {number} Stunden als Dezimalzahl, 0 falls Eingaben fehlen oder das Ende vor dem Start liegt
 */
export function berechneStundenISO(startISO, startZeit, endISO, endZeit) {
  if (!startISO || !endISO || !startZeit || !endZeit) return 0;
  const [sh, sm] = startZeit.split(":").map(Number);
  const [eh, em] = endZeit.split(":").map(Number);
  const [sy, smonth, sd] = startISO.split("-").map(Number);
  const [ey, emonth, ed] = endISO.split("-").map(Number);
  const start = new Date(sy, smonth - 1, sd, sh, sm, 0, 0);
  const ende = new Date(ey, emonth - 1, ed, eh, em, 0, 0);
  const diffMs = ende - start;
  return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
}