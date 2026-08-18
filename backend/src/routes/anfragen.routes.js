// backend/src/routes/anfragen.routes.js
import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";

const router = Router();

// Eine Anfrage verknüpft jetzt den Anfragen-Gast (AnfrageGaeste)
// sowie Haupt- und Zusatzobjekt.
const MIT_OBJEKTEN_UND_ANFRAGE_GAST = {
  include: { AnfrageGaeste: true, Objekte: true, ObjekteZusatz: true },
};

// ─── DATUMS-/ÜBERSCHNEIDUNGS-HELFER ───
// Dupliziert aus frontend/src/utils/javaUtils.js, weil Backend und
// Frontend getrennte Node-Umgebungen sind. Muss inhaltlich exakt
// gleich bleiben, damit die Verfügbarkeitsprüfung beim Annehmen einer
// Anfrage konsistent zur Prüfung im Buchungs-Assistenten/
// BuchungskarteModal bleibt.

/** "DD.MM.YYYY" -> "YYYY-MM-DD" */
function germanToISO(dateStr) {
  if (!dateStr) return "";
  const [d, m, y] = dateStr.split(".");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Ob ein Objekt stundenweise (statt nächteweise) abgerechnet wird.
 * Alles außer einer Wohnung wird stundenweise abgerechnet - exakt
 * dieselbe Regel wie istStundenbasiert() im Frontend.
 */
function istStundenbasiert(objekt) {
  return !objekt?.name?.toLowerCase().includes("wohnung");
}

/** Nächteweise Überschneidung zweier Zeiträume (Enddatum exklusiv, wie beim Check-out). */
function ueberschneidenSich(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

/** Stundengenaue Überschneidung zweier Zeiträume inkl. Uhrzeit (für Bus/Forum). */
function datumZeitUeberschneidenSich(startA, zeitStartA, endA, zeitEndA, startB, zeitStartB, endB, zeitEndB) {
  const a1 = new Date(`${startA}T${zeitStartA}`);
  const a2 = new Date(`${endA}T${zeitEndA}`);
  const b1 = new Date(`${startB}T${zeitStartB}`);
  const b2 = new Date(`${endB}T${zeitEndB}`);
  return a1 < b2 && a2 > b1;
}

function berechneStundenISO(startISO, startZeit, endISO, endZeit) {
  if (!startISO || !endISO || !startZeit || !endZeit) return 0;
  const [sh, sm] = startZeit.split(":").map(Number);
  const [eh, em] = endZeit.split(":").map(Number);

  const start = new Date(startISO);
  start.setHours(sh, sm, 0, 0);
  const ende = new Date(endISO);
  ende.setHours(eh, em, 0, 0);

  const diffMs = ende - start;
  return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
}

/** Berechnet den Vorschlagspreis im Backend exakt wie im Frontend. */
async function berechneVorschlagsPreisBackend(anfrage) {
  if (!anfrage || !anfrage.anreise || !anfrage.abreise) return 0;

  const anreiseISO = germanToISO(anfrage.anreise);
  const abreiseISO = germanToISO(anfrage.abreise);
  const startD = new Date(anreiseISO);
  const endD = new Date(abreiseISO);

  let mainPreis = 0;
  const istWohnung = anfrage.Objekte?.name?.toLowerCase().includes("wohnung");

  if (istWohnung) {
    const naechte = Math.max(1, Math.round((endD - startD) / (1000 * 60 * 60 * 24)));
    mainPreis = naechte * (anfrage.Objekte?.preis || 0);
  } else {
    const stunden = berechneStundenISO(anreiseISO, anfrage.anreise_zeit || "09:00", abreiseISO, anfrage.abreise_zeit || "17:00");
    mainPreis = stunden * (anfrage.Objekte?.preis || 0);
  }

  let zusatzPreis = 0;
  if (anfrage.ObjekteZusatz) {
    const einstellungen = await prisma.einstellungen.findUnique({ where: { id: 1 } });
    const checkin = anfrage.anreise_zeit || einstellungen?.checkin_zeit || "15:00";
    const checkout = anfrage.abreise_zeit || einstellungen?.checkout_zeit || "11:00";
    const zusatzStunden = berechneStundenISO(anreiseISO, checkin, abreiseISO, checkout);
    const busStundensatz = anfrage.ObjekteZusatz.preis || 0;
    const zusatzRegulaer = zusatzStunden * busStundensatz;
    const kombirabatt = einstellungen?.kombirabatt ?? 0;
    zusatzPreis = zusatzRegulaer * (1 - kombirabatt / 100);
  }

  return Math.round((mainPreis + zusatzPreis) * 100) / 100;
}

/** Ermittelt die nächste fortlaufende Rechnungsnummer für das aktuelle Jahr. */
async function generiereNaechsteRechnungsnummer() {
  const jahr = new Date().getFullYear();

  const letzteRechnung = await prisma.rechnungen.findFirst({
    where: { rechnungs_nummer: { startsWith: `RE-${jahr}-` } },
    orderBy: { rechnungs_nummer: "desc" },
  });

  let naechsteZahl = 1;
  if (letzteRechnung?.rechnungs_nummer) {
    const teile = letzteRechnung.rechnungs_nummer.split("-");
    const letzteZahl = parseInt(teile[teile.length - 1], 10);
    if (!isNaN(letzteZahl)) {
      naechsteZahl = letzteZahl + 1;
    }
  }

  return `RE-${jahr}-${String(naechsteZahl).padStart(4, "0")}`;
}

// GET /api/anfragen - alle Anfragen inkl. AnfrageGaeste, Objekt- und Zusatzobjektdaten.
router.get("/", async (req, res) => {
  try {
    const anfragen = await prisma.anfragen.findMany({
      ...MIT_OBJEKTEN_UND_ANFRAGE_GAST,
      orderBy: { erstellt_am: "desc" },
    });
    res.json(anfragen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/anfragen - neue Anfrage von der öffentlichen Portal-Seite.
// Speichert die Kontaktdaten in "AnfrageGaeste" (sofern die E-Mail dort noch
// nicht existiert, sonst wird der vorhandene Anfragen-Gast aktualisiert).
// Die Haupt-Gästetabelle (Gaeste) bleibt so frei von Spam und unbeantworteten/
// abgelehnten Anfragen.
router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      telnr,
      strasse,
      hnr,
      plz,
      stadt,
      land,
      objekt_id,
      objekt_id_2,
      anreise,
      abreise,
      anreise_zeit,
      abreise_zeit,
      erwachsene,
      kinder,
      infos,
    } = req.body;

    const emailClean = email ? email.trim().toLowerCase() : "";

    // 1. Kontakt in AnfrageGaeste suchen oder anlegen
    let anfrageGast = await prisma.anfrageGaeste.findFirst({
      where: { email: emailClean },
    });

    if (anfrageGast) {
      anfrageGast = await prisma.anfrageGaeste.update({
        where: { id: anfrageGast.id },
        data: {
          name,
          telnr,
          strasse,
          hnr,
          plz,
          stadt,
          land: land || "Österreich",
        },
      });
    } else {
      anfrageGast = await prisma.anfrageGaeste.create({
        data: {
          name,
          email: emailClean,
          telnr,
          strasse,
          hnr,
          plz,
          stadt,
          land: land || "Österreich",
        },
      });
    }

    // 2. Anfrage mit anfrage_gast_id verknüpfen
    const neueAnfrage = await prisma.anfragen.create({
      data: {
        anfrage_gast_id: anfrageGast.id,
        objekt_id: Number(objekt_id),
        objekt_id_2: objekt_id_2 ? Number(objekt_id_2) : null,
        anreise,
        abreise,
        anreise_zeit: anreise_zeit || null,
        abreise_zeit: abreise_zeit || null,
        erwachsene: erwachsene ? Number(erwachsene) : null,
        kinder: kinder ? Number(kinder) : null,
        infos: infos || null,
        status: "offen",
      },
      ...MIT_OBJEKTEN_UND_ANFRAGE_GAST,
    });

    broadcast("anfragen:changed");
    res.status(201).json(neueAnfrage);
  } catch (err) {
    console.error("Fehler beim Erstellen der Anfrage:", err);
    res.status(400).json({ error: err.message });
  }
});
// PUT /api/anfragen/:id/annehmen
// 1. Verfügbarkeit im gewünschten Zeitraum ERNEUT prüfen.
// 2. Anfragen-Gast (AnfrageGaeste) in die finale Gaeste-Tabelle übertragen/aktualisieren.
// 3. Buchung + Rechnung automatisch anlegen (Gast-Nachricht erhält Prefix "Nachricht vom Gast: ").
// 4. Anfrage-Status auf "angenommen" setzen.
router.put("/:id/annehmen", async (req, res) => {
  try {
    const anfrageId = Number(req.params.id);
    const { preis } = req.body;

    const anfrage = await prisma.anfragen.findUnique({
      where: { id: anfrageId },
      ...MIT_OBJEKTEN_UND_ANFRAGE_GAST,
    });
    if (!anfrage) return res.status(404).json({ error: "Anfrage nicht gefunden" });
    if (anfrage.status !== "offen") {
      return res.status(400).json({ error: "Diese Anfrage wurde bereits bearbeitet" });
    }

    const anreiseISO = germanToISO(anfrage.anreise);
    const abreiseISO = germanToISO(anfrage.abreise);

    const alleBuchungen = await prisma.buchungen.findMany({
      where: { geloescht_am: null },
      include: { Objekte: true, ObjekteZusatz: true },
    });
    const belegungen = [];
    alleBuchungen.forEach((b) => {
      const start = germanToISO(b.anreise);
      const end = germanToISO(b.abreise);
      if (b.Objekte) belegungen.push({ objekt: b.Objekte, start, end, anreiseZeit: b.anreise_zeit, abreiseZeit: b.abreise_zeit });
      if (b.ObjekteZusatz) belegungen.push({ objekt: b.ObjekteZusatz, start, end, anreiseZeit: b.anreise_zeit, abreiseZeit: b.abreise_zeit });
    });

    const pruefeObjekt = (objekt) => {
      if (!objekt) return true;
      const stunden = istStundenbasiert(objekt);
      return !belegungen.some((bel) => {
        if (bel.objekt.name.toLowerCase() !== objekt.name.toLowerCase()) return false;
        if (stunden) {
          return datumZeitUeberschneidenSich(
            anreiseISO, anfrage.anreise_zeit || "00:00", abreiseISO, anfrage.abreise_zeit || "23:59",
            bel.start, bel.anreiseZeit || "00:00", bel.end, bel.abreiseZeit || "23:59",
          );
        }
        return ueberschneidenSich(anreiseISO, abreiseISO, bel.start, bel.end);
      });
    };

    if (!pruefeObjekt(anfrage.Objekte)) {
      return res.status(409).json({ error: `${anfrage.Objekte?.name} ist im gewünschten Zeitraum inzwischen belegt.` });
    }
    if (anfrage.ObjekteZusatz && !pruefeObjekt(anfrage.ObjekteZusatz)) {
      return res.status(409).json({ error: `${anfrage.ObjekteZusatz.name} ist im gewünschten Zeitraum inzwischen belegt.` });
    }

    // Erst bei ZUSAGE wird der Anfragen-Gast in die offizielle Haupt-Gästetabelle (Gaeste) übertragen.
    const aGast = anfrage.AnfrageGaeste;
    let gast = await prisma.gaeste.findFirst({
      where: { email: aGast.email, geloescht_am: null },
    });

    if (gast) {
      gast = await prisma.gaeste.update({
        where: { id: gast.id },
        data: {
          name: aGast.name,
          telnr: aGast.telnr,
          strasse: aGast.strasse,
          hnr: aGast.hnr,
          plz: aGast.plz,
          stadt: aGast.stadt,
          land: aGast.land,
        },
      });
    } else {
      gast = await prisma.gaeste.create({
        data: {
          name: aGast.name,
          email: aGast.email,
          telnr: aGast.telnr,
          strasse: aGast.strasse,
          hnr: aGast.hnr,
          plz: aGast.plz,
          stadt: aGast.stadt,
          land: aGast.land,
        },
      });
    }

    const vorschlagsPreis = await berechneVorschlagsPreisBackend(anfrage);

    const finalerPreis =
      preis !== undefined && preis !== null && !isNaN(Number(preis))
        ? Math.round(Number(preis) * 100) / 100
        : vorschlagsPreis;

    const rechnungsNummer = await generiereNaechsteRechnungsnummer();

    // Nachricht vom Gast wird mit klarem Präfix für die Buchung formatiert
    const buchungInfos = anfrage.infos && anfrage.infos.trim()
      ? `Nachricht vom Gast: ${anfrage.infos.trim()}`
      : null;

    // Buchung, Rechnung und Anfrage-Update laufen in einer Transaktion.
    const { neueBuchung, aktualisierteAnfrage, neueRechnung } = await prisma.$transaction(async (tx) => {
      const buchung = await tx.buchungen.create({
        data: {
          gast_id: gast.id,
          objekt_id: anfrage.objekt_id,
          objekt_id_2: anfrage.objekt_id_2,
          anreise: anfrage.anreise,
          abreise: anfrage.abreise,
          anreise_zeit: anfrage.anreise_zeit,
          abreise_zeit: anfrage.abreise_zeit,
          preis: finalerPreis,
          erwachsene: anfrage.erwachsene,
          kinder: anfrage.kinder,
          infos: buchungInfos,
        },
        include: { Gaeste: true, Objekte: true, ObjekteZusatz: true },
      });

      const rechnung = await tx.rechnungen.create({
        data: {
          buchung_id: buchung.id,
          rechnungs_datum: anfrage.abreise,
          rechnungs_nummer: rechnungsNummer,
        },
      });

      const anfrageUpdated = await tx.anfragen.update({
        where: { id: anfrageId },
        data: { status: "angenommen", angenommen_am: new Date() },
        ...MIT_OBJEKTEN_UND_ANFRAGE_GAST,
      });

      return { neueBuchung: buchung, aktualisierteAnfrage: anfrageUpdated, neueRechnung: rechnung };
    });

    broadcast("anfragen:changed");
    broadcast("buchungen:changed");
    broadcast("rechnungen:changed");
    broadcast("gaeste:changed");

    res.json({ anfrage: aktualisierteAnfrage, buchung: neueBuchung, rechnung: neueRechnung });
  } catch (err) {
    console.error("Fehler beim Annehmen der Anfrage:", err);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/anfragen/:id/ablehnen - Grund ist Pflicht, wird dauerhaft mitgespeichert.
router.put("/:id/ablehnen", async (req, res) => {
  try {
    const { grund } = req.body;
    if (!grund || !grund.trim()) {
      return res.status(400).json({ error: "Ein Ablehnungsgrund ist erforderlich" });
    }

    const anfrageId = Number(req.params.id);
    const anfrage = await prisma.anfragen.findUnique({ where: { id: anfrageId } });
    if (!anfrage) return res.status(404).json({ error: "Anfrage nicht gefunden" });
    if (anfrage.status !== "offen") {
      return res.status(400).json({ error: "Diese Anfrage wurde bereits bearbeitet" });
    }

    const aktualisiert = await prisma.anfragen.update({
      where: { id: anfrageId },
      data: { status: "abgelehnt", abgelehnt_am: new Date(), ablehnungsgrund: grund.trim() },
      ...MIT_OBJEKTEN_UND_ANFRAGE_GAST,
    });
    broadcast("anfragen:changed");
    res.json(aktualisiert);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;