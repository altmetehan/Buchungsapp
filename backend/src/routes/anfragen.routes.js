// backend/src/routes/anfragen.routes.js
import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { broadcast } from "../ws.js";
import {
  germanToISO,
  istStundenbasiert,
  ueberschneidenSich,
  datumZeitUeberschneidenSich,
  berechneStundenISO,
} from "../utils/dateUtils.js";
import { generiereNaechsteRechnungsnummer } from "../utils/invoiceUtils.js";

/**
 * anfragen.routes.js
 * -------------------
 * CRUD- und Workflow-Endpunkte für Buchungsanfragen (/api/anfragen).
 * Eine Anfrage ist bewusst von einer echten Buchung getrennt - erst
 * beim Annehmen wird daraus eine "echte" Buchung samt Gast, Rechnung
 * und Rechnungsnummer erzeugt. Ablehnen setzt lediglich den Status
 * samt Begründung, ohne weitere Nebeneffekte.
 *
 */
const router = Router();

const MIT_OBJEKTEN_UND_ANFRAGE_GAST = {
  include: { AnfrageGaeste: true, Objekte: true },
};

/**
 * Berechnet den vorgeschlagenen Gesamtpreis für eine Anfrage
 * (nur noch Hauptobjekt - kein Kombirabatt mehr, da Zusatzobjekte
 * intern über die Buchungskarte laufen).
 *
 * @param {object} anfrage - Anfrage-Datensatz inkl. Objekte (siehe MIT_OBJEKTEN_UND_ANFRAGE_GAST)
 * @returns {Promise<number>} vorgeschlagener Gesamtpreis, gerundet auf 2 Nachkommastellen
 */
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
    const stunden = berechneStundenISO(
      anreiseISO,
      anfrage.anreise_zeit || "09:00",
      abreiseISO,
      anfrage.abreise_zeit || "17:00"
    );
    mainPreis = stunden * (anfrage.Objekte?.preis || 0);
  }

  return Math.round(mainPreis * 100) / 100;
}

/**
 * GET /api/anfragen
 * Liefert alle Anfragen (offen, angenommen, abgelehnt) sortiert nach
 * Erstelldatum absteigend, inkl. Gast- und Objektdaten.
 */
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

