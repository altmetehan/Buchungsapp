/**
 * javaUtils.js
 * ------------
 * Zentrale Sammlung aller Datums- und Objekt-Hilfsfunktionen der App
 * (der Dateiname ist historisch gewachsen, inhaltlich ist das reines
 * "dateUtils" + ein paar Objekt-Klassifizierungs-Helfer). Jede Seite,
 * die mit Datumsformaten oder der Wohnung/stundenbasiert-Unterscheidung
 * arbeitet, importiert von hier - so landet ein Bugfix nur an einer
 * Stelle statt mehrfach kopiert zu werden.
 *
 * Zwei Datumsformate tauchen in der App durchgängig auf:
 * - "deutsches Format": String "DD.MM.YYYY", z.B. "14.07.2026"
 * - "ISO-Format":       String "YYYY-MM-DD", z.B. "2026-07-14"
 *   (wird für Sortierung/Vergleiche genutzt, weil es sich alphabetisch
 *   korrekt sortieren lässt)
 */

/**
 * Formatiert ein Date-Objekt als deutsches Datum "DD.MM.YYYY".
 *
 * @param {Date|null} date - Das zu formatierende Datum.
 * @returns {string} z.B. "14.07.2026", oder "" wenn kein Datum übergeben wurde.
 */
export const formatDe = (date) =>
  date
    ? date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

/**
 * Formatiert ein Date-Objekt "hübsch" mit Wochentag, z.B. für die
 * Anreise-/Abreise-Anzeige in der Buchen-Suchleiste ("Di., 14. Juli").
 *
 * @param {Date|null} date
 * @returns {string}
 */
export const formatPrettyDe = (date) =>
  date
    ? date.toLocaleDateString("de-DE", {
        weekday: "short",
        day: "numeric",
        month: "long",
      })
    : "";

/**
 * Wandelt ein Date-Objekt in einen ISO-String "YYYY-MM-DD" um.
 * Nutzt bewusst die lokale Zeitzone (nicht toISOString()), damit
 * Datumswerte beim Umrechnen nicht durch eine UTC-Verschiebung einen
 * Tag springen.
 *
 * @param {Date|null} date
 * @returns {string}
 */
export const toISO = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Wandelt einen ISO-String "YYYY-MM-DD" zurück in ein Date-Objekt.
 *
 * @param {string} iso
 * @returns {Date}
 */
export const parseISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Wandelt einen deutschen Datumsstring "DD.MM.YYYY" in einen
 * ISO-String "YYYY-MM-DD" um (z.B. für Vergleich/Sortierung von
 * Buchungen, die so vom Backend kommen).
 *
 * @param {string} germanStr - z.B. "14.07.2026"
 * @returns {string} z.B. "2026-07-14", oder "" bei ungültiger/leerer Eingabe.
 */
export const germanToISO = (germanStr) => {
  if (!germanStr) return "";
  const parts = germanStr.split(".");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
};

/**
 * Wandelt einen deutschen Datumsstring "DD.MM.YYYY" in ein echtes
 * Date-Objekt um. Anders als germanToISO wird hier direkt ein Date
 * zurückgegeben - praktisch für Statusberechnungen ("liegt heute
 * zwischen Anreise und Abreise?").
 *
 * @param {string} dateStr - z.B. "14.07.2026"
 * @returns {Date} Bei fehlendem/leerem String: das heutige Datum als Fallback.
 */
export const parseGermanDate = (dateStr) => {
  if (!dateStr) return new Date();
  const [day, month, year] = dateStr.split(".").map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Prüft, ob sich zwei Zeiträume [startA, endA) und [startB, endB)
 * überschneiden. Wird für die Verfügbarkeitsprüfung von Objekten genutzt.
 *
 * @param {string} startA - ISO-Datum
 * @param {string} endA - ISO-Datum
 * @param {string} startB - ISO-Datum
 * @param {string} endB - ISO-Datum
 * @returns {boolean}
 */
export const ueberschneidenSich = (startA, endA, startB, endB) =>
  startA < endB && startB < endA;

/**
 * Berechnet die Anzahl der Nächte zwischen zwei Date-Objekten.
 *
 * @param {Date|null} start
 * @param {Date|null} end
 * @returns {number} Anzahl der Nächte (0, wenn start oder end fehlt).
 */
export const naechteZwischen = (start, end) => {
  if (!start || !end) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
};

/**
 * Vergleicht zwei Date-Objekte auf Kalendertag-Gleichheit (ignoriert
 * die Uhrzeit).
 *
 * @param {Date|null} d1
 * @param {Date|null} d2
 * @returns {boolean}
 */
export const isSameDay = (d1, d2) =>
  d1 &&
  d2 &&
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

/**
 * Prüft, ob ein Datum echt ZWISCHEN start und end liegt (start und end
 * selbst zählen nicht als "dazwischen"). Wird für die rote
 * "Brücken"-Markierung im Sidebar-Kalender des Buchungs-Assistenten
 * genutzt.
 *
 * @param {Date} date
 * @param {Date|null} start
 * @param {Date|null} end
 * @returns {boolean}
 */
export const isBetween = (date, start, end) => {
  if (!start || !end) return false;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return d > s && d < e;
};

/**
 * Prüft, ob ein Datum in der Vergangenheit liegt (der heutige Tag zählt
 * NICHT als vergangen). Wird genutzt, um Tage im Sidebar-Kalender zu
 * sperren.
 *
 * @param {Date} date
 * @returns {boolean}
 */
export const isPastDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return d < today;
};

