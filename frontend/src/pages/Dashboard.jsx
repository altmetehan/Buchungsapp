import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardKategorieSektion } from "../components/dashboard/DashboardKategorieSektion";
import { MiniKalenderModal } from "../components/dashboard/MiniKalenderModal";

import {
  formatDe,
  parseISO,
  germanToISO,
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

/**
 * @file Dashboard.jsx
 * @description Haupt-Dashboard der Administrationsumgebung. Visualisiert aggregierte Belegungsstatistiken,
 *              den sekundengenauen Live-Status aller Wohneinheiten und Fahrzeuge, die nächsten anstehenden
 *              Ankünfte, offene Anfragen-Badges sowie Schnellzugriffe auf Mini-Kalender und Buchungskarten.
 * @module pages/Dashboard
 */

const OBJEKTE_API = "/api/objekte";
const BUCHUNGEN_API = "/api/buchungen";
const ANFRAGEN_API = "/api/anfragen";
const RECHNUNGEN_API = "/api/rechnungen";

/**
 * Dashboard-Seitenkomponente.
 *
 * @component
 * @returns {JSX.Element} Die gerenderte Dashboard-Übersicht.
 */
export function Dashboard() {
  const { einstellungen } = useEinstellungen();
  const navigate = useNavigate();
  const { toast, showToast, dismissToast } = useToast();

  /** @type {[Array<Object>, Function]} Liste aller normalisierten Reservierungsdatensätze */
  const [reservations, setReservations] = useState([]);
  /** @type {[Array<Object>, Function]} Liste aller aktiven Mietobjekte */
  const [allObjects, setAllObjects] = useState([]);
  /** @type {[number, Function]} Anzahl aktuell unbeantworteter Portal-Anfragen */
  const [offeneAnfragenCount, setOffeneAnfragenCount] = useState(0);

  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  /** @type {[Object|null, Function]} Für das Mini-Kalender-Modal ausgewähltes Objekt */
  const [selectedObjForCalendar, setSelectedObjForCalendar] = useState(null);
  /** @type {[Object|null, Function]} Für die Buchungskarte ausgewählte Reservierung */
  const [selectedResForDetails, setSelectedResForDetails] = useState(null);

  /**
   * Formatiert die Gästeanzahl kompakt als lesbaren Text (z. B. "2 Erwachsene · 1 Kind").
   *
   * @function
   * @param {number|null|undefined} erwachsene - Anzahl der Erwachsenen.
   * @param {number|null|undefined} kinder - Anzahl der Kinder.
   * @returns {string|null} Formatierter String oder `null`.
   */
  const formatGaesteInfo = (erwachsene, kinder) => {
    if (erwachsene === null || erwachsene === undefined) return null;
    const kinderTeil = kinder ? ` · ${kinder} Kind${kinder > 1 ? "er" : ""}` : "";
    return `${erwachsene} Erwachsene${kinderTeil}`;
  };

  /**
   * Lädt alle Stammdaten, Buchungen und Anfragen asynchron vom Backend und normalisiert diese.
   *
   * @async
   * @function
   * @param {boolean} [isInitial=false] - Gibt an, ob der globale Ladeindikator angezeigt werden soll.
   * @returns {Promise<void>}
   */
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
          objekt_id: b.objekt_id,
          objekt_id_2: b.objekt_id_2 || null,
          hauptobjektName: b.Objekte?.name || null,
          zusatzobjektName: b.ObjekteZusatz?.name || null,
          ObjekteZusatz: b.ObjekteZusatz || null,
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
    ladeDashboardDaten(true);
  }, [ladeDashboardDaten]);

  // Live-Synchronisation über WebSockets
  useWebSocket("buchungen:changed", () => ladeDashboardDaten(false));
  useWebSocket("objekte:changed", () => ladeDashboardDaten(false));
  useWebSocket("anfragen:changed", () => ladeDashboardDaten(false));

  const wohnungen = useMemo(
    () => allObjects.filter((obj) => istWohnung(obj.name)),
    [allObjects],
  );
  const andereObjekte = useMemo(
    () => allObjects.filter((obj) => !istWohnung(obj.name)),
    [allObjects],
  );

  /**
   * Ermittelt den minutengenauen Live-Belegungsstatus eines Objekts für den aktuellen Zeitpunkt.
   *
   * @function
   * @param {string} resourceName - Name des zu prüfenden Objekts.
   * @returns {{status: string, guest: string, zusatz: string|null, kombiMit: string|null, subDate: string}} Statusobjekt.
   */
  const getLiveStatus = (resourceName) => {
    const nameLower = resourceName.toLowerCase();
    const nowStr = getNowIsoWithTime();

    const activeBooking = reservations.find((b) => {
      const matchesResource =
        b.resource?.toLowerCase() === nameLower ||
        b.zusatzobjektName?.toLowerCase() === nameLower;

      if (!matchesResource) return false;

      const startZeit = b.anreiseZeit || "00:00";
      const endZeit = b.abreiseZeit || "23:59";

      const startFull = `${b.start}T${startZeit}`;
      const endFull = `${b.end}T${endZeit}`;

      return nowStr >= startFull && nowStr <= endFull;
    });

    if (activeBooking) {
      const isHauptobjekt = activeBooking.resource?.toLowerCase() === nameLower;
      const isZusatzobjekt = activeBooking.zusatzobjektName?.toLowerCase() === nameLower;

      let zusatz = null;
      let kombiMit = null;

      if (isHauptobjekt && activeBooking.zusatzobjektName) {
        zusatz = activeBooking.zusatzobjektName;
      } else if (isZusatzobjekt && activeBooking.resource) {
        kombiMit = activeBooking.resource;
      }

      return {
        status: "belegt",
        guest: activeBooking.guestName,
        zusatz,
        kombiMit,
        subDate: `bis ${formatDe(parseISO(activeBooking.end))}${
          activeBooking.abreiseZeit ? ` (${activeBooking.abreiseZeit} Uhr)` : ""
        }`,
      };
    }

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

  /**
   * Berechnet die nächsten 3 anstehenden Ankünfte für alle Ferienwohnungen.
   */
  const apartmentArrivals = useMemo(() => {
    const nowStr = getNowIsoWithTime();

    return reservations
      .filter((b) => {
        if (!istWohnung(b.resource)) return false;
        const startZeit = b.anreiseZeit || "00:00";
        const startFull = `${b.start}T${startZeit}`;
        return startFull > nowStr;
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

  /**
   * Berechnet die nächsten 5 anstehenden Ankünfte für andere Objekte (z. B. Busse).
   */
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

  /**
   * Aggregiert Gesamtzahlen und momentane Auslastung für die Statistikleiste.
   */
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

  /**
   * Erstellt formatierte Kalenderevents für das MiniKalenderModal des gewählten Objekts.
   *
   * @function
   * @returns {Array<Object>} Event-Array für FullCalendar.
   */
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
   * Öffnet die Rechnung als PDF im neuen Tab für das aktuell belegte Objekt.
   *
   * @function
   * @param {Object} obj - Das ausgewählte Objekt.
   * @returns {void}
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

  /**
   * Öffnet die Buchungskarte beim Klick auf ein Event im MiniKalender.
   *
   * @function
   * @param {string|number} bookingId - ID der Buchung.
   * @returns {void}
   */
  const handleCalendarEventClick = (bookingId) => {
    const booking = reservations.find((b) => b.id.toString() === bookingId.toString());
    if (booking) {
      setSelectedResForDetails(booking);
    }
  };

  /**
   * Öffnet die Buchungskarte beim Klick auf einen Listeneintrag der anstehenden Ankünfte.
   *
   * @function
   * @param {number} bookingId - ID der Buchung.
   * @returns {void}
   */
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
        onDeleted={() => {
          ladeDashboardDaten(false);
          showToast("success", "Buchung wurde storniert.");
        }}
        onUpdated={(updated, msg) => {
          ladeDashboardDaten(false);
          if (msg) showToast("success", msg);
        }}
      />
    </div>
  );
}