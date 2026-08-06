import { Router } from "express";
import { prisma } from "../prismaClient.js";

const router = Router();

// GET /api/einstellungen
// Es gibt bewusst nur EINE Zeile (feste ID=1). "upsert" statt
// "findUnique" sorgt dafür, dass beim allerersten Aufruf (frisch
// migrierte DB, noch keine Zeile vorhanden) automatisch eine Zeile mit
// den in schema.prisma definierten Default-Werten angelegt wird - das
// Frontend muss also nie einen "noch keine Einstellungen vorhanden"-
// Sonderfall behandeln.
router.get("/", async (req, res) => {
  try {
    const einstellungen = await prisma.einstellungen.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    res.json(einstellungen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/einstellungen - aktualisiert die (einzige) Einstellungen-Zeile.
router.put("/", async (req, res) => {
  try {
    const { checkin_zeit, checkout_zeit, mindest_naechte_wohnung, kombirabatt } = req.body;
    const updated = await prisma.einstellungen.upsert({
      where: { id: 1 },
      update: { checkin_zeit, checkout_zeit, mindest_naechte_wohnung, kombirabatt },
      create: { id: 1, checkin_zeit, checkout_zeit, mindest_naechte_wohnung, kombirabatt },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;