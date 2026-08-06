import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardKategorieSektion } from "../components/dashboard/DashboardKategorieSektion";
import { MiniKalenderModal } from "../components/dashboard/MiniKalenderModal";
import {
  formatDe,
  parseISO,
  germanToISO,
  toISO,
  getResourceClass,
  parseGermanDate,
  getNowIsoWithTime,
  istWohnung,
  istBus,
} from "../utils/javaUtils";
import { BuchungskarteModal } from "../components/BuchungskarteModal";
import { useEinstellungen } from "../hooks/useEinstellungen";
import { Toast } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";

import "../styles/shared-ui.css";
import "../styles/fullcalendar-theme.css";
import "../styles/pageStyles/Dashboard.css";
import { useWebSocket } from "../hooks/useWebSocket";

const OBJEKTE_API = "/api/objekte";
const BUCHUNGEN_API = "/api/buchungen";
const ANFRAGEN_API = "/api/anfragen";
const RECHNUNGEN_API = "/api/rechnungen";

/**
 * Dashboard
 * ---------
 * Startseite der App: Kennzahlen-Leiste oben, darunter je eine Sektion
 * für "Wohnungen" und "Andere Objekte" (alles außer Wohnungen - aktuell
 * der Bus und das Forum, aber bewusst offen benannt, falls später noch
 * weitere Objekte dazukommen) mit Live-Status und den nächsten
 * anstehenden Ankünften.
 *
 * @returns {JSX.Element}
 */
