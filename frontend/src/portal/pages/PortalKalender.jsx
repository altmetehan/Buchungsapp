import { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import deLocale from "@fullcalendar/core/locales/de";
import "../../styles/shared-ui.css";
import "../../styles/fullcalendar-theme.css";
import { istStundenbasiert, toISO, getResourceColor } from "../../utils/javaUtils";

/**
 * @file PortalKalender.jsx
 * @description Öffentlicher Belegungsplan für Interessenten und externe Webseitenbesucher.
 *              Zeigt Belegungszeiträume aller Mietobjekte in einem Monatskalender (FullCalendar) an.
 *              Aus Datenschutzgründen werden serverseitig ausschließlich anonymisierte Daten
 *              (Objektname und Zeitraum) ohne jegliche Gast- oder Preisinformationen übertragen.
 *              Ermöglicht interaktives Filtern der Ansicht durch Klick auf die Legenden-Objekte.
 * @module portal/pages/PortalKalender
 */

/** Endpunkt für öffentliche, anonymisierte Buchungsdaten */
const OEFFENTLICHE_BUCHUNGEN_API = "/api/buchungen/oeffentlich";

/** Endpunkt für Objektstammdaten (Wohnungen, Busse etc.) */
const OBJEKTE_API = "/api/objekte";

/**
 * PortalKalender-Seitenkomponente.
 *
 * @component
 * @returns {JSX.Element} Der gerenderte öffentliche Belegungsplan mit filterbarer Legende.
 */
export function PortalKalender() {
  /** @type {[Array<Object>, Function]} Liste aller normalisierten Kalender-Events */
  const [events, setEvents] = useState([]);

  /** @type {[Array<Object>, Function]} Liste aller verfügbaren Mietobjekte */
  const [allObjects, setAllObjects] = useState([]);

  /** @type {[string|null, Function]} Aktiver Objekt-Filtername (null = alle sichtbar) */
  const [gefiltertesObjekt, setGefiltertesObjekt] = useState(null);

  /** @type {[boolean, Function]} Ladezustand während der API-Abfrage */
  const [apiLoading, setApiLoading] = useState(true);

  /** @type {[string|null, Function]} Fehlermeldung bei API-Problemen */
  const [apiError, setApiError] = useState(null);

  /**
   * Lädt die öffentlichen Belegungs- und Objektdaten vom Backend und baut Kalenderevents auf.
   */
  useEffect(() => {
    async function ladeDaten() {
      try {
        setApiLoading(true);
        const [buchungenRes, objekteRes] = await Promise.all([
          fetch(OEFFENTLICHE_BUCHUNGEN_API),
          fetch(OBJEKTE_API),
        ]);
        if (!buchungenRes.ok || !objekteRes.ok) {
          throw new Error(`Server antwortete mit einem Fehlerstatus`);
        }

        const buchungen = await buchungenRes.json();
        setAllObjects(await objekteRes.json());

        const rows = [];
        buchungen.forEach((b) => {
          // Für jedes belegte Objekt (Haupt- und optionales Zusatzobjekt) ein Event erstellen
          [b.Objekte, b.ObjekteZusatz].forEach((objekt, idx) => {
            if (!objekt) return;

            const startParts = b.anreise.split(".");
            const isoStart = `${startParts[2]}-${startParts[1]}-${startParts[0]}`;
            const endParts = b.abreise.split(".");
            const isoEnd = `${endParts[2]}-${endParts[1]}-${endParts[0]}`;

            const realEndDate = new Date(isoEnd);
            realEndDate.setDate(realEndDate.getDate() + 1);
            const formattedEndDate = realEndDate.toISOString().split("T")[0];

            const stundenbasiertUndEinTag = (objektname) =>
              istStundenbasiert(objektname) && b.anreise === b.abreise;

            const farbe = getResourceColor(objekt.name);

            rows.push({
              id: `${b.id}-${idx}`,
              resource: objekt.name,
              title: stundenbasiertUndEinTag(objekt.name)
                ? `${objekt.name} -  ${b.anreise_zeit} bis ${b.abreise_zeit}`
                : istStundenbasiert(objekt.name)
                  ? `${objekt.name} · ab ${b.anreise_zeit} / bis ${b.abreise_zeit}`
                  : `${objekt.name} · Belegt`,
              start: isoStart,
              end: formattedEndDate,
              allDay: true,
              backgroundColor: farbe.bg,
              borderColor: farbe.border,
              textColor: "#ffffff",
            });
          });
        });

        setEvents(rows);
        setApiError(null);
      } catch (err) {
        console.error("PortalKalender: Fehler beim Laden vom Backend:", err);
        setApiError("Der Belegungsplan ist gerade nicht erreichbar. Bitte später erneut versuchen.");
      } finally {
        setApiLoading(false);
      }
    }
    ladeDaten();
  }, []);

  /**
   * Setzt den Objektfilter bei Klick auf ein Legenden-Element oder hebt ihn auf.
   *
   * @function
   * @param {string} objektName - Name des angeklickten Objekts.
   * @returns {void}
   */
  const handleLegendClick = (objektName) => {
    setGefiltertesObjekt((aktuell) => (aktuell === objektName ? null : objektName));
  };

  /**
   * Filtert die Kalender-Events basierend auf dem aktuell aktiven Legenden-Filter.
   */
  const sichtbareEvents = gefiltertesObjekt
    ? events.filter((e) => e.resource === gefiltertesObjekt)
    : events;

  if (apiLoading) return <p style={{ padding: "24px" }}>Lade Belegungsplan...</p>;
  if (apiError) return <p style={{ padding: "24px", color: "#e30000" }}>{apiError}</p>;

  return (
    <div style={{ width: "100%" }}>
      <h2>Belegungsplan</h2>
      <p className="subtitle" style={{ marginBottom: "24px" }}>
        Übersicht, wann welches Objekt bereits gebucht ist.
      </p>

      <div className="card-box" style={{ padding: "24px", backgroundColor: "#ffffff" }}>
        {/* Legende mit barrierefreien, filterbaren Buttons */}
        <div className="calendar-legend">
          {allObjects.map((obj) => {
            const farbe = getResourceColor(obj.name);
            const istAktiv = gefiltertesObjekt === obj.name;
            return (
              <button
                type="button"
                className="legend-item"
                key={obj.id}
                onClick={() => handleLegendClick(obj.name)}
                style={{
                  cursor: "pointer",
                  border: istAktiv ? "1px solid #e30000" : "1px solid transparent",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  background: istAktiv ? "#ff000010" : "transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  className="resource-dot"
                  style={{ "--res-bg": farbe.bg, "--res-border": farbe.border }}
                />
                {obj.name}
              </button>
            );
          })}

          {/* Button zum Zurücksetzen des aktiven Filters */}
          {gefiltertesObjekt && (
            <button
              type="button"
              className="legend-item"
              onClick={() => setGefiltertesObjekt(null)}
              style={{
                cursor: "pointer",
                color: "#71717a",
                fontWeight: 600,
                background: "none",
                border: "none",
              }}
            >
              × Filter aufheben
            </button>
          )}
        </div>

        {/* FullCalendar Monatsgitter */}
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          initialDate={toISO(new Date())}
          locales={[deLocale]}
          locale="de"
          events={sichtbareEvents}
          headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
          height="680px"
          dayMaxEvents={false}
        />
      </div>
    </div>
  );
}

export default PortalKalender;