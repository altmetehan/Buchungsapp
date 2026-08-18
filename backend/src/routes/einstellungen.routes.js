import { Router } from "express";
import { prisma } from "../prismaClient.js";

const router = Router();

// GET /api/einstellungen
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

// PUT /api/einstellungen - aktualisiert die Einstellungen-Zeile
router.put("/", async (req, res) => {
  try {
    const {
      checkin_zeit,
      checkout_zeit,
      mindest_naechte_wohnung,
      kombirabatt,
      checkin_wochentag,
      checkout_wochentag,
    } = req.body;

    const updated = await prisma.einstellungen.upsert({
      where: { id: 1 },
      update: {
        checkin_zeit,
        checkout_zeit,
        mindest_naechte_wohnung,
        kombirabatt,
        checkin_wochentag: checkin_wochentag || "",
        checkout_wochentag: checkout_wochentag || "",
      },
      create: {
        id: 1,
        checkin_zeit,
        checkout_zeit,
        mindest_naechte_wohnung,
        kombirabatt,
        checkin_wochentag: checkin_wochentag || "",
        checkout_wochentag: checkout_wochentag || "",
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;