import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";

const router = Router();

// GET /api/gaeste - nur NICHT gelöschte Gäste (Soft-Delete-Filter)
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

router.post("/", async (req, res) => {
    try {
        const neuerGast = await prisma.gaeste.create({ data: req.body });
        broadcast("gaeste:changed");
        res.status(201).json(neuerGast);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put("/:id", async(req, res) => {
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

// DELETE /api/gaeste/:id - jetzt ein SOFT-Delete (setzt nur geloescht_am).
// Blockiert wird das Löschen, wenn der Gast noch eine aktive oder
// zukünftige Buchung hat - vergangene Buchungen blockieren bewusst
// NICHT, sonst könnte man langjährige Gäste nie aus der aktiven Liste
// entfernen, obwohl ihre letzte Reise Jahre her ist.
router.delete("/:id", async(req, res) => {
    try {
        const gastId = Number(req.params.id);

        const aktiveBuchungen = await prisma.buchungen.findMany({
            where: { gast_id: gastId, geloescht_am: null },
        });

        const heute = new Date();
        heute.setHours(0, 0, 0, 0);
        const parseGerman = (str) => {
            const [d, m, y] = str.split(".").map(Number);
            return new Date(y, m - 1, d);
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