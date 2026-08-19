import { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import deLocale from "@fullcalendar/core/locales/de";
import { BuchungskarteModal } from "../components/BuchungskarteModal";
import { Toast } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import "../styles/shared-ui.css";
import "../styles/fullcalendar-theme.css";
import { parseGermanDate, toISO, getResourceColor } from "../utils/javaUtils";

const BUCHUNGEN_API = "/api/buchungen";
const OBJEKTE_API = "/api/objekte";

const formatEuro = (betrag) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(betrag);

function buildeKalenderZeile(buchung, objekt, istZusatz) {
  if (!objekt) return null;

  const gast = buchung.Gaeste;
  const anreiseDate = parseGermanDate(buchung.anreise);
  const abreiseDate = parseGermanDate(buchung.abreise);

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  let status;
  if (heute < anreiseDate) {
    status = "bevorstehend";
  } else if (heute >= anreiseDate && heute <= abreiseDate) {
    status = "aktuell";
  } else {
    status = "vergangen";
  }

  let preis;
  if (buchung.preis) {
    preis = formatEuro(buchung.preis);
  } else if (buchung.anreise && buchung.abreise && objekt.preis) {
    const naechte = Math.ceil(Math.abs(abreiseDate - anreiseDate) / (1000 * 60 * 60 * 24));
    preis = formatEuro(naechte * objekt.preis);
  } else {
    preis = "€ 0,00";
  }

  return {
    id: buchung.id,
    eventId: istZusatz ? `${buchung.id}-zusatz` : `${buchung.id}`,
    istZusatzEintrag: istZusatz,
    name: gast?.name,
    email: gast?.email,
    phone: gast?.telnr,
    strasse: gast?.strasse,
    hnr: gast?.hnr,
    plz: gast?.plz,
    stadt: gast?.stadt,
    land: gast?.land,
    resource: objekt.name,
    objectinfo: objekt.beschreibung,
    preisProNacht: objekt.preis,
    checkIn: buchung.anreise,
    checkOut: buchung.abreise,
    anreiseZeit: buchung.anreise_zeit,
    abreiseZeit: buchung.abreise_zeit,
    infos: buchung.infos,
    status,
    preis,
    objekt_id: buchung.objekt_id,
    objekt_id_2: buchung.objekt_id_2 || null,
    hauptobjektName: buchung.Objekte?.name || null,
    zusatzobjektName: buchung.ObjekteZusatz?.name || null,
    ObjekteZusatz: buchung.ObjekteZusatz || null,
    rawBooking: buchung,
    preisanpassungen: buchung.Preisanpassungen || [],
    erwachsene: buchung.erwachsene,
    kinder: buchung.kinder,
  };
}

/**
 * Kalender
 * --------
 * Monatsübersicht (FullCalendar) über alle Buchungen. Legende UND
 * Balkenfarben werden automatisch aus der Objekte-Liste vom Backend
 * gebaut (getResourceColor()).
 *
 * NEU: Klick auf ein Legenden-Item filtert die Kalenderansicht auf NUR
 * dieses Objekt - nochmal draufklicken hebt den Filter wieder auf.
 * "gefiltertesObjekt" hält dabei den Namen des aktuell gewählten
 * Objekts (oder null = kein Filter aktiv, alles sichtbar).
 *
 * @returns {JSX.Element}
 */
export function Kalender() {
  const { toast, showToast, dismissToast } = useToast();
  const [selectedResForDetails, setSelectedResForDetails] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [allObjects, setAllObjects] = useState([]);
  const [gefiltertesObjekt, setGefiltertesObjekt] = useState(null);

  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    async function ladeDaten() {
      try {
        setApiLoading(true);
        const [buchungenRes, objekteRes] = await Promise.all([
          fetch(BUCHUNGEN_API),
          fetch(OBJEKTE_API),
        ]);
        if (!buchungenRes.ok || !objekteRes.ok) {
          throw new Error(`Server antwortete mit einem Fehlerstatus`);
        }
        const buchungen = await buchungenRes.json();
        const objekte = await objekteRes.json();
        setAllObjects(objekte);

        const rows = [];
        buchungen.forEach((b) => {
          const hauptEintrag = buildeKalenderZeile(b, b.Objekte, false);
          if (hauptEintrag) rows.push(hauptEintrag);

          const zusatzEintrag = buildeKalenderZeile(b, b.ObjekteZusatz, true);
          if (zusatzEintrag) rows.push(zusatzEintrag);
        });

        setReservations(rows);
        setApiError(null);
      } catch (err) {
        console.error("Kalender: Fehler beim Laden vom Backend:", err);
        setApiError(
          "Backend nicht erreichbar. Läuft der Server (node src/server.js im backend-Ordner)?",
        );
      } finally {
        setApiLoading(false);
      }
    }

    ladeDaten();
  }, []);

  // Vor dem Bauen der FullCalendar-Events wird - falls ein Filter aktiv
  // ist - erst die Reservierungsliste auf das gewählte Objekt
  // eingeschränkt. Ohne Filter (gefiltertesObjekt === null) bleibt
  // alles sichtbar.
  const sichtbareReservierungen = gefiltertesObjekt
    ? reservations.filter((r) => r.resource === gefiltertesObjekt)
    : reservations;

  const calendarEvents = sichtbareReservierungen.map((booking) => {
    const startParts = booking.checkIn ? booking.checkIn.split(".") : ["01", "01", "2026"];
    const isoStart = `${startParts[2]}-${startParts[1]}-${startParts[0]}`;

    const endParts = booking.checkOut ? booking.checkOut.split(".") : ["01", "01", "2026"];
    const isoEnd = `${endParts[2]}-${endParts[1]}-${endParts[0]}`;

    const realEndDate = new Date(isoEnd);
    realEndDate.setDate(realEndDate.getDate() + 1);
    const formattedEndDate = realEndDate.toISOString().split("T")[0];

    const farbe = getResourceColor(booking.resource);

    return {
      id: booking.eventId,
      title:`${booking.name} - ${booking.resource}`,
      start: isoStart,
      end: formattedEndDate,
      allDay: true,
      backgroundColor: farbe.bg,
      borderColor: farbe.border,
      textColor: "#ffffff",
    };
  });

  const handleEventClick = (info) => {
    const clickedBooking = reservations.find(
      (b) => b.eventId === info.event.id || b.id.toString() === info.event.id,
    );
    if (clickedBooking) {
      setSelectedResForDetails(clickedBooking);
    }
  };

  /** Klick auf ein Legenden-Item: setzt den Filter, oder hebt ihn auf, wenn dasselbe Objekt nochmal angeklickt wird. */
  const handleLegendClick = (objektName) => {
    setGefiltertesObjekt((aktuell) => (aktuell === objektName ? null : objektName));
  };

  if (apiLoading) return <p style={{ padding: "24px" }}>Lade Buchungen vom Server...</p>;
  if (apiError) return <p style={{ padding: "24px", color: "#e30000" }}>{apiError}</p>;

  return (
    <div className="calendar-page-container" style={{ width: "100%" }}>
      <h2>Kalenderansicht</h2>
      <p className="subtitle" style={{ marginBottom: "24px" }}>
        Belegungsplan aller Wohnungen und anderen Objekte im Monats-Grid
      </p>

      <div className="card-box" style={{ padding: "24px", backgroundColor: "#ffffff" }}>
        {/* Legende: jedes Item ist jetzt klickbar (echter <button>
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
          events={calendarEvents}
          eventClick={handleEventClick}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          height="680px"
          dayMaxEvents={false}
        />
      </div>
      <BuchungskarteModal
        reservation={selectedResForDetails}
        onClose={() => setSelectedResForDetails(null)}
        onDeleted={(id, msg) => {
          setReservations((prev) => prev.filter((b) => b.id !== id));
          if (msg) showToast("success", msg);
        }}
        onUpdated={(updated, msg) => {
          setReservations((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
          if (msg) showToast("success", msg); // <--- Zeigt den grünen Toast auf der Seite an!
        }}
      />
      <Toast toast={toast} onClose={dismissToast} />
    </div>
  );
}