/**
 * Ob ein Objekt eine Wohnung ist (statt Bus, Forum, oder was in Zukunft
 * sonst noch dazukommt). Zentral hier abgelegt, weil diese Unterscheidung
 * an vielen Stellen gebraucht wird (Objektlisten filtern, Gästeanzahl nur
 * bei Wohnungen abfragen, Preisbeschriftung "/Nacht" vs. "/Stunde", ...) -
 * vorher stand dieselbe Zeile lokal dupliziert in mehreren Dateien.
 *
 * @param {string} objektName
 * @returns {boolean}
 */
export const istWohnung = (objektName) => Boolean(objektName?.toLowerCase().includes("wohnung"));

/**
 * Ob ein Objekt der Bus ist. Wird für die "Zusatzobjekt dazubuchen"-Logik
 * gebraucht (nur Busse kommen aktuell als Zusatzobjekt zu einer
 * Wohnungsbuchung infrage).
 *
 * @param {string} objektName
 * @returns {boolean}
 */
export const istBus = (objektName) => Boolean(objektName?.toLowerCase().includes("bus"));

/**
 * Ob ein Objekt stundenweise abgerechnet wird. Die Regel ist bewusst
 * einfach gehalten: alles außer einer Wohnung wird pro Stunde
 * berechnet (Bus, Forum, und was in Zukunft sonst noch an "anderen
 * Objekten" dazukommt) - Wohnungen bleiben die einzige Ausnahme mit
 * Nächte-Abrechnung. Das Gegenteil von istWohnung().
 *
 * @param {string} objektName
 * @returns {boolean}
 */
export const istStundenbasiert = (objektName) => !istWohnung(objektName);

/**
 * Baut aus einem ISO-Datum ("2026-07-20") + einer Uhrzeit ("09:00")
 * ein echtes Date-Objekt. Fehlt die Uhrzeit, wird der Fallback genutzt
 * (Tagesanfang/-ende) - deckt Buchungen ohne gespeicherte Uhrzeit ab
 * (z.B. reine Wohnungsbuchungen).
 *
 * @param {string} dateISO
 * @param {string} zeitHHMM - "HH:MM", darf leer/undefined sein
 * @param {string} fallback - "HH:MM", wird genutzt wenn zeitHHMM fehlt
 * @returns {Date}
 */
export const zuDatumZeit = (dateISO, zeitHHMM, fallback) => {
  const [h, m] = (zeitHHMM || fallback).split(":").map(Number);
  const d = parseISO(dateISO);
  d.setHours(h, m, 0, 0);
  return d;
};

/**
 * Präzise Überschneidungsprüfung auf Datum+UHRZEIT-Ebene - wird für
 * stundenbasierte Objekte (Bus, Forum, ...) gebraucht.
 *
 * Die reine Datums-Prüfung (ueberschneidenSich, mit exklusivem
 * Enddatum wie bei Nächte-Zeiträumen üblich) behandelt eine
 * Ein-Tages-Buchung (start === end, z.B. eine Bus-Fahrt am selben Tag)
 * als "leeres" Zeitfenster - dadurch würde nie eine Überschneidung
 * erkannt, wenn zwei Buchungen desselben stundenbasierten Objekts auf
 * denselben Tag fallen, selbst bei exakt derselben Uhrzeit. Diese
 * Funktion prüft stattdessen die tatsächlichen Datum+Uhrzeit-
 * Zeitfenster gegeneinander, sodass ein Objekt am selben Tag mehrfach
 * gebucht werden kann, solange sich die Uhrzeiten nicht überschneiden.
 *
 * @param {string} startISO
 * @param {string} startZeit - "HH:MM"
 * @param {string} endISO
 * @param {string} endZeit - "HH:MM"
 * @param {string} bStartISO
 * @param {string} bStartZeit - "HH:MM"
 * @param {string} bEndISO
 * @param {string} bEndZeit - "HH:MM"
 * @returns {boolean}
 */
export const datumZeitUeberschneidenSich = (
  startISO,
  startZeit,
  endISO,
  endZeit,
  bStartISO,
  bStartZeit,
  bEndISO,
  bEndZeit,
) => {
  const startA = zuDatumZeit(startISO, startZeit, "00:00");
  const endA = zuDatumZeit(endISO, endZeit, "23:59");
  const startB = zuDatumZeit(bStartISO, bStartZeit, "00:00");
  const endB = zuDatumZeit(bEndISO, bEndZeit, "23:59");
  return startA < endB && startB < endA;
};

