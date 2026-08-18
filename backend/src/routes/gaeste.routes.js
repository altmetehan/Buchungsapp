import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";

const router = Router();

// GET /api/gaeste - Nur aktive (nicht gelöschte) Gäste
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

// POST /api/gaeste - Neuen Gast anlegen
router.post("/", async (req, res) => {
  try {
    const neuerGast = await prisma.gaeste.create({ data: req.body });
    broadcast("gaeste:changed");
    res.status(201).json(neuerGast);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/gaeste/:id - Gastdaten bearbeiten
router.put("/:id", async (req, res) => {
  try {
    const updated = await prisma.gaeste.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    });
    broadcast("gaeste:changed");
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/gaeste/:id - Soft-Delete mit Prüfung auf aktive/zukünftige Buchungen
router.delete("/:id", async (req, res) => {
  try {
    const gastId = Number(req.params.id);

    const aktiveBuchungen = await prisma.buchungen.findMany({
      where: { gast_id: gastId, geloescht_am: null },
    });

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    // BUGFIX: Robuste Datumsprüfung gegen leere/ungültige Strings
    const parseGerman = (str) => {
      if (!str || typeof str !== "string") return new Date(0);
      const parts = str.split(".").map(Number);
      if (parts.length !== 3) return new Date(0);
      return new Date(parts[2], parts[1] - 1, parts[0]);
    };

    const hatAktiveBuchung = aktiveBuchungen.some((b) => parseGerman(b.abreise) >= heute);
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