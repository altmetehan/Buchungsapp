import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";
import { parseGermanDate } from "../utils/dateUtils.js";

/**
 * objekte.routes.js
 * -----------------
 * CRUD-Endpunkte für die Objektverwaltung (/api/objekte) - Wohnungen,
 * Bus, Forum usw. Objekte werden per Soft-Delete entfernt, damit
 * bestehende Buchungen weiterhin auf ihr Objekt verweisen können.
 */
const router = Router();

/**
 * Erlaubte, vom Client änderbare Felder eines Objekts. Wird sowohl bei
 * POST (neu anlegen) als auch bei PUT (bearbeiten) genutzt, um aus dem
 * rohen req.body ein "sauberes" Datenobjekt zu bauen.
 *
 * Vorher wurde hier direkt "data: req.body" an Prisma durchgereicht -
 * dadurch hätte ein Request theoretisch auch interne Felder wie "id"
 * oder "geloescht_am" mit-überschreiben können (Mass-Assignment). Die
 * explizite Feldliste hier schließt das aus: nur diese Werte werden
 * je aus dem Body übernommen, alles andere wird ignoriert.
 *
 * "oeffentlich" steuert, ob das Objekt im öffentlichen Portal
 * (Belegungsplan + Anfrage-Seite) überhaupt sichtbar ist - Standard
 * ist "nicht öffentlich" (0), falls das Feld fehlt.
 *
 * @param {object} body - req.body
 * @returns {{name: string, beschreibung: string|null, kennzeichen: string|null, preis: number, oeffentlich: number}}
 */
function baueObjektDaten(body) {
  return {
    name: body.name,
    beschreibung: body.beschreibung ?? null,
    kennzeichen: body.kennzeichen ?? null,
    preis: body.preis,
    oeffentlich: body.oeffentlich ? 1 : 0,
  };
}

/**
 * GET /api/objekte
 * Liefert alle aktiven (nicht gelöschten) Objekte - für den internen
 * Admin-Bereich, unabhängig vom "oeffentlich"-Status.
 */
router.get("/", async (req, res) => {
  try {
    const objekte = await prisma.objekte.findMany({
      where: { geloescht_am: null },
    });
    res.json(objekte);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/objekte/oeffentlich
 * Für die öffentliche Portal-Seite (Belegungsplan + Anfrage stellen):
 * liefert NUR aktive Objekte, die explizit als öffentlich markiert
 * wurden (oeffentlich = 1). Alles andere (z.B. interne Objekte) bleibt
 * für Portal-Besucher komplett unsichtbar - nicht nur ausgeblendet,
 * sondern gar nicht erst an den Client übertragen.
 */
router.get("/oeffentlich", async (req, res) => {
  try {
    const objekte = await prisma.objekte.findMany({
      where: { geloescht_am: null, oeffentlich: 1 },
    });
    res.json(objekte);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/objekte
 * Legt ein neues Objekt an. Erwartet im Body: name, beschreibung,
 * kennzeichen (optional), preis, oeffentlich (optional, Standard false).
 */
router.post("/", async (req, res) => {
  try {
    const neuesObjekt = await prisma.objekte.create({ data: baueObjektDaten(req.body) });
    broadcast("objekte:changed");
    res.status(201).json(neuesObjekt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/objekte/:id
 * Aktualisiert die Stammdaten eines bestehenden Objekts (inkl.
 * "oeffentlich"-Status).
 */
router.put("/:id", async (req, res) => {
  try {
    const updated = await prisma.objekte.update({
      where: { id: Number(req.params.id) },
      data: baueObjektDaten(req.body),
    });
    broadcast("objekte:changed");
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/objekte/:id
 * Soft-Delete eines Objekts. Wird verweigert, solange das Objekt (als
 * Haupt- ODER Zusatzobjekt) noch in einer aktiven oder zukünftigen
 * Buchung steckt, damit keine Buchung nachträglich "ins Leere" zeigt.
 */
router.delete("/:id", async (req, res) => {
  try {
    const objektId = Number(req.params.id);
    const betroffeneBuchungen = await prisma.buchungen.findMany({
      where: {
        geloescht_am: null,
        objekt_id: objektId,
      },
    });

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    const hatAktiveBuchung = betroffeneBuchungen.some((b) => parseGermanDate(b.abreise) >= heute);
    if (hatAktiveBuchung) {
      return res.status(400).json({
        error: "Dieses Objekt hat noch aktive oder zukünftige Buchungen und kann nicht gelöscht werden.",
      });
    }

    await prisma.objekte.update({
      where: { id: objektId },
      data: { geloescht_am: new Date() },
    });

    broadcast("objekte:changed");
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;