export function Dashboard() {
  const { einstellungen } = useEinstellungen();
  const navigate = useNavigate();
  const { toast, showToast, dismissToast } = useToast();

  const today = new Date();
  const todayStr = toISO(today);

  const [reservations, setReservations] = useState([]);
  const [allObjects, setAllObjects] = useState([]);
  const [offeneAnfragenCount, setOffeneAnfragenCount] = useState(0);

  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const [selectedObjForCalendar, setSelectedObjForCalendar] = useState(null);
  const [selectedResForDetails, setSelectedResForDetails] = useState(null);

  /** Formatiert die Gästeanzahl kompakt, z.B. "2 Erw. · 1 Kind." - gibt null zurück, wenn keine Daten vorhanden sind (ältere Buchungen). */
  const formatGaesteInfo = (erwachsene, kinder) => {
    if (erwachsene === null || erwachsene === undefined) return null;
    const kinderTeil = kinder ? ` · ${kinder} Kind${kinder > 1 ? "er" : ""}` : "";
    return `${erwachsene} Erwachsene${kinderTeil}`;
  };

  const ladeDashboardDaten = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setApiLoading(true);
      const [objekteRes, buchungenRes, anfragenRes] = await Promise.all([
        fetch(OBJEKTE_API),
        fetch(BUCHUNGEN_API),
        fetch(ANFRAGEN_API).catch(() => null),
      ]);

      if (!objekteRes.ok || !buchungenRes.ok) {
        throw new Error("Server antwortete mit einem Fehlerstatus");
      }

      setAllObjects(await objekteRes.json());

      if (anfragenRes && anfragenRes.ok) {
        const anfragenData = await anfragenRes.json();
        const count = anfragenData.filter((a) => a.status === "offen").length;
        setOffeneAnfragenCount(count);
      }

      const buchungenData = await buchungenRes.json();
      const rows = buchungenData.map((b) => {
        const gast = b.Gaeste;
        const objekt = b.Objekte;

        const obj = {
          id: b.id,
          guestName: gast?.name,
          name: gast?.name,
          email: gast?.email,
          phone: gast?.telnr,
          strasse: gast?.strasse,
          hnr: gast?.hnr,
          plz: gast?.plz,
          stadt: gast?.stadt,
          land: gast?.land,
          resource: objekt?.name,
          objectinfo: objekt?.beschreibung,
          preisProNacht: objekt?.preis,
          checkIn: b.anreise,
          checkOut: b.abreise,
          infos: b.infos,
          objektId: b.objekt_id,
          objektId2: b.objekt_id_2,
          zusatzobjektName: b.ObjekteZusatz?.name || null,
          anreiseZeit: b.anreise_zeit,
          abreiseZeit: b.abreise_zeit,
          rawBooking: b,
          preisanpassungen: b.Preisanpassungen || [],
          erwachsene: b.erwachsene ?? null,
          kinder: b.kinder ?? null,        
        };

        obj.start = germanToISO(obj.checkIn);
        obj.end = germanToISO(obj.checkOut);

        const anreiseDate = parseGermanDate(obj.checkIn);
        const abreiseDate = parseGermanDate(obj.checkOut);

        const heute = new Date();
        heute.setHours(0, 0, 0, 0);

        if (heute < anreiseDate) {
          obj.status = "bevorstehend";
        } else if (heute >= anreiseDate && heute <= abreiseDate) {
          obj.status = "aktuell";
        } else {
          obj.status = "vergangen";
        }

        // Primär den in der DB gespeicherten Preis (b.preis) verwenden,
        // nur falls keiner gespeichert ist selbst nachrechnen.
        if (b.preis !== null && b.preis !== undefined) {
          obj.preis = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(b.preis);
        } else if (obj.checkIn && obj.checkOut && objekt?.preis) {
          const reineNaechte = Math.round(Math.abs(abreiseDate - anreiseDate) / (1000 * 60 * 60 * 24));
          const dauer = istBus(obj.resource) ? reineNaechte + 1 : Math.max(1, reineNaechte);
          obj.preis = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
            dauer * objekt.preis,
          );
        } else {
          obj.preis = "€ 0,00";
        }

        return obj;
      });

      setReservations(rows);
      setApiError(null);
    } catch (err) {
      console.error("Dashboard: Fehler beim Laden vom Backend:", err);
      setApiError(
        "Backend nicht erreichbar. Läuft der Server (node src/server.js im backend-Ordner)?",
      );
    } finally {
      setApiLoading(false);
    }
  }, [einstellungen]);

  useEffect(() => {
    ladeDashboardDaten(true); // Erstes Laden mit Anzeige
  }, [ladeDashboardDaten]);

  // ladeDashboardDaten() lädt Objekte, Buchungen und Anfragen in einem
  // Rutsch - deshalb hier drei einzelne Abos statt nur eines, jedes mit
  // demselben Callback: egal welche der drei Ressourcen sich ändert
  // (neue Buchung über den Assistenten, ein Objekt wird umbenannt, eine
  // Anfrage kommt rein), lädt das Dashboard neu. Jede Backend-Route
  // bleibt so dafür zuständig, nur ihr eigenes Event zu melden, statt
  // dass z.B. die Objekte-Seite wissen müsste, dass sie fürs Dashboard
  // mitbroadcasten muss.
  useWebSocket("buchungen:changed", () => ladeDashboardDaten(false));
  useWebSocket("objekte:changed", () => ladeDashboardDaten(false));
  useWebSocket("anfragen:changed", () => ladeDashboardDaten(false));

  // Objekte werden in genau zwei Kategorien aufgeteilt: Wohnungen und
  // "Andere Objekte" (alles, was keine Wohnung ist - Bus, Forum, ...).
  const wohnungen = useMemo(
    () => allObjects.filter((obj) => istWohnung(obj.name)),
    [allObjects],
  );
  const andereObjekte = useMemo(
    () => allObjects.filter((obj) => !istWohnung(obj.name)),
    [allObjects],
  );

  /** Baut aus einem ISO-Datum ("YYYY-MM-DD") + einer Uhrzeit ("HH:MM") ein echtes Date-Objekt. */
  const getZeitDatum = (isoDatum, zeitStr) => {
    if (!isoDatum) return null;
    const [y, m, d] = isoDatum.split("-").map(Number);
    const [h, min] = (zeitStr || "00:00").split(":").map(Number);
    return new Date(y, m - 1, d, h, min, 0, 0);
  };

  // Wohnungen ohne eigene Zeitangabe nutzen die üblichen Check-in/-out-Zeiten (15:00 / 11:00).
  const getAnreiseDatumZeit = (b) => getZeitDatum(b.start, b.anreiseZeit || einstellungen.checkin_zeit);
  const getAbreiseDatumZeit = (b) => getZeitDatum(b.end, b.abreiseZeit || einstellungen.checkout_zeit);

  /**
   * Ermittelt den Live-Status eines Objekts (frei/belegt) für "heute",
   * inklusive der nächsten bekannten Änderung. Berücksichtigt auch
   * Buchungen, bei denen das Objekt nur als Zusatzobjekt (z.B. Bus zu
   * einer Wohnung) mitgebucht wurde.
   *
   * @param {string} resourceName
   * @returns {{status: string, guest: string, subDate: string}}
   */
  const getLiveStatus = (resourceName) => {
    const nameLower = resourceName.toLowerCase();
    const nowStr = getNowIsoWithTime();

    const activeBooking = reservations.find((b) => {
      const matchesResource =
        b.resource?.toLowerCase() === nameLower ||
        b.zusatzobjektName?.toLowerCase() === nameLower;

      if (!matchesResource) return false;

      // Start- und Endzeitpunkt inkl. Uhrzeit aufbauen
      const startZeit = b.anreiseZeit || "00:00";
      const endZeit = b.abreiseZeit || "23:59";

      const startFull = `${b.start}T${startZeit}`;
      const endFull = `${b.end}T${endZeit}`;

      // Aktuell belegt nur, wenn die Anreisezeit jetzt schon erreicht ist.
      return nowStr >= startFull && nowStr <= endFull;
    });

    if (activeBooking) {
      // Wenn diese Buchung ein Zusatzobjekt hat (z.B. Wohnung + Bus),
      // und resourceName selbst nicht schon das Zusatzobjekt ist (dann
      // wäre die Info redundant), zeigen wir das im Status mit an.
      const zusatzInfo =
        activeBooking.zusatzobjektName && activeBooking.zusatzobjektName.toLowerCase() !== nameLower
          ? activeBooking.zusatzobjektName
          : null;

      return {
        status: "belegt",
        guest: activeBooking.guestName,
        zusatz: zusatzInfo,
        subDate: `bis ${formatDe(parseISO(activeBooking.end))}${
          activeBooking.abreiseZeit ? ` (${activeBooking.abreiseZeit} Uhr)` : ""
        }`,
      };
    }

    // Nächste zukünftige Buchung ermitteln
    const futureBookings = reservations
      .filter((b) => {
        const matchesResource =
          b.resource?.toLowerCase() === nameLower ||
          b.zusatzobjektName?.toLowerCase() === nameLower;
        if (!matchesResource) return false;

        const startZeit = b.anreiseZeit || "00:00";
        const startFull = `${b.start}T${startZeit}`;
        return startFull > nowStr;
      })
      .sort((a, b) => {
        const aFull = `${a.start}T${a.anreiseZeit || "00:00"}`;
        const bFull = `${b.start}T${b.anreiseZeit || "00:00"}`;
        return aFull.localeCompare(bFull);
      });

    if (futureBookings.length > 0) {
      const nextB = futureBookings[0];
      const zeitsuffix = nextB.anreiseZeit ? ` (${nextB.anreiseZeit} Uhr)` : "";
      return {
        status: "frei",
        guest: "-",
        zusatz: null,
        subDate: `bis ${formatDe(parseISO(nextB.start))}${zeitsuffix}`,
      };
    }

    return { status: "frei", guest: "-", zusatz: null, subDate: "durchgehend frei" };
  };

  // Wohnungen - Ankünfte (nur Buchungen, deren Anreisezeit noch in der Zukunft liegt)
  const apartmentArrivals = useMemo(() => {
    const nowStr = getNowIsoWithTime();

    return reservations
      .filter((b) => {
        if (!istWohnung(b.resource)) return false;

        const startZeit = b.anreiseZeit || "00:00";
        const startFull = `${b.start}T${startZeit}`;
        return startFull > nowStr; // Zeige nur Ankünfte, die noch nicht angekommen sind
      })
      .sort((a, b) => {
        const aFull = `${a.start}T${a.anreiseZeit || "00:00"}`;
        const bFull = `${b.start}T${b.anreiseZeit || "00:00"}`;
        return aFull.localeCompare(bFull);
      })
      .slice(0, 3)
      .map((b) => ({
        id: b.id,
        guestName: b.guestName,
        resource: `${b.resource}${b.zusatzobjektName ? " + " + b.zusatzobjektName : ""} - #${b.id}`,
        start: b.start,
        arrivalDate: formatDe(parseISO(b.start)).slice(0, 5) + ".",
        arrivalTime: b.anreiseZeit,
        gaesteInfo: formatGaesteInfo(b.erwachsene, b.kinder),
      }));
  }, [reservations]);

  // Andere Objekte - Ankünfte (Fahrzeuge / Räume mit Uhrzeit)
  const andereObjekteArrivals = useMemo(() => {
    const nowStr = getNowIsoWithTime();

    return reservations
      .filter((b) => {
        const isAndere = !istWohnung(b.resource) || b.zusatzobjektName;
        if (!isAndere) return false;

        const startZeit = b.anreiseZeit || "00:00";
        const startFull = `${b.start}T${startZeit}`;
        return startFull > nowStr;
      })
      .sort((a, b) => {
        const aFull = `${a.start}T${a.anreiseZeit || "00:00"}`;
        const bFull = `${b.start}T${b.anreiseZeit || "00:00"}`;
        return aFull.localeCompare(bFull);
      })
      .slice(0, 5)
      .map((b) => {
        const resText = b.zusatzobjektName
          ? `${b.resource} + ${b.zusatzobjektName}`
          : b.resource;

        return {
          id: b.id,
          guestName: b.guestName,
          resource: `${resText} - #${b.id}`,
          start: b.start,
          arrivalDate: `${formatDe(parseISO(b.start)).slice(0, 5)}.`,
          arrivalTime: b.anreiseZeit,
          gaesteInfo: formatGaesteInfo(b.erwachsene, b.kinder),
        };
      });
  }, [reservations]);


  const stats = useMemo(() => {
    const totalApts = wohnungen.length;
    const totalAndere = andereObjekte.length;

    const occupiedApts = wohnungen.filter((apt) => getLiveStatus(apt.name).status === "belegt").length;
    const occupiedAndere = andereObjekte.filter((obj) => getLiveStatus(obj.name).status === "belegt").length;

    return {
      totalObjects: totalApts + totalAndere,
      totalApts,
      totalAndere,
      occupiedApts,
      occupiedAndere,
    };
  }, [reservations, wohnungen, andereObjekte]);

  /** Baut die FullCalendar-Events für das Mini-Kalender-Popup eines einzelnen Objekts. */
  const getFilteredEventsForCalendar = () => {
    if (!selectedObjForCalendar) return [];

    const nameLower = selectedObjForCalendar.name.toLowerCase();
    const objectBookings = reservations.filter(
      (b) => b.resource?.toLowerCase() === nameLower || b.zusatzobjektName?.toLowerCase() === nameLower,
    );

    return objectBookings.map((b) => {
      let formattedEndDate = b.end;
      if (b.end) {
        const realEndDate = new Date(b.end);
        if (!isNaN(realEndDate.getTime())) {
          realEndDate.setDate(realEndDate.getDate() + 1);
          formattedEndDate = realEndDate.toISOString().split("T")[0];
        }
      }

      return {
        id: b.id.toString(),
        title: b.guestName,
        start: b.start,
        end: formattedEndDate,
        allDay: true,
        classNames: [getResourceClass(selectedObjForCalendar.name)],
      };
    });
  };

  /**
   * Öffnet die PDF-Rechnung der aktuell aktiven Buchung eines Objekts.
   * Der PDF-Button in der Status-Liste ist nur klickbar, wenn das
   * Objekt gerade "belegt" ist (siehe disabled-Logik in
   * DashboardKategorieSektion/ActionButton) - hier wird dieselbe
   * "welche Buchung ist jetzt aktiv"-Prüfung wie in getLiveStatus()
   * nochmal gemacht, weil getLiveStatus() selbst nur den Anzeige-Status
   * zurückgibt, keine Buchungs-ID.
   */
  const handlePdfClick = (obj) => {
    const nameLower = obj.name.toLowerCase();
    const nowStr = getNowIsoWithTime();

    const activeBooking = reservations.find((b) => {
      const matchesResource =
        b.resource?.toLowerCase() === nameLower || b.zusatzobjektName?.toLowerCase() === nameLower;
      if (!matchesResource) return false;

      const startFull = `${b.start}T${b.anreiseZeit || "00:00"}`;
      const endFull = `${b.end}T${b.abreiseZeit || "23:59"}`;
      return nowStr >= startFull && nowStr <= endFull;
    });

    if (activeBooking) {
      window.open(`${RECHNUNGEN_API}/buchung/${activeBooking.id}/pdf`, "_blank");
    }
  };

  const handleCalendarEventClick = (bookingId) => {
    const booking = reservations.find((b) => b.id.toString() === bookingId.toString());
    if (booking) {
      setSelectedResForDetails(booking);
    }
  };

  /** Öffnet dieselbe Buchungskarte wie überall sonst über die Buchungs-ID (die Ankünfte-Liste selbst trägt nur reduzierte Anzeige-Felder). */
  const handleArrivalDetailsClick = (bookingId) => {
    const booking = reservations.find((b) => b.id === bookingId);
    if (booking) setSelectedResForDetails(booking);
  };

  if (apiLoading) return <div style={{ padding: "24px" }}>Lade Dashboard-Daten vom Server...</div>;
  if (apiError) return <div style={{ padding: "24px", color: "#e30000" }}>{apiError}</div>;

  return (
    <div className="dashboard-container">
      <Toast toast={toast} onClose={dismissToast} />
      
      <div className="page-header">
        <div className="header-text">
          <h2>Dashboard</h2>
          <p className="subtitle">Übersicht über alle Wohnungen, andere Objekte und aktuelle Vorgänge</p>
        </div>

        <div className="dashboard-header-actions">
          <button
            type="button"
            onClick={() => navigate("/anfragen")}
            className={`btn-anfragen-status ${offeneAnfragenCount > 0 ? "btn-anfragen-status--active" : ""}`}
          >
            {offeneAnfragenCount > 0 ? (
              <>
                <span className="status-dot-danger" />
                Sie haben offene Anfragen! ({offeneAnfragenCount})
              </>
            ) : (
              "Keine offenen Anfragen - alles erledigt"
            )}
          </button>
          <button className="btn-primary" onClick={() => navigate("/buchen")}>
            + Neue Buchung erfassen
          </button>
        </div>
      </div>

      <div className="stats-container">
        <div className="stats-item stats-item--divider">
          <span className="stats-label">Objekte gesamt</span>
          <span className="stats-value stats-value--danger">{stats.totalObjects}</span>
        </div>
        <div className="stats-item">
          <span className="stats-label">Wohnungen gesamt</span>
          <span className="stats-value">{stats.totalApts}</span>
        </div>
        <div className="stats-item stats-item--divider">
          <span className="stats-label">Wohnungen - aktuell belegt</span>
          <span className="stats-value stats-value--danger-soft">{stats.occupiedApts}</span>
        </div>
        <div className="stats-item">
          <span className="stats-label">Andere Objekte gesamt</span>
          <span className="stats-value">{stats.totalAndere}</span>
        </div>
        <div className="stats-item">
          <span className="stats-label">Andere Objekte - aktuell belegt</span>
          <span className="stats-value stats-value--danger-soft">{stats.occupiedAndere}</span>
        </div>
      </div>

      <DashboardKategorieSektion
        kategorieName="Wohnungen"
        objekte={wohnungen}
        getLiveStatus={getLiveStatus}
        ankuenfte={apartmentArrivals}
        onDetailsClick={setSelectedObjForCalendar}
        onArrivalDetailsClick={handleArrivalDetailsClick}
        onPdfClick={handlePdfClick}
        onNavigateBuchen={() => navigate("/buchen")}
        onNavigateAlle={() => navigate("/reservierungen")}
      />

      <DashboardKategorieSektion
        kategorieName="Andere Objekte"
        objekte={andereObjekte}
        getLiveStatus={getLiveStatus}
        ankuenfte={andereObjekteArrivals}
        onDetailsClick={setSelectedObjForCalendar}
        onArrivalDetailsClick={handleArrivalDetailsClick}
        onPdfClick={handlePdfClick}
        onNavigateBuchen={() => navigate("/buchen")}
        onNavigateAlle={() => navigate("/reservierungen")}
      />

      <MiniKalenderModal
        objekt={selectedObjForCalendar}
        events={getFilteredEventsForCalendar()}
        onClose={() => setSelectedObjForCalendar(null)}
        onEventClick={handleCalendarEventClick}
      />

      <BuchungskarteModal
        reservation={selectedResForDetails}
        onClose={() => setSelectedResForDetails(null)}
        onDeleted={(id, msg) => {
          ladeDashboardDaten(false);
          if (msg) showToast("success", msg);
        }}
        onUpdated={(updated, msg) => {
          ladeDashboardDaten(false);
          if (msg) showToast("success", msg);
        }}
      />
    </div>
  );
}