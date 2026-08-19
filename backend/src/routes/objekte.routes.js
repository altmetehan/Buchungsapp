import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";
import { parseGermanDate } from "../utils/dateUtils.js";

const router = Router();

// GET /api/objekte - Liefert alle nicht-gelöschten Objekte
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

// POST /api/objekte - Neues Objekt erstellen
router.post("/", async (req, res) => {
  try {
    const neuesObjekt = await prisma.objekte.create({ data: req.body });
    broadcast("objekte:changed");
    res.status(201).json(neuesObjekt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/objekte/:id - Objekt bearbeiten
router.put("/:id", async (req, res) => {
  try {
    const updated = await prisma.objekte.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    });
    broadcast("objekte:changed");
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/objekte/:id - Soft-Delete mit Schutz vor aktiven Buchungen
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