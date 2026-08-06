// components/booking/ZeitraumKalender.jsx
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import deLocale from "@fullcalendar/core/locales/de";
import { isPastDate, isSameDay, isBetween, toISO } from "../../utils/javaUtils";
import "../../styles/shared-ui.css";
import "../../styles/fullcalendar-theme.css";

/**
 * ZeitraumKalender
 * ----------------
 * Der interaktive Sidebar-Kalender aus dem Buchungs-Assistenten - taucht
 * an zwei Stellen auf: links in Schritt 1, und im "Zeitraum
 * ändern"-Popup in Schritt 2/3.
 *
 * Die Klick-Logik (Start-/Enddatum wählen) liegt bewusst beim
 * Elternteil (Buchen.jsx via handleDateClick) - diese Komponente ist
 * nur für Anzeige, Hover-Vorschau und den "Auswahl aufheben"-Knopf
 * zuständig.
 *
 * Props:
 * - dateRange:          { start: Date|null, end: Date|null } - aktuelle Auswahl
 * - onDateClick:        FullCalendar-Callback, wird beim Klick auf einen Tag aufgerufen
 * - hoveredDate:         Date|null - Tag, über dem die Maus gerade schwebt
 * - onHoverChange:       (date: Date|null) => void
 * - onClearSelection:    () => void - "× Auswahl aufheben"-Knopf
 */
export function ZeitraumKalender({
  dateRange,
  onDateClick,
  hoveredDate,
  onHoverChange,
  onClearSelection,
}) {
  // Welcher Monat soll beim (Neu-)Aufbau des Kalenders zu sehen sein?
  // Ist bereits ein Startdatum gewählt (z.B. weil man im "Zeitraum
  // ändern"-Popup in Schritt 2/3 eine bestehende Buchung bearbeitet),
  // zeigen wir DESSEN Monat - sonst müsste man sich im Popup jedes Mal
  // erst wieder mühsam zum eigentlich schon gewählten Monat vorklicken.
  // "initialDate" wirkt bei FullCalendar nur beim MOUNT der Komponente,
  // was hier genau passt: das Popup wird bei jedem Öffnen (isZeitraumEditorOpen)
  // komplett neu gemountet, berechnet also jedes Mal frisch den richtigen
  // Startmonat. Nur wenn noch gar keine Auswahl existiert (z.B. Schritt 1
  // ganz am Anfang), greift der feste Fallback (aktueller Monat).
  const initialDate = dateRange.start
    ? toISO(dateRange.start)
    : dateRange.end
      ? toISO(dateRange.end)
      : toISO(new Date());

  return (
    <div
      className="sidebar-calendar-box"
      onMouseLeave={() => onHoverChange(null)}
      style={{
        backgroundColor: "#f4f4f5",
        borderRadius: "8px",
        padding: "16px",
        height: "fit-content",
      }}
    >
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={initialDate}
        locales={[deLocale]}
        locale="de"
        dateClick={onDateClick}
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        height="auto"
        dayCellDidMount={(arg) => {
          if (!isPastDate(arg.date)) {
            arg.el.addEventListener("mouseenter", () => onHoverChange(arg.date));
          }
        }}
        dayCellClassNames={(arg) => {
          const classes = [];
          const date = arg.date;
          if (isPastDate(date)) return ["fc-day-past-disabled"];
          if (isSameDay(date, dateRange.start)) classes.push("fc-day-selected-start");
          if (isSameDay(date, dateRange.end)) classes.push("fc-day-selected-end");
          if (
            dateRange.start &&
            dateRange.end &&
            isBetween(date, dateRange.start, dateRange.end)
          ) {
            classes.push("fc-day-selected-inbetween");
          }
          if (dateRange.start && !dateRange.end && hoveredDate && date > dateRange.start) {
            if (date < hoveredDate) classes.push("fc-day-hover-inbetween");
            if (isSameDay(date, hoveredDate)) classes.push("fc-day-hover-endpoint");
          }
          return classes;
        }}
      />
      {(dateRange.start || dateRange.end) && (
        <button type="button" className="btn-clear-selection" onClick={onClearSelection}>
          × Auswahl aufheben
        </button>
      )}
    </div>
  );
}