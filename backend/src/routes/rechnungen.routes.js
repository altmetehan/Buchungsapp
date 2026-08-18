import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { RechnungDocument } from "../pdf/RechnungDocument.js";

const router = Router();

/**
 * Eine Rechnung hängt an genau einer Buchung, die wiederum einen Gast
 * und ein Objekt hat - dieser "include"-Block holt alle drei Ebenen auf
 * einmal, damit das Frontend Gast-/Objektnamen und Preis direkt zur
 * Verfügung hat, ohne selbst nachfragen zu müssen.
 */
const MIT_BUCHUNG_GAST_UND_OBJEKT = {
  include: {
    Buchungen: {
      include: {
        Gaeste: true,
        Objekte: true,
        ObjekteZusatz: true,
      },
    },
  },
};

/** GET /api/rechnungen - liefert alle Rechnungen inkl. verknüpfter Buchung/Gast/Objekt. */
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
 * Ermittelt die nächste fortlaufende Rechnungsnummer für das aktuelle
 * Jahr im Format "RE-<Jahr>-<laufende Nummer>", z.B. "RE-2026-0013".
 *
 * @returns {Promise<string>}
 */
async function generiereNaechsteRechnungsnummer() {
  const jahr = new Date().getFullYear();

  // 1. Alle Rechnungsnummern des aktuellen Jahres laden
  const rechnungenDesJahres = await prisma.rechnungen.findMany({
    where: {
      rechnungs_nummer: { startsWith: `RE-${jahr}-` },
    },
    select: { rechnungs_nummer: true },
  });

  // 2. Die hintere Zahl aus jeder Rechnungsnummer extrahieren
  const vorhandeneZahlen = rechnungenDesJahres.map((r) => {
    const teile = r.rechnungs_nummer.split("-");
    const zahl = parseInt(teile[teile.length - 1], 10);
    return isNaN(zahl) ? 0 : zahl;
  });

  // 3. Höchste Zahl finden und um 1 erhöhen (startet bei 1, wenn noch keine existiert)
  const hoechsteZahl = vorhandeneZahlen.length > 0 ? Math.max(...vorhandeneZahlen) : 0;
  const naechsteZahl = hoechsteZahl + 1;

  return `RE-${jahr}-${String(naechsteZahl).padStart(4, "0")}`;
}

/**
 * POST /api/rechnungen - legt eine neue Rechnung zu einer bestehenden
 * Buchung an. Erwartet im Body mindestens: buchung_id, rechnungs_datum
 * (+ optional rechnungs_nummer).
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

/** PUT /api/rechnungen/:id - i.d.R. nur Rechnungsnummer/-datum korrigieren. */
router.put("/:id", async (req, res) => {
  try {
    const updated = await prisma.rechnungen.update({
      where: { id: Number(req.params.id) },
      data: req.body,
      ...MIT_BUCHUNG_GAST_UND_OBJEKT,
    });
    broadcast("rechnungen:changed");
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** DELETE /api/rechnungen/:id - löscht eine Rechnung endgültig. */
router.delete("/:id", async (req, res) => {
  try {
    await prisma.rechnungen.delete({ where: { id: Number(req.params.id) } });
    broadcast("rechnungen:changed");
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eigener, vollständigerer Include NUR für die PDF-Route -
// MIT_BUCHUNG_GAST_UND_OBJEKT bleibt bewusst unverändert, damit sich am
// normalen JSON-Response von GET / nichts ändert. Die PDF braucht
// zusätzlich ObjekteZusatz (Kombibuchung Wohnung + Bus) und die
// komplette Preisanpassungs-Historie.
const MIT_VOLLSTAENDIGEN_BUCHUNGSDATEN = {
  include: {
    Buchungen: {
      include: {
        Gaeste: true,
        Objekte: true,
        ObjekteZusatz: true,
        Preisanpassungen: { orderBy: { erstellt_am: "asc" } },
      },
    },
  },
};

/**
 * GET /api/rechnungen/:id/pdf
 * ----------------------------
 * Baut die Rechnung als PDF und schickt sie direkt als Antwort zurück -
 * bewusst ohne die Datei irgendwo zu speichern/zu cachen. Grund:
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
    const rechnung = await prisma.rechnungen.findUnique({
      where: { id: Number(req.params.id) },
      ...MIT_VOLLSTAENDIGEN_BUCHUNGSDATEN,
    });
    if (!rechnung) {
      return res.status(404).json({ error: "Rechnung nicht gefunden" });
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(RechnungDocument, { rechnung, buchung: rechnung.Buchungen }),
    );

    res.setHeader("Content-Type", "application/pdf");
    // "inline" statt "attachment": öffnet die PDF im Browser-Tab, statt
    // sie sofort erzwungen herunterzuladen - von dort kann man sie
    // trotzdem ganz normal über den Browser abspeichern.
    res.setHeader("Content-Disposition", `inline; filename="Rechnung-${rechnung.rechnungs_nummer}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Fehler beim Erstellen der Rechnungs-PDF:", err);
    res.status(500).json({ error: "PDF konnte nicht erstellt werden" });
  }
});

/**
 * GET /api/rechnungen/buchung/:buchungId/pdf
 * ------------------------------------------
 * Sucht die zur Buchungs-ID gehörende Rechnung und rendert das PDF.
 */
router.get("/buchung/:buchungId/pdf", async (req, res) => {
  try {
    const rechnung = await prisma.rechnungen.findFirst({
      where: { buchung_id: Number(req.params.buchungId) },
      ...MIT_VOLLSTAENDIGEN_BUCHUNGSDATEN,
    });

    if (!rechnung) {
      return res.status(404).json({ error: "Keine Rechnung für diese Buchung gefunden" });
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(RechnungDocument, { rechnung, buchung: rechnung.Buchungen }),
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Rechnung-${rechnung.rechnungs_nummer}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Fehler beim Erstellen der Rechnungs-PDF:", err);
    res.status(500).json({ error: "PDF konnte nicht erstellt werden" });
  }
});

export default router;