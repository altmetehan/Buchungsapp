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
 * CRUD- und Workflow-Endpunkte für Buchungsanfragen (/api/anfragen),
 * die über die öffentliche Portal-Seite eingehen. Eine Anfrage ist
 * bewusst von einer echten Buchung getrennt (eigenes Modell
 * "Anfragen" + "AnfrageGaeste") - erst beim Annehmen wird daraus eine
 * "echte" Buchung samt Gast, Rechnung und Rechnungsnummer erzeugt.
 * Ablehnen setzt lediglich den Status samt Begründung, ohne weitere
 * Nebeneffekte.
 */
const router = Router();

/**
 * Gemeinsamer "include"-Block für praktisch jede Anfragen-Abfrage:
 * verknüpft den Anfragen-Gast (AnfrageGaeste) sowie Haupt- und
 * Zusatzobjekt, damit das Frontend Namen/Preise direkt zur Verfügung
 * hat, ohne selbst nachzufragen.
 */
const MIT_OBJEKTEN_UND_ANFRAGE_GAST = {
  include: { AnfrageGaeste: true, Objekte: true, ObjekteZusatz: true },
};

/**
 * Berechnet den vorgeschlagenen Gesamtpreis für eine Anfrage
 * (Hauptobjekt + optional Zusatzobjekt inkl. Kombirabatt) - dieselbe
 * Logik wie im Frontend (Anfragen.jsx: berechneVorschlagsPreis), hier
 * aber serverseitig als verlässliche Grundlage für den finalen Preis
 * beim Annehmen (PUT /:id/annehmen), falls kein manueller Preis
 * mitgeschickt wird.
 *
 * @param {object} anfrage - Anfrage-Datensatz inkl. Objekte/ObjekteZusatz (siehe MIT_OBJEKTEN_UND_ANFRAGE_GAST)
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

/**
 * GET /api/anfragen
 * Liefert alle Anfragen (offen, angenommen, abgelehnt) sortiert nach
 * Erstelldatum absteigend, inkl. Gast-, Objekt- und Zusatzobjektdaten.
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
 * Gäste- und Kontaktdaten (name, email, telnr, strasse, hnr, plz,
 * stadt, land) sowie Objekt/Zeitraum (objekt_id, anreise, abreise,
 * anreise_zeit, abreise_zeit, erwachsene, kinder, infos).
 *
 * Ein Zusatzobjekt (z.B. Bus) kann der Gast hier bewusst NICHT mehr
 * mitanfragen - das ist keine Option, die er selbst steuern darf. Ein
 * Bus lässt sich weiterhin intern über die Buchungskarte
 * (BuchungskarteModal.jsx) zu einer bereits angenommenen Buchung
 * dazufügen.
 *
 * Der Anfragen-Gast wird per E-Mail gegen bestehende AnfrageGaeste
 * gematcht (Update statt Duplikat) - fehlt die E-Mail, wird immer ein
 * neuer Datensatz angelegt, damit die Unique-Constraint auf "email"
 * nicht durch mehrere Leerstrings verletzt wird.
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
    } = req.body;

    // BUGFIX: Bei fehlender/leerer E-Mail null verwenden (verhindert Unique-Constraint-Verletzung bei Leerstrings)
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
 * Nimmt eine offene Anfrage an: prüft die Verfügbarkeit von Haupt-
 * (und ggf. Zusatz-) Objekt erneut gegen den aktuellen Buchungsstand
 * (kann sich seit dem Anfragezeitpunkt geändert haben), legt/aktualisiert
 * den Gast, erstellt daraus eine Buchung samt automatisch generierter
 * Rechnung und markiert die Anfrage als "angenommen".
 *
 * Erwartet optional im Body: preis (überschreibt den automatischen
 * Vorschlagspreis).
 *
 * Gast-Anlage, Rechnungsnummer-Vergabe, Buchung und Statuswechsel
 * laufen in EINER Transaktion, damit bei einem Fehler mittendrin
 * keine "halbe" Buchung ohne Rechnung (oder umgekehrt) übrig bleibt.
 */
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

    /**
     * Prüft, ob ein einzelnes Objekt (Haupt- oder Zusatzobjekt) im
     * Zeitraum der Anfrage noch frei ist - berücksichtigt bei
     * stundenbasierten Objekten die genaue Uhrzeit, bei Wohnungen nur
     * das Datum.
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
    if (anfrage.ObjekteZusatz && !pruefeObjekt(anfrage.ObjekteZusatz)) {
      return res.status(409).json({ error: `${anfrage.ObjekteZusatz.name} ist im gewünschten Zeitraum inzwischen belegt.` });
    }

    const vorschlagsPreis = await berechneVorschlagsPreisBackend(anfrage);
    const finalerPreis =
      preis !== undefined && preis !== null && !isNaN(Number(preis))
        ? Math.round(Number(preis) * 100) / 100
        : vorschlagsPreis;

    const buchungInfos = anfrage.infos && anfrage.infos.trim()
      ? `Nachricht vom Gast: ${anfrage.infos.trim()}`
      : null;

    // Transaktion: Erstellt/Aktualisiert Gast, generiert Rechnungsnummer und legt Buchung, Rechnung & Status atomar an
    const { neueBuchung, aktualisierteAnfrage, neueRechnung } = await prisma.$transaction(async (tx) => {
      const aGast = anfrage.AnfrageGaeste;
      let gast = null;

      // BUGFIX: Gast-Matching nur durchführen, wenn aGast.email tatsächlich vorhanden ist
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

/**
 * PUT /api/anfragen/:id/ablehnen
 * Lehnt eine offene Anfrage mit Pflicht-Begründung ab (setzt Status,
 * Ablehnungszeitpunkt und -grund) - erzeugt bewusst keine Buchung
 * oder sonstige Nebeneffekte.
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