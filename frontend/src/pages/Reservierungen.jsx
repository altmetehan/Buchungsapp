import { useState, useMemo, useEffect } from "react";
import { BuchungskarteModal } from "../components/BuchungskarteModal";
import { Toast } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { istStundenbasiert, germanToISO, parseGermanDate } from "../utils/javaUtils";
import "../styles/shared-ui.css";
import "../styles/pageStyles/Reservierungen.css";

const BUCHUNGEN_API = "/api/buchungen";

const getRelativeDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
};

const formatDateDe = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${d}.${m}.${y}`;
};

const formatDateISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const berechneAnzeigePreis = (b, obj, anreiseDate, abreiseDate) => {
  if (b.preis !== null && b.preis !== undefined) {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(b.preis);
  }
  if (!(obj.checkIn && obj.checkOut && obj.preisProNacht)) {
    return "€ 0,00";
  }

  let gesamt;
  if (istStundenbasiert(obj.resource)) {
    const [sh, sm] = (b.anreise_zeit || "00:00").split(":").map(Number);
    const [eh, em] = (b.abreise_zeit || "23:59").split(":").map(Number);
    const startD = parseGermanDate(obj.checkIn);
    startD.setHours(sh, sm, 0, 0);
    const endD = parseGermanDate(obj.checkOut);
    endD.setHours(eh, em, 0, 0);
    const diffMs = endD - startD;
    const stunden = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 1;
    gesamt = stunden * obj.preisProNacht;
  } else {
    const naechte = Math.max(1, Math.ceil(Math.abs(abreiseDate - anreiseDate) / (1000 * 60 * 60 * 24)));
    gesamt = naechte * obj.preisProNacht;
  }

  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(gesamt);
};

export function Reservierungen() {
  const { toast, showToast, dismissToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResForDetails, setSelectedResForDetails] = useState(null);

  const today = new Date();
  const heuteSort = formatDateISO(today);
  const morgenSort = formatDateISO(getRelativeDate(1));

  const [reservations, setReservations] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    async function ladeReservierungen() {
      try {
        setApiLoading(true);
        const response = await fetch(BUCHUNGEN_API);
        if (!response.ok) {
          throw new Error(`Server antwortete mit Status ${response.status}`);
        }
        const buchungen = await response.json();

        const rows = buchungen.map((b) => {
          const gast = b.Gaeste;
          const objekt = b.Objekte;

          const obj = {
            id: b.id,
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
            preisanpassungen: b.Preisanpassungen || [],
            erwachsene: b.erwachsene ?? null,
            kinder: b.kinder ?? null
          };

          const heute = new Date();
          heute.setHours(0, 0, 0, 0);
          const anreiseDate = parseGermanDate(obj.checkIn);
          const abreiseDate = parseGermanDate(obj.checkOut);

          if (heute < anreiseDate) {
            obj.status = "bevorstehend";
          } else if (heute >= anreiseDate && heute <= abreiseDate) {
            obj.status = "aktuell";
          } else {
            obj.status = "vergangen";
          }

          obj.preis = berechneAnzeigePreis(b, obj, anreiseDate, abreiseDate);

          return obj;
        });

        setReservations(rows);
        setApiError(null);
      } catch (err) {
        console.error("Reservierungen: Fehler beim Laden vom Backend:", err);
        setApiError(
          "Backend nicht erreichbar. Läuft der Server (node src/server.js im backend-Ordner)?",
        );
      } finally {
        setApiLoading(false);
      }
    }

    ladeReservierungen();
  }, []);

  const reservationsWithSortDate = useMemo(() => {
    return reservations.map((res) => ({ ...res, sortDate: germanToISO(res.checkIn) }));
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    const searchWords = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (searchWords.length === 0) return reservationsWithSortDate;

    const idDarfMitsuchen = searchWords.length === 1;

    return reservationsWithSortDate.filter((res) => {
      const textFelder = [
        res.name,
        res.resource,
        res.zusatzobjektName,
        res.email,
        res.phone,
        res.infos,
        res.checkIn,
        res.checkOut,
      ];
      if (idDarfMitsuchen) textFelder.push(res.id?.toString());

      const durchsuchbarerText = textFelder.filter(Boolean).join(" ").toLowerCase();

      return searchWords.every((word) => {
        if (/^\d+$/.test(word)) {
          const regex = new RegExp(`\\b${word}\\b`, "i");
          return regex.test(durchsuchbarerText);
        }
        return durchsuchbarerText.includes(word);
      });
    });
  }, [reservationsWithSortDate, searchQuery]);

  // Welche Tage werden gerendert?
  let daysToDisplay = [];

  const isSearching = searchQuery.trim() !== "";

  if (!isSearching) {
    // Ohne Suche: Heute & Morgen sind fix sichtbar, plus die nächste künftige Buchung
    daysToDisplay = [heuteSort, morgenSort];

    const futureDates = reservationsWithSortDate
      .map((res) => res.sortDate)
      .filter((date) => date > morgenSort);
    const uniqueFutureDates = Array.from(new Set(futureDates)).sort();
    if (uniqueFutureDates.length > 0) {
      daysToDisplay.push(uniqueFutureDates[0]);
    }
  } else {
    // Mit aktiver Suche: Nur nach dem echten Anreisetag (sortDate) gruppieren!
    // Dadurch erscheint jede passende Buchung exakt 1-mal an ihrem Anreisetag.
    const matchingDates = new Set();
    filteredReservations.forEach((res) => {
      if (res.sortDate) matchingDates.add(res.sortDate);
    });
    daysToDisplay = Array.from(matchingDates).sort();
  }

  if (apiLoading) return <p className="anfragen-loading">Lade Reservierungen vom Server...</p>;
  if (apiError) return <p className="anfragen-error">{apiError}</p>;

  return (
    <div className="reservations-container">
      <div className="page-header">
        <div className="header-text">
          <h2>Reservierungen</h2>
          <p className="subtitle">Übersicht der aktuellen Tage und anstehenden Ereignisse. Die Buchungsbestätigung der jeweligen 
            Buchung kann jederzeit als PDF heruntergeladen werden.</p>
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Suche nach Name, ID oder Apartment/Bus für zukünftige Buchungen..."
          className="search-input search-input-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {daysToDisplay.length > 0 ? (
        daysToDisplay.map((sortDate) => {
          // Ohne Suche gilt bei "HEUTE" der Sonderfall für alle aktuell laufenden Buchungen.
          // Bei aktiver Suche wird strikt nach dem Anreisetag gefiltert, um Duplikate zu vermeiden.
          const dayReservations = filteredReservations.filter((res) =>
            !isSearching && sortDate === heuteSort
              ? res.status === "aktuell"
              : res.sortDate === sortDate
          );
          let displayTitle;
          if (sortDate === heuteSort) {
            displayTitle = `${formatDateDe(today)} (HEUTE)`;
          } else if (sortDate === morgenSort) {
            displayTitle = `${formatDateDe(getRelativeDate(1))} (MORGEN)`;
          } else {
            const [y, m, d] = sortDate.split("-");
            displayTitle = `${d}.${m}.${y}`
          }

          return (
            <div key={sortDate} className="reservation-group">
              <h4 className="group-date-header">{displayTitle}</h4>

              <div className="card-box">
                {dayReservations.length > 0 ? (
                  <>
                    <div className="list-row list-header-row grid-reservation">
                      <span>ID</span>
                      <span>Name</span>
                      <span>Apartment / Objekt</span>
                      <span>Anreise</span>
                      <span>Abreise</span>
                      <span>Telefonnummer</span>
                      <span>Status</span>
                      <span>Infos</span>
                      <span></span>
                    </div>

                    {dayReservations.map((res) => (
                      <div key={res.id} className="list-row grid-reservation">
                        <span className="res-id">#{res.id}</span>
                        <span className="res-name">
                          {res.name}
                          {res.erwachsene !== null && res.erwachsene !== undefined && (
                            <span className="res-guests-sub">
                              {res.erwachsene} Erw.{res.kinder ? ` · ${res.kinder} Kind.` : ""}
                            </span>
                          )}
                        </span>
                        <span className="row-title">
                          {res.resource} {res.zusatzobjektName !== null ? "+ " + res.zusatzobjektName : ""}
                        </span>
                        <span>
                          {res.checkIn}
                          {res.anreiseZeit && <span className="res-time">{res.anreiseZeit}</span>}
                        </span>
                        <span>
                          {res.checkOut}
                          {res.abreiseZeit && <span className="res-time">{res.abreiseZeit}</span>}
                        </span>
                        <span className="res-phone">{res.phone}</span>
                        <span className={`tag ${res.status}`}>{res.status}</span>
                        <span className="res-info-text" title={res.infos || ""}>
                          {res.infos ? res.infos : "-"}
                        </span>
                        <div className="row-actions">
                          <button className="btn-outline" onClick={() => setSelectedResForDetails(res)}>
                            Details
                          </button>
                          <button
                            className="btn-pdf-action"
                            onClick={() => window.open(`${BUCHUNGEN_API}/${res.id}/pdf`, "_blank")}
                          >
                            PDF
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="empty-state-row">Keine neuen Reservierungen vorhanden</div>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="card-box empty-state-box">
          <div className="empty-state-row">
            Keine Reservierungen für deine Suchanfrage gefunden.
          </div>
        </div>
      )}

      <BuchungskarteModal
        reservation={selectedResForDetails}
        onClose={() => setSelectedResForDetails(null)}
        onDeleted={(id, msg) => {
          setReservations((prev) => prev.filter((b) => b.id !== id));
          if (msg) showToast("success", msg);
        }}
        onUpdated={(updated, msg) => {
          setReservations((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
          if (msg) showToast("success", msg);
        }}
      />
      <Toast toast={toast} onClose={dismissToast} />
    </div>
  );
}