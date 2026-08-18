import { useState } from "react";
import { ZeitraumKalender } from "./ZeitraumKalender";
import { GuestCountModal } from "./GuestCountModal";
import { formatPrettyDe, istStundenbasiert } from "../../utils/javaUtils";
import "../../styles/shared-ui.css";

/**
 * BuchenSchritt1
 * --------------
 * Schritt 1 des Buchungs-Assistenten: Zeitraum & Gästezahl wählen und
 * direkt sehen, welche Objekte dafür verfügbar sind.
 */
export function BuchenSchritt1({ vm }) {
  const [isKalenderModalOpen, setIsKalenderModalOpen] = useState(false);

  // Baut einen informativen Hinweistext für Wohnungsregeln zusammen
  const hatWochentagRegel = vm.CHECKIN_WOCHENTAG || vm.CHECKOUT_WOCHENTAG;
  let wohnungHinweisText = null;
  let naechteHinweisText = vm.MINDEST_NAECHTE_WOHNUNG === 1 ? "Nacht" : "Nächte";
  if (hatWochentagRegel) {
    if (vm.CHECKIN_WOCHENTAG && vm.CHECKOUT_WOCHENTAG && vm.CHECKIN_WOCHENTAG === vm.CHECKOUT_WOCHENTAG) {
      wohnungHinweisText = `Für Wohnungen gilt: Buchung nur von ${vm.CHECKIN_WOCHENTAG} bis ${vm.CHECKOUT_WOCHENTAG} (Mindestaufenthalt: ${vm.MINDEST_NAECHTE_WOHNUNG} ${naechteHinweisText}).`;
    } else if (vm.CHECKIN_WOCHENTAG && vm.CHECKOUT_WOCHENTAG) {
      wohnungHinweisText = `Für Wohnungen gilt: Anreise nur ${vm.CHECKIN_WOCHENTAG}, Abreise nur ${vm.CHECKOUT_WOCHENTAG} (Mindestaufenthalt: ${vm.MINDEST_NAECHTE_WOHNUNG} ${naechteHinweisText}).`;
    } else if (vm.CHECKIN_WOCHENTAG) {
      wohnungHinweisText = `Für Wohnungen gilt: Anreise nur am ${vm.CHECKIN_WOCHENTAG} möglich (Mindestaufenthalt: ${vm.MINDEST_NAECHTE_WOHNUNG} ${naechteHinweisText}).`;
    } else {
      wohnungHinweisText = `Für Wohnungen gilt: Abreise nur am ${vm.CHECKOUT_WOCHENTAG} möglich (Mindestaufenthalt: ${vm.MINDEST_NAECHTE_WOHNUNG} ${naechteHinweisText}).`;
    }
  } else if (vm.MINDEST_NAECHTE_WOHNUNG > 1) {
    wohnungHinweisText = `Für Wohnungen gilt eine Mindestaufenthaltsdauer von ${vm.MINDEST_NAECHTE_WOHNUNG} Nächten.`;
  }

  return (
    <div className="buchen-container">
      <h2>Buchen</h2>
      <p className="subtitle">Zeitraum und Gästezahl wählen, Verfügbarkeit prüfen und direkt buchen</p>

      {/* Info-Banner für zentrale Wohnungsregeln */}
      {wohnungHinweisText && (
        <div
          style={{
            backgroundColor: "#f4f4f5",
            borderLeft: "4px solid #e30000",
            padding: "10px 14px",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#3f3f46",
            marginBottom: "16px",
            lineHeight: "1.4",
          }}
        >
          ℹ <strong>Hinweis:</strong> {wohnungHinweisText}
        </div>
      )}

      <div className="booking-search-bar">
        <button
          type="button"
          className="search-field date-display-only"
          onClick={() => setIsKalenderModalOpen(true)}
          style={{ cursor: "pointer", border: "none", background: "transparent", textAlign: "left", borderRight: "#71717a 1px solid" }}
        >
          <span>ANREISE</span>
          {vm.dateRange.start ? <strong>{formatPrettyDe(vm.dateRange.start)}</strong> : <p>Anreisedatum wählen</p>}
        </button>

        <button
          type="button"
          className="search-field date-display-only"
          onClick={() => setIsKalenderModalOpen(true)}
          style={{ cursor: "pointer", border: "none", background: "transparent", textAlign: "left", borderRight: "#71717a 1px solid"  }}
        >
          <span>ABREISE</span>
          {vm.dateRange.end ? <strong>{formatPrettyDe(vm.dateRange.end)}</strong> : <p>Abreisedatum wählen</p>}
        </button>

        <button type="button" className="search-field" onClick={() => vm.setIsGuestPopupOpen(true)}>
          <span>GÄSTE</span>
          <strong>
            {vm.guestCounts.erwachsene} Erw. - {vm.guestCounts.kinder} Kind.
          </strong>
        </button>
      </div>

      <div className="booking-main-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="availability-box" style={{ margin: 0 }}>
          <div className="availability-header">
            <strong>Verfügbarkeit</strong>
            <span style={{ color: "#71717a", fontSize: "13px" }}>
              {vm.verfuegbareObjekte.length} Objekte geprüft
            </span>
          </div>
          <div className="availability-list">
            {vm.verfuegbareObjekte.map((obj) => {
              const isAvailable = obj.status === "verfügbar" || obj.status === "frei";
              const stundenbasiert = istStundenbasiert(obj.name);
              return (
                <div key={obj.id} className="availability-row">
                  <div className="obj-name-container">
                    <span className="obj-name">{obj.name}</span>
                    {obj.beschreibung && <span className="obj-objekt-info">{obj.beschreibung}</span>}
                  </div>
                  <span className="obj-info">{obj.info}</span>
                  <span className={`tag ${isAvailable ? "frei" : "belegt"}`}>{obj.status}</span>
                  <span
                    className="obj-price"
                    style={
                      obj.preis
                        ? { fontWeight: "bold", fontSize: "15px" }
                        : { fontWeight: "normal", fontSize: "13px", color: "#6b7280" }
                    }
                  >
                    {obj.preis
                      ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(obj.preis)
                      : `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2 }).format(obj.preisProNacht)} € ${stundenbasiert ? "/ Stunde" : "/ Nacht"}`}
                  </span>
                  <button
                    className={`btn-action-book ${obj.status !== "verfügbar" ? "disabled" : ""}`}
                    disabled={obj.status !== "verfügbar"}
                    onClick={() => vm.handleSelectObjekt(obj)}
                  >
                    Buchen
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isKalenderModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content form-card" style={{ maxWidth: "480px" }}>
            <h3 style={{ marginBottom: "8px" }}>Zeitraum wählen</h3>
            <p className="modal-delete-text" style={{ marginTop: 0, marginBottom: "16px" }}>
              Klicken Sie auf das An- und Abreisedatum.
            </p>

            <ZeitraumKalender
              dateRange={vm.dateRange}
              onDateClick={vm.handleDateClick}
              hoveredDate={vm.hoveredDate}
              onHoverChange={vm.setHoveredDate}
              onClearSelection={vm.handleClearSelection}
            />

            <div className="wizard-actions" style={{ marginTop: "20px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsKalenderModalOpen(false)}
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      <GuestCountModal
        isOpen={vm.isGuestPopupOpen}
        initialAdults={vm.guestCounts.erwachsene}
        initialChildren={vm.guestCounts.kinder}
        onClose={() => vm.setIsGuestPopupOpen(false)}
        onConfirm={(erwachsene, kinder) => {
          vm.setGuestCounts({ erwachsene, kinder });
          vm.setIsGuestPopupOpen(false);
        }}
      />
    </div>
  );
}