/**
 * Liefert den aktuellen Zeitpunkt als String "YYYY-MM-DDTHH:MM" - exakt
 * dasselbe Format wie eine zusammengesetzte Buchungsgrenze
 * (`${iso}T${zeit}`), damit man beide direkt als String vergleichen
 * kann (z.B. "aktuell belegt, wenn nowStr >= startFull && nowStr <= endFull").
 * Wird sowohl vom Dashboard (Live-Status pro Objekt) als auch vom
 * Buchungs-Assistenten (Verfügbarkeit ohne gewählten Zeitraum) genutzt,
 * damit beide dieselbe stunden-/minutengenaue Prüfung verwenden.
 *
 * @returns {string} z.B. "2026-07-14T09:32"
 */
export const getNowIsoWithTime = () => {
  const now = new Date();
  const dateStr = toISO(now);
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  return `${dateStr}T${hours}:${mins}`;
};

/**
 * Wandelt einen Objekt-Namen in eine passende CSS-Klasse um, z.B.
 * "Wohnung 1" -> "resource-wohnung-1". Wird für die Events im kleinen
 * Mini-Kalender-Popup des Dashboards verwendet (siehe
 * MiniKalenderModal.jsx / Dashboard.jsx: getFilteredEventsForCalendar).
 * Für den großen Kalender und die Legende übernimmt stattdessen
 * getResourceColor() weiter unten die Farbvergabe direkt per Inline-Style.
 *
 * @param {string} name
 * @returns {string}
 */
export const getResourceClass = (name) => {
  if (!name) return "resource-default";
  const cleanName = name.toLowerCase().trim().replace(/\s+/g, "-");
  return `resource-${cleanName}`;
};

// ─── AUTOMATISCHE FARBVERGABE FÜR KALENDER + LEGENDE ───
// Kalender.jsx, PortalKalender.jsx und Dashboard.jsx bauen ihre Events
// UND ihre Legende live aus der Objekte-Liste vom Backend - jedes
// Objekt bekommt hier zentral seine Farbe zugewiesen, damit ein neu
// angelegtes Objekt automatisch eine Farbe bekommt, ohne dass jemand
// dafür manuell eine CSS-Klasse anlegen muss.

/** Feste Farben für die "originalen" 5 Objekte. */
const FESTE_RESOURCE_FARBEN = {
  "wohnung 1": { bg: "#e30000", border: "#b80000" },
  "wohnung 2": { bg: "#3b82f6", border: "#1d4ed8" },
  "wohnung 3": { bg: "#10b981", border: "#047857" },
  "vito bus": { bg: "#f59e0b", border: "#b45309" },
  "forum beckhoff": { bg: "#ad9366", border: "#918167" },
};

/** Farbpalette, aus der sich NEUE Objekte (die nicht in FESTE_RESOURCE_FARBEN stehen) automatisch eine Farbe ziehen. */
const AUTO_FARBPALETTE = [
  { bg: "#8b5cf6", border: "#6d28d9" }, // Violett
  { bg: "#ec4899", border: "#be185d" }, // Pink
  { bg: "#06b6d4", border: "#0e7490" }, // Cyan
  { bg: "#84cc16", border: "#4d7c0f" }, // Limette
  { bg: "#6366f1", border: "#4338ca" }, // Indigo
  { bg: "#14b8a6", border: "#0f766e" }, // Teal
  { bg: "#eab308", border: "#a16207" }, // Gelb
  { bg: "#d946ef", border: "#a21caf" }, // Magenta
];

/**
 * Liefert Hintergrund-/Randfarbe für ein Objekt. Bekannte Objekte
 * (Wohnung 1-3, Vito Bus, Forum Beckhoff) behalten ihre feste Farbe.
 * Jedes andere/neue Objekt bekommt automatisch eine Farbe aus
 * AUTO_FARBPALETTE - über einen simplen Hash des Namens, damit dasselbe
 * Objekt bei jedem Aufruf/Reload immer dieselbe Farbe bekommt (statt
 * zufällig bei jedem Laden zu wechseln).
 *
 * @param {string} name - Objektname, z.B. "Wohnung 4" oder "Kajak"
 * @returns {{bg: string, border: string}}
 */
export const getResourceColor = (name) => {
  if (!name) return { bg: "#71717a", border: "#52525b" }; // Grauer Fallback, falls gar kein Name da ist

  const key = name.toLowerCase().trim();
  if (FESTE_RESOURCE_FARBEN[key]) return FESTE_RESOURCE_FARBEN[key];

  // Deterministischer Mini-Hash über den Namen (kein Zufall!) - dieselbe
  // Zeichenkette ergibt immer denselben Index in der Palette.
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AUTO_FARBPALETTE[hash % AUTO_FARBPALETTE.length];
};