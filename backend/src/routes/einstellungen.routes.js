import { Router } from "express";
import { prisma } from "../prismaClient.js";

/**
 * einstellungen.routes.js
 * ------------------------
 * Endpunkte für die zentralen, globalen App-Einstellungen
 * (/api/einstellungen) - Check-in-/Check-out-Zeit für Wohnungen,
 * Mindestaufenthaltsdauer, Kombi-Rabatt für Zusatzobjekte sowie
 * optionale Wochentags-Restriktionen für An-/Abreise. Es gibt bewusst
 * immer nur GENAU EINE Einstellungen-Zeile (feste id: 1) - kein
 * CRUD im klassischen Sinn, sondern nur Lesen (GET) und
 * Aktualisieren/Erstmalig-Anlegen (PUT, per Upsert).
 */
const router = Router();

/**
 * GET /api/einstellungen
 * Liefert die aktuellen Einstellungen. Existiert die feste
 * Einstellungen-Zeile (id: 1) noch nicht (z.B. ganz frischer
 * Datenbestand ohne Seed), wird sie per Upsert mit den
 * Schema-Standardwerten automatisch angelegt, statt mit einem Fehler
 * zu enden.
 */
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

/**
 * PUT /api/einstellungen
 * Aktualisiert die zentrale Einstellungen-Zeile (oder legt sie an,
 * falls sie ausnahmsweise noch fehlt - daher ebenfalls ein Upsert).
 * Erwartet im Body: checkin_zeit, checkout_zeit,
 * mindest_naechte_wohnung, kombirabatt, checkin_wochentag,
 * checkout_wochentag.
 *
 * checkin_wochentag/checkout_wochentag werden bewusst nie als
 * null/undefined gespeichert (Fallback auf Leerstring), damit
 * "keine Einschränkung" im gesamten System einheitlich als "" statt
 * abwechselnd als null oder "" auftaucht.
 */
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