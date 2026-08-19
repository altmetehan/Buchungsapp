import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";
import { parseGermanDate } from "../utils/dateUtils.js";

/**
 * gaeste.routes.js
 * ----------------
 * CRUD-Endpunkte für die Gästeverwaltung (/api/gaeste). Gäste werden
 * per Soft-Delete entfernt (geloescht_am gesetzt statt Zeile
 * gelöscht), damit historische Buchungen weiterhin auf ihren Gast
 * verweisen können.
 */
const router = Router();

/**
 * Normalisiert eine E-Mail-Adresse aus dem Request-Body: trimmt
 * Whitespace und wandelt in Kleinschreibung um. Leere Strings werden
 * zu null, damit sie nicht versehentlich die Unique-Constraint auf
 * "email" verletzen (mehrere Gäste ohne E-Mail wären sonst alle
 * "gleich").
 *
 * @param {string|null|undefined} email
 * @returns {string|null}
 */
function normalisiereEmail(email) {
  return email && email.trim() !== "" ? email.trim().toLowerCase() : null;
}

/**
 * GET /api/gaeste
 * Liefert alle aktiven (nicht gelöschten) Gäste.
 */
router.get("/", async (req, res) => {
  try {
    const gaeste = await prisma.gaeste.findMany({
      where: { geloescht_am: null },
    });
    res.json(gaeste);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/gaeste
 * Legt einen neuen Gast an. Erwartet im Body: name, email, telnr,
 * strasse, hnr, plz, stadt, land. Lehnt doppelte E-Mail-Adressen unter
 * aktiven Gästen ab (freundliche Fehlermeldung statt rohem
 * Datenbankfehler).
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, telnr, strasse, hnr, plz, stadt, land } = req.body;
    const emailClean = normalisiereEmail(email);

    // Vorab-Prüfung auf doppelte E-Mail bei aktiven Gästen - liefert
    // eine verständliche 400er-Meldung statt eines rohen
    // Datenbank-Constraint-Fehlers weiter unten.
    if (emailClean) {
      const bestehenderGast = await prisma.gaeste.findFirst({
        where: { email: emailClean, geloescht_am: null },
      });

      if (bestehenderGast) {
        return res.status(400).json({
          error: "Ein Gast mit dieser E-Mail-Adresse existiert bereits.",
        });
      }
    }

    const neuerGast = await prisma.gaeste.create({
      data: {
        name,
        email: emailClean,
        telnr: telnr || null,
        strasse: strasse || null,
        hnr: hnr || null,
        plz: plz || null,
        stadt: stadt || null,
        land: land || "Österreich",
      },
    });

    broadcast("gaeste:changed");
    res.status(201).json(neuerGast);
  } catch (err) {
    // Prisma-Unique-Constraint-Fehler (P2002) als eigenen, freundlichen
    // Fehler abfangen statt der internen Prisma-Fehlermeldung.
    if (err.code === "P2002") {
      return res.status(400).json({
        error: "Ein Gast mit dieser E-Mail-Adresse existiert bereits.",
      });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/gaeste/:id
 * Aktualisiert die Stammdaten eines bestehenden Gasts. Prüft erneut
 * auf E-Mail-Duplikate (unter Ausschluss des Gasts selbst).
 */
router.put("/:id", async (req, res) => {
  try {
    const gastId = Number(req.params.id);
    const { name, email, telnr, strasse, hnr, plz, stadt, land } = req.body;
    const emailClean = normalisiereEmail(email);

    // Duplikat-Prüfung auf andere aktive Gäste (NOT id: gastId), damit
    // ein Gast seine eigene, unveränderte E-Mail behalten darf.
    if (emailClean) {
      const duplikat = await prisma.gaeste.findFirst({
        where: {
          email: emailClean,
          geloescht_am: null,
          NOT: { id: gastId },
        },
      });

      if (duplikat) {
        return res.status(400).json({
          error: "Ein Gast mit dieser E-Mail-Adresse existiert bereits.",
        });
      }
    }

    const updated = await prisma.gaeste.update({
      where: { id: gastId },
      // Bewusst ein explizites Datenobjekt statt "data: req.body":
      // so kann der Request-Body keine unerwarteten Felder (z.B. eine
      // fremde "id" oder "geloescht_am") mit-updaten.
      data: {
        name,
        email: emailClean,
        telnr: telnr || null,
        strasse: strasse || null,
        hnr: hnr || null,
        plz: plz || null,
        stadt: stadt || null,
        land: land || "Österreich",
      },
    });

    broadcast("gaeste:changed");
    res.json(updated);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({
        error: "Ein Gast mit dieser E-Mail-Adresse existiert bereits.",
      });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/gaeste/:id
 * Soft-Delete eines Gasts. Wird verweigert, solange der Gast noch eine
 * aktive oder zukünftige Buchung hat (abgeleitet aus dem
 * Abreisedatum), damit historische/aktuelle Buchungen nie auf einen
 * "verschwundenen" Gast zeigen.
 */
router.delete("/:id", async (req, res) => {
  try {
    const gastId = Number(req.params.id);
    const aktiveBuchungen = await prisma.buchungen.findMany({
      where: { gast_id: gastId, geloescht_am: null },
    });

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    const hatAktiveBuchung = aktiveBuchungen.some((b) => parseGermanDate(b.abreise) >= heute);
    if (hatAktiveBuchung) {
      return res.status(400).json({
        error: "Dieser Gast hat noch aktive oder zukünftige Buchungen und kann nicht gelöscht werden.",
      });
    }

    await prisma.gaeste.update({
      where: { id: gastId },
      data: { geloescht_am: new Date() },
    });

    broadcast("gaeste:changed");
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;