// backend/src/routes/buchungen.routes.js
import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { BuchungsbestaetigungDocument } from "../pdf/BuchungsBestaetigungDocument.js";

/**
 * buchungen.routes.js
 * --------------------
 * CRUD-Endpunkte für Buchungen (/api/buchungen) sowie die daraus
 * abgeleitete Buchungsbestätigung als PDF. Buchungen werden per
 * Soft-Delete storniert (geloescht_am gesetzt), damit die Historie
 * (Preisanpassungen, Rechnungen) erhalten bleibt.
 */
const router = Router();

/**
 * Gemeinsamer "include"-Block für praktisch jede Buchungs-Abfrage.
 */
const MIT_GAST_UND_OBJEKTEN = {
  include: {
    Gaeste: true,
    Objekte: true,
    Preisanpassungen: { orderBy: { erstellt_am: "desc" } },
  },
};

/**
 * Erlaubte, vom Client änderbare Felder einer bestehenden Buchung
 * (PUT /:id).
 *
 * @param {object} body - req.body
 * @returns {object}
 */
function baueBuchungUpdateDaten(body) {
  const erlaubteFelder = [
    "anreise",
    "abreise",
    "anreise_zeit",
    "abreise_zeit",
    "preis",
    "infos",
    "erwachsene",
    "kinder",
  ];

  const daten = {};
  for (const feld of erlaubteFelder) {
    if (body[feld] !== undefined) daten[feld] = body[feld];
  }
  return daten;
}

/**
 * GET /api/buchungen
 * Liefert alle nicht stornierten Buchungen inkl. Gast-, Objekt- und
 * Preisanpassungsdaten.
 */
