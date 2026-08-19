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
 * explizite Feldliste hier schließt das aus: nur diese vier Werte
 * werden je aus dem Body übernommen, alles andere wird ignoriert.
 *
 * @param {object} body - req.body
 * @returns {{name: string, beschreibung: string|null, kennzeichen: string|null, preis: number}}
 */
function baueObjektDaten(body) {
  return {
    name: body.name,
    beschreibung: body.beschreibung ?? null,
    kennzeichen: body.kennzeichen ?? null,
    preis: body.preis,
  };
}

/**
 * GET /api/objekte
 * Liefert alle aktiven (nicht gelöschten) Objekte.
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
 * POST /api/objekte
 * Legt ein neues Objekt an. Erwartet im Body: name, beschreibung,
 * kennzeichen (optional), preis.
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
 * Aktualisiert die Stammdaten eines bestehenden Objekts.
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
        OR: [{ objekt_id: objektId }, { objekt_id_2: objektId }],
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