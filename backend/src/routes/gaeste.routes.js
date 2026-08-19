import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";
import { parseGermanDate } from "../utils/dateUtils.js";

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
    const { name, email, telnr, strasse, hnr, plz, stadt, land } = req.body;
    const emailClean = email && email.trim() !== "" ? email.trim().toLowerCase() : null;

    // 1. Prüfung auf doppelte E-Mail bei aktiven Gästen
    if (emailClean) {
      const bestehenderGast = await prisma.gaeste.findFirst({
        where: {
          email: emailClean,
          geloescht_am: null,
        },
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
    // Prisma Unique-Constraint-Fehler (P2002) abfangen
    if (err.code === "P2002") {
      return res.status(400).json({
        error: "Ein Gast mit dieser E-Mail-Adresse existiert bereits.",
      });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/gaeste/:id - Gastdaten bearbeiten
router.put("/:id", async (req, res) => {
  try {
    const gastId = Number(req.params.id);
    const { name, email, telnr, strasse, hnr, plz, stadt, land } = req.body;
    const emailClean = email && email.trim() !== "" ? email.trim().toLowerCase() : null;

    // Prüfung auf doppelte E-Mail (andere aktive Gäste ausschließen)
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

// DELETE /api/gaeste/:id - Soft-Delete mit Prüfung auf aktive/zukünftige Buchungen
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