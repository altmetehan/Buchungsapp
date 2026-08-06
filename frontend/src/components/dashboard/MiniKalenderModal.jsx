import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import deLocale from "@fullcalendar/core/locales/de";
import "../../styles/shared-ui.css";
import "../../styles/fullcalendar-theme.css";
import { toISO } from "../../utils/javaUtils";

/**
 * MiniKalenderModal
 * ------------------
 * Kleines Popup mit dem Belegungsplan (FullCalendar) für EIN einzelnes
 * Objekt - öffnet sich vom Dashboard aus über den "Details"-Knopf bei
 * einem Apartment oder Fahrzeug.
 *
 * Props:
 * - objekt:  das Objekt, dessen Belegungsplan gezeigt wird (null/undefined = Modal geschlossen)
 * - events:  fertige FullCalendar-Events für dieses Objekt
 * - onClose: Funktion, die beim Schließen ausgeführt wird
 */
export function MiniKalenderModal({ objekt, events, onClose, onEventClick }) {
  if (!objekt) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content modal-calendar-mini form-card">
        <h3 style={{ marginBottom: "16px" }}>Belegungsplan: {objekt.name}</h3>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #e4e4e7",
          }}
        >
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            // toISO(new Date()) statt eines festen Datums, damit das
            // Popup immer im aktuellen Monat aufgeht.
            initialDate={toISO(new Date())}
            locales={[deLocale]}
            locale="de"
            events={events}
            eventClick={(info) => {
              if (onEventClick) {
                onEventClick(info.event.id);
              }
            }}
            headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
            height="380px"
            dayMaxEvents={false}
          />
        </div>

        <div className="wizard-actions" style={{ marginTop: "20px" }}>
          <button className="btn-primary" style={{ padding: "8px 20px", fontSize: "13px" }} onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}