router.get("/", async (req, res) => {
  try {
    const buchungen = await prisma.buchungen.findMany({
      where: { geloescht_am: null },
      ...MIT_GAST_UND_OBJEKTEN,
      orderBy: { id: "asc" },
    });
    res.json(buchungen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/buchungen
 * Legt eine neue Buchung an. Erwartet mindestens: gast_id, objekt_id,
 * anreise, abreise (+ optional anreise_zeit, abreise_zeit, erwachsene,
 * kinder, preis, infos).
 */
router.post("/", async (req, res) => {
  try {
    const {
      gast_id,
      objekt_id,
      anreise,
      abreise,
      anreise_zeit,
      abreise_zeit,
      erwachsene,
      kinder,
      preis,
      infos,
      pkw,
    } = req.body;

    const neueBuchung = await prisma.buchungen.create({
      data: {
        gast_id: Number(gast_id),
        objekt_id: Number(objekt_id),
        anreise,
        abreise,
        anreise_zeit: anreise_zeit || null,
        abreise_zeit: abreise_zeit || null,
        erwachsene: erwachsene ? Number(erwachsene) : null,
        kinder: kinder ? Number(kinder) : null,
        preis: Number(preis),
        infos: infos || null,
        pkw: pkw || null,
      },
      ...MIT_GAST_UND_OBJEKTEN,
    });

    broadcast("buchungen:changed");
    res.status(201).json(neueBuchung);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/buchungen/:id
 * Aktualisiert eine bestehende Buchung.
 *
 * Wird bei dieser Bearbeitung auch die Abreise geändert, muss das
 * Rechnungsdatum der verknüpften Rechnung automatisch mitwandern.
 * Beides läuft in EINER Transaktion.
 */
router.put("/:id", async (req, res) => {
  try {
    const buchungId = Number(req.params.id);
    const updateDaten = baueBuchungUpdateDaten(req.body);

    const [updated] = await prisma.$transaction([
      prisma.buchungen.update({
        where: { id: buchungId },
        data: updateDaten,
        ...MIT_GAST_UND_OBJEKTEN,
      }),
      ...(updateDaten.abreise
        ? [
            prisma.rechnungen.updateMany({
              where: { buchung_id: buchungId },
              data: { rechnungs_datum: updateDaten.abreise },
            }),
          ]
        : []),
    ]);

    broadcast("buchungen:changed");
    if (updateDaten.abreise) broadcast("rechnungen:changed");
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/buchungen/:id
 * Storniert eine Buchung per Soft-Delete (geloescht_am wird gesetzt)
 * und löscht die zugehörige(n) Rechnung(en) endgültig.
 */
router.delete("/:id", async (req, res) => {
  try {
    const buchungId = Number(req.params.id);
    await prisma.$transaction([
      prisma.buchungen.update({
        where: { id: buchungId },
        data: { geloescht_am: new Date() },
      }),
      prisma.rechnungen.deleteMany({
        where: { buchung_id: buchungId },
      }),
    ]);

    broadcast("buchungen:changed");
    broadcast("rechnungen:changed");
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/buchungen/:id/preisanpassungen
 * Liefert die reine Preisänderungs-Historie für EINE Buchung.
 */
router.get("/:id/preisanpassungen", async (req, res) => {
  try {
    const buchungId = Number(req.params.id);
    const preisanpassungen = await prisma.preisanpassungen.findMany({
      where: { buchung_id: buchungId },
      orderBy: { erstellt_am: "desc" },
    });
    res.json(preisanpassungen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/buchungen/:id/preisanpassungen
 * Legt eine neue Preisanpassung an UND setzt direkt den neuen Preis
 * auf der Buchung selbst.
 */
router.post("/:id/preisanpassungen", async (req, res) => {
  try {
    const buchungId = Number(req.params.id);
    const { neuer_betrag, grund } = req.body;

    if (neuer_betrag === undefined || neuer_betrag === null || isNaN(Number(neuer_betrag))) {
      return res.status(400).json({ error: "neuer_betrag fehlt oder ist ungültig" });
    }
    if (!grund || !grund.trim()) {
      return res.status(400).json({ error: "Eine Begründung ist erforderlich" });
    }

    const bestehendeBuchung = await prisma.buchungen.findUnique({ where: { id: buchungId } });
    if (!bestehendeBuchung) {
      return res.status(404).json({ error: "Buchung nicht gefunden" });
    }

    const alterBetrag = bestehendeBuchung.preis ?? 0;
    const neuerBetrag = Math.round(Number(neuer_betrag) * 100) / 100;

    const [, aktualisierteBuchung] = await prisma.$transaction([
      prisma.preisanpassungen.create({
        data: {
          buchung_id: buchungId,
          alter_betrag: alterBetrag,
          neuer_betrag: neuerBetrag,
          grund: grund.trim(),
        },
      }),
      prisma.buchungen.update({
        where: { id: buchungId },
        data: { preis: neuerBetrag },
        ...MIT_GAST_UND_OBJEKTEN,
      }),
    ]);

    broadcast("buchungen:changed");
    res.status(201).json(aktualisierteBuchung);
  } catch (err) {
    console.error("Fehler beim Anlegen der Preisanpassung:", err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/buchungen/oeffentlich
 * Für die öffentliche Portal-Seite: liefert NUR Objektname + Zeitraum,
 * absichtlich OHNE Gast-Daten. Private (nicht "oeffentlich" markierte)
 * Objekte werden herausgefiltert.
 */
router.get("/oeffentlich", async (req, res) => {
  try {
    const buchungenRoh = await prisma.buchungen.findMany({
      where: { geloescht_am: null },
      select: {
        id: true,
        anreise: true,
        abreise: true,
        anreise_zeit: true,
        abreise_zeit: true,
        Objekte: { select: { name: true, oeffentlich: true } },
      },
    });

    const buchungen = buchungenRoh
      .map((b) => ({
        ...b,
        Objekte: b.Objekte?.oeffentlich ? { name: b.Objekte.name } : null,
      }))
      .filter((b) => b.Objekte);

    res.json(buchungen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/buchungen/:id/pdf
 * Generiert die Buchungsbestätigung als PDF und liefert sie direkt in
 * der Antwort ("inline").
 */
router.get("/:id/pdf", async (req, res) => {
  try {
    const [buchung, einstellungen] = await Promise.all([
      prisma.buchungen.findUnique({
        where: { id: Number(req.params.id) },
        include: {
          Gaeste: true,
          Objekte: true,
        },
      }),
      prisma.einstellungen.findFirst(),
    ]);

    if (!buchung) {
      return res.status(404).json({ error: "Buchung nicht gefunden" });
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(BuchungsbestaetigungDocument, { buchung, einstellungen: einstellungen || {} })
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Buchungsbestaetigung_${buchung.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Fehler beim Erstellen der Buchungsbestätigung:", err);
    return res.status(500).json({ error: "Fehler beim Erstellen der PDF" });
  }
});

export default router;