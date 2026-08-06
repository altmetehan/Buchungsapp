import { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import deLocale from "@fullcalendar/core/locales/de";
import "../../styles/shared-ui.css";
import "../../styles/fullcalendar-theme.css";
import { istStundenbasiert, toISO, getResourceColor } from "../../utils/javaUtils";

const OEFFENTLICHE_BUCHUNGEN_API = "/api/buchungen/oeffentlich";
const OBJEKTE_API = "/api/objekte";

/**
 * PortalKalender
 * --------------
 * Öffentlicher Belegungsplan für Interessenten - baugleich zum
 * internen Kalender.jsx (gleiche Legende, gleiches FullCalendar-Setup),
 * ABER bewusst OHNE jegliche Gästedaten: weder im Event-Titel noch
 * sonst irgendwo taucht ein Name, eine E-Mail oder ein Preis auf - aus
 * Datenschutzgründen sieht ein Besucher hier NUR, DASS und WANN etwas
 * belegt ist, nicht VON WEM. Die Daten kommen deshalb von einem
 * eigenen, bewusst reduzierten Backend-Endpunkt
 * (GET /api/buchungen/oeffentlich), der serverseitig gar keine
 * Gästedaten mitschickt - nicht nur im Frontend versteckt.
 *
 * Klick auf ein Legenden-Item filtert die Kalenderansicht auf NUR
 * dieses Objekt - nochmal draufklicken hebt den Filter wieder auf.
 * "gefiltertesObjekt" hält dabei den Namen des aktuell gewählten
 * Objekts (oder null = kein Filter aktiv, alles sichtbar).
 *
 * Bewusst KEIN eventClick/Detailkarte - ohne Gästedaten gäbe es dort
 * nichts Sinnvolles zusätzlich zu zeigen.
 *
 * @returns {JSX.Element}
 */
export function PortalKalender() {
  const [events, setEvents] = useState([]);
  const [allObjects, setAllObjects] = useState([]);
  const [gefiltertesObjekt, setGefiltertesObjekt] = useState(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    async function ladeDaten() {
      try {
        setApiLoading(true);
        const [buchungenRes, objekteRes] = await Promise.all([
          fetch(OEFFENTLICHE_BUCHUNGEN_API),
          fetch(OBJEKTE_API),
        ]);
        if (!buchungenRes.ok || !objekteRes.ok) throw new Error(`Server antwortete mit einem Fehlerstatus`);

        const buchungen = await buchungenRes.json();
        setAllObjects(await objekteRes.json());

        const rows = [];
        buchungen.forEach((b) => {
          // Für jedes belegte Objekt (Haupt- UND ggf. Zusatzobjekt) ein
          // eigenes Balken-Event bauen - Titel ist bewusst NUR der
          // Objektname + "Belegt", niemals ein Gastname.
          [b.Objekte, b.ObjekteZusatz].forEach((objekt, idx) => {
            if (!objekt) return;

            const startParts = b.anreise.split(".");
            const isoStart = `${startParts[2]}-${startParts[1]}-${startParts[0]}`;
            const endParts = b.abreise.split(".");
            const isoEnd = `${endParts[2]}-${endParts[1]}-${endParts[0]}`;

            const realEndDate = new Date(isoEnd);
            realEndDate.setDate(realEndDate.getDate() + 1);
            const formattedEndDate = realEndDate.toISOString().split("T")[0];

            const stundenbasiertUndEinTag = (objektname) => istStundenbasiert(objektname) && b.anreise === b.abreise;

            const farbe = getResourceColor(objekt.name);

            rows.push({
              id: `${b.id}-${idx}`,
              resource: objekt.name,
              title: stundenbasiertUndEinTag(objekt.name) ? 
                `${objekt.name} -  ${b.anreise_zeit} bis ${b.abreise_zeit}` : // stundenbasiertes Objekt, An- und Abreise am selben Tag
                    istStundenbasiert(objekt.name) 
                        ? `${objekt.name} · ab ${b.anreise_zeit} / bis ${b.abreise_zeit}` : // stundenbasiertes Objekt, An- und Abreise an unterschiedlichen Tagen 
                            `${objekt.name} · Belegt`,  // kein stundenbasiertes Objekt
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

  /** Klick auf ein Legenden-Item: setzt den Filter, oder hebt ihn auf, wenn dasselbe Objekt nochmal angeklickt wird. */
  const handleLegendClick = (objektName) => {
    setGefiltertesObjekt((aktuell) => (aktuell === objektName ? null : objektName));
  };

  // Vor dem Rendern im Kalender werden die Events gefiltert
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
        {/* Legende: jedes Item ist klickbar (echter <button>
            statt <div>, wegen Tastatur-Bedienbarkeit/Barrierefreiheit).
            Das aktive Item bekommt einen dezenten roten Rahmen, damit
            sofort klar ist, welcher Filter gerade aktiv ist. */}
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

          {/* Kleiner "Filter aufheben"-Hinweis, nur sichtbar wenn ein Filter aktiv ist */}
          {gefiltertesObjekt && (
            <button
              type="button"
              className="legend-item"
              onClick={() => setGefiltertesObjekt(null)}
              style={{ cursor: "pointer", color: "#71717a", fontWeight: 600, background: "none", border: "none" }}
            >
              × Filter aufheben
            </button>
          )}
        </div>

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