/**
 * POST /api/anfragen
 * Legt eine neue Anfrage vom öffentlichen Portal an. Erwartet im Body
 * Gäste- und Kontaktdaten sowie Objekt/Zeitraum. Ein Zusatzobjekt kann
 * der Gast hier bewusst NICHT mitanfragen.
 */
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
      anreise,
      abreise,
      anreise_zeit,
      abreise_zeit,
      erwachsene,
      kinder,
      infos,
      pkw, // <-- NEU: PKW aus Body entgegennehmen
    } = req.body;

    const emailClean = email && email.trim() !== "" ? email.trim().toLowerCase() : null;
    let anfrageGast = null;

    if (emailClean) {
      anfrageGast = await prisma.anfrageGaeste.findFirst({
        where: { email: emailClean },
      });
    }

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

    const neueAnfrage = await prisma.anfragen.create({
      data: {
        anfrage_gast_id: anfrageGast.id,
        objekt_id: Number(objekt_id),
        anreise,
        abreise,
        anreise_zeit: anreise_zeit || null,
        abreise_zeit: abreise_zeit || null,
        erwachsene: erwachsene ? Number(erwachsene) : null,
        kinder: kinder ? Number(kinder) : null,
        infos: infos || null,
        pkw: pkw || null, // <-- NEU: PKW in der Anfrage speichern
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

/**
 * PUT /api/anfragen/:id/annehmen
 * Nimmt eine offene Anfrage an: prüft die Verfügbarkeit des
 * Hauptobjekts erneut, legt/aktualisiert den Gast, erstellt daraus
 * eine Buchung samt automatisch generierter Rechnung und markiert die
 * Anfrage als "angenommen".
 */
router.put("/:id/annehmen", async (req, res) => {
  try {
    const anfrageId = Number(req.params.id);
    const { preis, pkw } = req.body; // <-- NEU: pkw aus req.body erlauben

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
      include: { Objekte: true },
    });

    const belegungen = [];
    alleBuchungen.forEach((b) => {
      const start = germanToISO(b.anreise);
      const end = germanToISO(b.abreise);
      if (b.Objekte) belegungen.push({ objekt: b.Objekte, start, end, anreiseZeit: b.anreise_zeit, abreiseZeit: b.abreise_zeit });
    });

    /**
     * Prüft, ob das Hauptobjekt im Zeitraum der Anfrage noch frei ist.
     *
     * @param {{name: string}|null} objekt
     * @returns {boolean}
     */
    const pruefeObjekt = (objekt) => {
      if (!objekt) return true;
      const stunden = istStundenbasiert(objekt);
      return !belegungen.some((bel) => {
        if (bel.objekt.name.toLowerCase() !== objekt.name.toLowerCase()) return false;
        if (stunden) {
          return datumZeitUeberschneidenSich(
            anreiseISO, anfrage.anreise_zeit || "00:00", abreiseISO, anfrage.abreise_zeit || "23:59",
            bel.start, bel.anreiseZeit || "00:00", bel.end, bel.abreiseZeit || "23:59"
          );
        }
        return ueberschneidenSich(anreiseISO, abreiseISO, bel.start, bel.end);
      });
    };

    if (!pruefeObjekt(anfrage.Objekte)) {
      return res.status(409).json({ error: `${anfrage.Objekte?.name} ist im gewünschten Zeitraum inzwischen belegt.` });
    }

    const vorschlagsPreis = await berechneVorschlagsPreisBackend(anfrage);
    const finalerPreis =
      preis !== undefined && preis !== null && !isNaN(Number(preis))
        ? Math.round(Number(preis) * 100) / 100
        : vorschlagsPreis;

    const buchungInfos = anfrage.infos && anfrage.infos.trim()
      ? `Nachricht vom Gast: ${anfrage.infos.trim()}`
      : null;

    // Entweder der beim Annehmen manuell eingegebene PKW oder der aus der Anfrage
    const finalerPkw = pkw !== undefined ? (pkw || null) : (anfrage.pkw || null);

    const { neueBuchung, aktualisierteAnfrage, neueRechnung } = await prisma.$transaction(async (tx) => {
      const aGast = anfrage.AnfrageGaeste;
      let gast = null;

      if (aGast.email) {
        gast = await tx.gaeste.findFirst({
          where: { email: aGast.email, geloescht_am: null },
        });
      }

      if (gast) {
        gast = await tx.gaeste.update({
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
        gast = await tx.gaeste.create({
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

      const rechnungsNummer = await generiereNaechsteRechnungsnummer(tx);

      const buchung = await tx.buchungen.create({
        data: {
          gast_id: gast.id,
          objekt_id: anfrage.objekt_id,
          anreise: anfrage.anreise,
          abreise: anfrage.abreise,
          anreise_zeit: anfrage.anreise_zeit,
          abreise_zeit: anfrage.abreise_zeit,
          preis: finalerPreis,
          erwachsene: anfrage.erwachsene,
          kinder: anfrage.kinder,
          infos: buchungInfos,
          pkw: finalerPkw, // <-- NEU: PKW wird in Buchungen angelegt
        },
        include: { Gaeste: true, Objekte: true },
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
        data: {
          status: "angenommen",
          angenommen_am: new Date(),
          ...(pkw !== undefined ? { pkw: finalerPkw } : {}), // Synchronisiert das Feld bei der Anfrage
        },
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

/**
 * PUT /api/anfragen/:id/ablehnen
 * Lehnt eine offene Anfrage mit Pflicht-Begründung ab.
 */
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