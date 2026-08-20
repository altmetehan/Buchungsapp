import "../../styles/shared-ui.css";

/**
 * Berechnet die verbleibenden Tage bis zum Anreisedatum.
 * Akzeptiert ISO-Strings ("YYYY-MM-DD") oder deutsche Formate ("DD.MM." / "DD.MM.YYYY").
 */
function berechneTageBis(datumVal) {
  if (!datumVal) return null;
  let targetDate = null;

  if (typeof datumVal === "string") {
    if (datumVal.includes("-")) {
      const [y, m, d] = datumVal.split("-").map(Number);
      targetDate = new Date(y, m - 1, d);
    } else if (datumVal.includes(".")) {
      const parts = datumVal.split(".").map((p) => p.trim()).filter(Boolean);
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const currentYear = new Date().getFullYear();
      const year = parts[2] && parts[2].length === 4 ? parseInt(parts[2], 10) : currentYear;
      targetDate = new Date(year, month, day);
    }
  } else if (datumVal instanceof Date) {
    targetDate = datumVal;
  }

  if (!targetDate || isNaN(targetDate.getTime())) return null;

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffMs = targetDate - heute;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * DashboardKategorieSektion
 * --------------------------
 * Eine komplette Dashboard-Sektion für EINE Objekt-Kategorie
 * (Wohnungen ODER Andere Objekte): Status-Liste oben, "Nächste
 * Reservierungen"-Liste unten.
 *
 * Props:
 * - kategorieName:        Anzeigename, z.B. "Wohnungen" oder "Andere Objekte"
 * - objekte:               Stammdaten-Liste dieser Kategorie
 * - getLiveStatus:         (name: string) => { status, guest, subDate }
 * - ankuenfte:             vorbereitete Liste der nächsten Ankünfte (inkl. gaesteInfo)
 * - onDetailsClick:        (objekt) => void - öffnet den Mini-Kalender (Status-Liste oben)
 * - onArrivalDetailsClick: (bookingId) => void - öffnet die Buchungskarte (Ankünfte-Liste unten)
 * - onPdfClick:            (objekt) => void
 * - onNavigateBuchen:      () => void - Klick auf "Zur Buchung →"
 * - onNavigateAlle:        () => void - Klick auf "Alle →" (Reservierungen)
 */
export function DashboardKategorieSektion({
  kategorieName,
  objekte,
  getLiveStatus,
  ankuenfte,
  onDetailsClick,
  onArrivalDetailsClick,
  onPdfClick,
  onNavigateBuchen,
  onNavigateAlle,
}) {
  return (
    <div className="dashboard-section">
      <div className="section-header">
        <h3>{kategorieName} - Status</h3>
        <button className="text-link" onClick={onNavigateBuchen}>
          Zur Buchung →
        </button>
      </div>

      <div className="dashboard-card-list">
        {objekte.map((obj) => {
          const live = getLiveStatus(obj.name);
          const istBelegt = live.status === "belegt";
          const statusClass = istBelegt ? "status-row--belegt" : "status-row--frei";

          return (
            <div key={obj.id} className={`list-row grid-status ${statusClass}`}>
            <span className="row-title">
              {obj.name}
            </span>
              <span className={`tag ${live.status}`}>
                {live.status} <span className="sub-date">{live.subDate}</span>
              </span>
              <span className="row-guest">
                {live.guest}
              </span>
              <div className="row-actions">
                <button className="btn-outline" onClick={() => onDetailsClick(obj)}>
                  Details
                </button>
                <button className="btn-pdf-action" disabled={live.status !== "belegt"} onClick={() => onPdfClick(obj)}>
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-header">
        <h3>{kategorieName} - Nächste Reservierungen</h3>
        <button className="text-link" onClick={onNavigateAlle}>
          Alle →
        </button>
      </div>

      <div className="dashboard-card-list">
        {ankuenfte.map((arrival) => {
          const rawDate = arrival.start || arrival.anreise || arrival.arrivalDate;
          const tage = berechneTageBis(rawDate);

          let dateDisplay = arrival.arrivalDate;
          if (tage != null) {
            if (tage === 0) {
              dateDisplay = `heute (${arrival.arrivalDate})`;
            } else if (tage === 1) {
              dateDisplay = `morgen (${arrival.arrivalDate})`;
            } else if (tage > 1) {
              dateDisplay = `in ${tage} Tagen (${arrival.arrivalDate})`;
            }
          }

          const istDringend = tage !== null && tage <= 3 && tage >= 0;

          return (
            <div key={arrival.id} className={`list-row grid-arrival ${istDringend ? "arrival-row--dringend" : ""}`}>
              <span className="row-guest-name">{arrival.guestName}</span>
              <div>
                <span className="row-resource">
                  {arrival.resource}
                </span>
                {arrival.gaesteInfo && (
                  <div className="row-resource row-resource-sub">
                    {arrival.gaesteInfo}
                  </div>
                )}
              </div>
              <span className="arrival-date">
                {dateDisplay}
                {arrival.arrivalTime && (
                  <span className="sub-date">
                    {arrival.arrivalTime} Uhr
                  </span>
                )}
              </span>
              {/* Öffnet dieselbe Buchungskarte wie überall sonst in der App (Reservierungen, Kalender). */}
              <div className="row-actions">
                <button className="btn-outline" onClick={() => onArrivalDetailsClick(arrival.id)}>
                  Details
                </button>
              </div>
            </div>
          );
        })}

        {ankuenfte.length === 0 && (
          <div className="empty-state-row">Keine anstehenden Reservierungen</div>
        )}
      </div>
    </div>
  );
}