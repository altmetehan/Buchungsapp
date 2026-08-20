import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { RechnungDocument } from "../pdf/RechnungDocument.js";
import { generiereNaechsteRechnungsnummer } from "../utils/invoiceUtils.js";

/**
 * rechnungen.routes.js
 * ---------------------
 * CRUD-Endpunkte für Rechnungen (/api/rechnungen) sowie deren
 * PDF-Erzeugung. Eine Rechnung hängt immer an genau einer Buchung.
 */
const router = Router();

/**
 * Gemeinsamer "include"-Block für die normalen JSON-Listen-/CRUD-
 * Endpunkte: holt Gast-, Objekt- und Buchungsdaten mit, damit das
 * Frontend Gast-/Objektnamen und Preis direkt zur Verfügung hat, ohne
 * selbst nachzufragen.
 */
const MIT_BUCHUNG_GAST_UND_OBJEKT = {
  include: {
    Buchungen: {
      include: {
        Gaeste: true,
        Objekte: true,
      },
    },
  },
};

/**
 * Eigener, vollständigerer Include NUR für die PDF-Routen -
 * MIT_BUCHUNG_GAST_UND_OBJEKT bleibt bewusst unverändert, damit sich am
 * normalen JSON-Response von GET / nichts ändert. 
 */
const MIT_VOLLSTAENDIGEN_BUCHUNGSDATEN = {
  include: {
    Buchungen: {
      include: {
        Gaeste: true,
        Objekte: true,
        Preisanpassungen: { orderBy: { erstellt_am: "asc" } },
      },
    },
  },
};

/**
 * Erlaubte, vom Client änderbare Felder einer bestehenden Rechnung
 * (PUT /:id). In der Praxis wird i.d.R. nur die Rechnungsnummer
 * oder das -datum manuell korrigiert.
 *
 * Vorher wurde "data: req.body" direkt durchgereicht (Mass-Assignment-
 * Risiko, z.B. ein versehentliches Überschreiben von "buchung_id").
 * Die explizite Liste hier verhindert das.
 *
 * @param {object} body - req.body
 * @returns {object}
 */
function baueRechnungUpdateDaten(body) {
  const erlaubteFelder = ["rechnungs_nummer", "rechnungs_datum"];
  const daten = {};
  for (const feld of erlaubteFelder) {
    if (body[feld] !== undefined) daten[feld] = body[feld];
  }
  return daten;
}

/**
 * Rendert eine Rechnung (per rechnungs_id ODER buchung_id gefunden) zu
 * einem PDF-Buffer inkl. konfigurierter Steuersätze (Ortstaxe, MwSt.).
 *
 * @param {object} where - Prisma-"where"-Bedingung, um genau eine Rechnung zu finden
 * @returns {Promise<{rechnung: object, pdfBuffer: Buffer}|null>} null, falls keine passende Rechnung existiert
 */
async function rendereRechnungsPdf(where) {
  const [rechnung, einstellungen] = await Promise.all([
    prisma.rechnungen.findFirst({
      where,
      ...MIT_VOLLSTAENDIGEN_BUCHUNGSDATEN,
    }),
    prisma.einstellungen.findFirst(),
  ]);

  if (!rechnung) return null;

  const pdfBuffer = await renderToBuffer(
    React.createElement(RechnungDocument, {
      rechnung,
      buchung: rechnung.Buchungen,
      einstellungen: einstellungen || {},
    })
  );

  return { rechnung, pdfBuffer };
}

/**
 * Schickt einen fertig gerenderten Beleg-PDF-Buffer als "inline"-Antwort raus.
 *
 * @param {import("express").Response} res
 * @param {{rechnung: object, pdfBuffer: Buffer}} ergebnis
 * @returns {void}
 */
