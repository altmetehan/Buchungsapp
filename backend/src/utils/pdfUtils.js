import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

/**
 * pdfUtils.js
 * -----------
 * Hilfsfunktionen für die PDF-Generierung (@react-pdf/renderer kann
 * Bilder nur als URL oder Base64-Data-URI einbinden, nicht als
 * lokalen Dateipfad - daher das Einlesen + Base64-Kodieren hier).
 */

/** Verzeichnis dieser Datei (ESM hat kein __dirname eingebaut). */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sucht das Beckhoff-Logo an mehreren möglichen Pfaden (je nachdem, ob
 * der Code im Dev-Modus, aus dem Docker-Image oder von einem anderen
 * Arbeitsverzeichnis aus läuft) und liefert es als Base64-Data-URI
 * zurück, damit @react-pdf/renderer es direkt in der PDF einbetten
 * kann.
 *
 * Reihenfolge ist bewusst von "wahrscheinlichster Pfad" zu
 * "Fallback" sortiert; der erste tatsächlich existierende Pfad
 * gewinnt. Schlägt das Lesen eines Pfads fehl, wird das geloggt und
 * mit dem nächsten Kandidaten weitergemacht, statt die komplette
 * PDF-Erstellung abzubrechen.
 *
 * @returns {string|null} Data-URI (z.B. "data:image/jpeg;base64,...") oder null, falls kein Logo gefunden wurde (die PDF zeigt dann einen Text-Fallback "BECKHOFF" statt des Bildes)
 */
export function getLogoBase64() {
  const possiblePaths = [
    path.join(__dirname, "../assets/logorot.jpg"),
    path.join(__dirname, "../assets/logorot.png"),
    path.join(__dirname, "../../assets/logorot.jpg"),
    path.join(process.cwd(), "src/assets/logorot.jpg"),
    path.join(process.cwd(), "assets/logorot.jpg"),
    path.join(__dirname, "../../../frontend/src/assets/logorot.jpg"),
    path.join(__dirname, "../assets/logoschwarz.png"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const ext = path.extname(p).toLowerCase() === ".png" ? "png" : "jpeg";
        const fileBuffer = fs.readFileSync(p);
        return `data:image/${ext};base64,${fileBuffer.toString("base64")}`;
      } catch (err) {
        console.error(`[PDF] Fehler beim Lesen von ${p}:`, err);
      }
    }
  }

  return null;
}