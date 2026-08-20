/**
 * validation.js
 * -------------
 * Zentrale, seitenunabhängige Validierungs-Bausteine. Vorher hatte
 * jede Seite ihre eigene Handvoll verstreuter if-Abfragen vor dem
 * Speichern (z.B. "if (!newObject.name) return alert(...)"), mit
 * leicht unterschiedlichem Verhalten und Text. Jetzt gibt es hier
 * kleine, kombinierbare Prüf-Funktionen sowie "validateForm", die eine
 * ganze Formular-Regeldefinition auf einmal durchprüft und ALLE Fehler
 * gesammelt zurückgibt - dadurch können z.B. mehrere Pflichtfelder auf
 * einmal rot markiert werden, statt dass man bei jedem Fehler einzeln
 * erneut auf "Speichern" klicken muss.
 *
 * Jeder Validator hat dieselbe Form: (wert) => string|null
 * (null = gültig, String = Fehlermeldung).
 */

export const required = (message = "Dieses Feld ist erforderlich") => (value) => {
  if (value === null || value === undefined) return message;
  if (typeof value === "string" && value.trim() === "") return message;
  return null;
};

export const isEmail = (message = "Bitte eine gültige E-Mail-Adresse eingeben") => (value) => {
  if (!value) return null; // leer wird von required() behandelt, hier nicht doppelt melden
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? null : message;
};

export const isNonNegativeNumber = (message = "Bitte eine gültige Zahl (0 oder größer) eingeben") => (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = parseFloat(value.toString().replace(",", "."));
  return !isNaN(num) && num >= 0 ? null : message;
};

export const minValue = (min, message) => (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = parseFloat(value.toString().replace(",", "."));
  if (isNaN(num)) return null; // Zahlenformat wird von isPositiveNumber() abgedeckt
  return num >= min ? null : message || `Der Wert muss mindestens ${min} betragen`;
};

/**
 * Prüft ein komplettes Formular-Objekt gegen ein Regel-Objekt.
 *
 * @param {object} values - z.B. { name: "Max", email: "" }
 * @param {object} rules - z.B. { name: [required()], email: [required(), isEmail()] }
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateForm(values, rules) {
  const errors = {};

  for (const field of Object.keys(rules)) {
    for (const validator of rules[field]) {
      const error = validator(values[field]);
      if (error) {
        errors[field] = error;
        break; // erster Fehler pro Feld reicht - nächstes Feld prüfen
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}