function sendeRechnungsPdf(res, { rechnung, pdfBuffer }) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="Information-fuer-die-Buchhaltung-${rechnung.rechnungs_nummer}.pdf"`
  );
  res.send(pdfBuffer);
}

/**
 * GET /api/rechnungen
 * Liefert alle Rechnungen inkl. verknüpfter Buchung/Gast/Objekt.
 */
router.get("/", async (req, res) => {
  try {
    const rechnungen = await prisma.rechnungen.findMany({
      ...MIT_BUCHUNG_GAST_UND_OBJEKT,
      orderBy: { id: "asc" },
    });
    res.json(rechnungen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rechnungen
 * Legt eine neue Rechnung zu einer bestehenden Buchung an. Erwartet im
 * Body mindestens: buchung_id, rechnungs_datum (+ optional
 * rechnungs_nummer).
 *
 * Wird "rechnungs_nummer" nicht mitgeschickt (z.B. beim automatischen
 * Anlegen direkt nach einer Buchung aus dem Buchungs-Assistenten),
 * vergibt das Backend selbst eine fortlaufende Nummer. Die
 * Nummernvergabe passiert zentral hier statt im Frontend, damit zwei
 * kurz hintereinander abgeschlossene Buchungen nicht dieselbe Nummer
 * bekommen.
 */
router.post("/", async (req, res) => {
  try {
    let { rechnungs_nummer, buchung_id, rechnungs_datum } = req.body;
    if (!rechnungs_nummer) {
      rechnungs_nummer = await generiereNaechsteRechnungsnummer();
    }

    const neueRechnung = await prisma.rechnungen.create({
      data: {
        buchung_id: Number(buchung_id),
        rechnungs_datum,
        rechnungs_nummer,
      },
      ...MIT_BUCHUNG_GAST_UND_OBJEKT,
    });

    broadcast("rechnungen:changed");
    res.status(201).json(neueRechnung);
  } catch (err) {
    console.error("Fehler beim Erstellen der Rechnung:", err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/rechnungen/:id
 * Korrigiert i.d.R. nur Rechnungsnummer/-datum einer bestehenden
 * Rechnung.
 */
router.put("/:id", async (req, res) => {
  try {
    const updated = await prisma.rechnungen.update({
      where: { id: Number(req.params.id) },
      data: baueRechnungUpdateDaten(req.body),
      ...MIT_BUCHUNG_GAST_UND_OBJEKT,
    });
    broadcast("rechnungen:changed");
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/rechnungen/:id
 * Löscht eine Rechnung endgültig (kein Soft-Delete - eine Rechnung
 * ohne zugehörige Buchung hat keinen eigenen Aussagewert mehr).
 */
router.delete("/:id", async (req, res) => {
  try {
    await prisma.rechnungen.delete({ where: { id: Number(req.params.id) } });
    broadcast("rechnungen:changed");
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/rechnungen/:id/pdf
 * Baut die Rechnung als PDF und schickt sie direkt als Antwort zurück
 * - bewusst ohne die Datei irgendwo zu speichern/zu cachen. Grund:
 * buchung.preis kann sich jederzeit über eine Preisanpassung ändern
 * (Rechnungen.jsx-Bearbeiten-Modal) - bei einer gecachten Datei müsste
 * man bei jeder solchen Änderung aktiv daran denken, die alte PDF zu
 * löschen/neu zu bauen, sonst zeigt der Gast irgendwann einen
 * veralteten Betrag. Eine Rechnung zu rendern dauert nur Millisekunden
 * - "frisch bei jedem Klick" ist hier also die einfachere und
 * robustere Lösung.
 */
router.get("/:id/pdf", async (req, res) => {
  try {
    const ergebnis = await rendereRechnungsPdf({ id: Number(req.params.id) });

    if (!ergebnis) {
      return res.status(404).json({ error: "Rechnung nicht gefunden" });
    }

    sendeRechnungsPdf(res, ergebnis);
  } catch (err) {
    console.error("Fehler beim Erstellen der Rechnungs-PDF:", err);
    res.status(500).json({ error: "PDF konnte nicht erstellt werden" });
  }
});

/**
 * GET /api/rechnungen/buchung/:buchungId/pdf
 * Sucht die zur Buchungs-ID gehörende Rechnung und rendert das PDF -
 * praktisch, wenn (wie z.B. auf dem Dashboard) nur die Buchungs-ID zur
 * Hand ist, nicht die Rechnungs-ID.
 */
router.get("/buchung/:buchungId/pdf", async (req, res) => {
  try {
    const ergebnis = await rendereRechnungsPdf({ buchung_id: Number(req.params.buchungId) });

    if (!ergebnis) {
      return res.status(404).json({ error: "Keine Rechnung für diese Buchung gefunden" });
    }

    sendeRechnungsPdf(res, ergebnis);
  } catch (err) {
    console.error("Fehler beim Erstellen der Rechnungs-PDF:", err);
    res.status(500).json({ error: "PDF konnte nicht erstellt werden" });
  }
});

export default router;