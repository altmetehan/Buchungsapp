import { Link } from "react-router-dom";
import { BuchungsZusammenfassung } from "./BuchungsZusammenfassung";
import { formatDe, istWohnung } from "../../utils/javaUtils";
import "../../styles/shared-ui.css";
import { TimeDropdown } from "../ui/TimeDropdown";

/**
 * BuchenSchritt3
 * --------------
 * Schritt 3 (letzter Schritt) des Buchungs-Assistenten: Buchungsdetails
 * (Uhrzeiten bei stundenbasierten Objekten, Rabatt/Endpreis,
 * Kennzeichen, Notizen) und der finale "Buchung abschließen"-Button.
 * Reine Anzeige - der komplette Zustand kommt aus dem
 * useBuchungsAssistent-Hook ("vm").
 *
 * @param {{vm: object}} props - vm = das View-Model aus useBuchungsAssistent()
 * @returns {JSX.Element}
 */
export function BuchenSchritt3({ vm }) {
  const rabattZahl = parseFloat(vm.rabattProzent.replace(",", ".")) || 0;

  return (
    <div className="buchen-container">
      <span className="breadcrumb">
        <Link to="/buchen" className="breadcrumb-link">
          Buchen
        </Link>{" "}
        &rarr; <span className="active-path">Neue Buchung - {vm.selectedObjekt?.name}</span>
      </span>
      <h2>Neue Buchung</h2>
      <p className="subtitle">Buchungsdetails und Gästedaten erfassen</p>

      <BuchungsZusammenfassung
        selectedObjekt={vm.selectedObjekt}
        onSelectObjekt={vm.setSelectedObjekt}
        dateRange={vm.dateRange}
        onDateClick={vm.handleDateClick}
        hoveredDate={vm.hoveredDate}
        onHoverChange={vm.setHoveredDate}
        onClearSelection={vm.handleClearSelection}
        naechteAnz={vm.naechteAnz}
        startISO={vm.startISO}
        endISO={vm.endISO}
        objektStammdaten={vm.objektStammdaten}
        istVerfuegbar={(name, sISO, eISO) =>
          vm.istVerfuegbar(name, sISO, eISO, vm.zeiten.anreiseZeit, vm.zeiten.abreiseZeit)
        }
        selectedObjektVerfuegbar={vm.selectedObjektVerfuegbar}
        gesamtpreis={vm.effektiverEndpreis}
        guestCounts={vm.guestCounts}
        onGuestCountsChange={(erwachsene, kinder) => vm.setGuestCounts({ erwachsene, kinder })}
        stundenAnz={vm.istHauptobjektStundenbasiert ? vm.stundenHauptobjekt : null}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          vm.handleFinalizeBooking();
        }}
      >
        <div className="form-card">
          <h4>Buchungsdetails</h4>
          <div className="form-grid">
            <div className="input-group">
              <label>Anreise</label>
              <input type="text" value={formatDe(vm.dateRange.start)} disabled />
            </div>
            <div className="input-group">
              <label>Abreise</label>
              <input type="text" value={formatDe(vm.dateRange.end)} disabled />
            </div>
            <div className="input-group full-width">
              <label>Objekt</label>
              <select value={vm.selectedObjekt?.name} disabled className="select-disabled-mock">
                <option>{vm.selectedObjekt?.name}</option>
              </select>
            </div>

            {/* TIMEDROPDOWNS */}
            {vm.istHauptobjektStundenbasiert && (
              <>
                <TimeDropdown
                  label="Abholzeit"
                  required
                  value={vm.zeiten.anreiseZeit}
                  onChange={(val) => vm.setZeiten({ ...vm.zeiten, anreiseZeit: val })}
                />
                <TimeDropdown
                  label="Rückgabezeit"
                  required
                  exclusiveMin
                  minTime={vm.startISO === vm.endISO ? vm.zeiten.anreiseZeit : "00:00"}
                  value={vm.zeiten.abreiseZeit}
                  onChange={(val) => vm.setZeiten({ ...vm.zeiten, abreiseZeit: val })}
                />

                {/* KOLLISIONSHINWEIS (ROT) */}
                {vm.kollisionsText ? (
                  <div className="input-group full-width" style={{ marginTop: "-4px", marginBottom: "8px" }}>
                    <p style={{ fontSize: "13px", color: "#ef4444", fontWeight: "500", marginLeft: "4px" }}>
                      {vm.kollisionsText}
                    </p>
                  </div>
                ) : (
                  <div className="input-group full-width">
                    <p style={{ fontSize: "13px", color: "#71717a" }}>
                      {vm.stundenHauptobjekt > 0
                        ? `Gesamtdauer: ${vm.stundenHauptobjekt.toFixed(1)} Stunden`
                        : "Rückgabezeit muss nach der Abholzeit liegen."}
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="input-group">
              <label>Berechneter Preis (€)</label>
              <input type="text" value={vm.gesamtpreisBerechnet.toFixed(2)} disabled />
            </div>
            <div className="input-group">
              <label>Rabatt (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={vm.rabattProzent}
                onChange={vm.handleRabattChange}
                placeholder="0"
              />
            </div>
            {/* SPALTEN-SPLIT: ENDPREIS (3/4) UND PKW-KENNZEICHEN (1/4) */}
            <div className="input-group full-width form-row-split">
              <div className="input-group">
                <label>Endpreis (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={vm.endpreisManuell}
                  onChange={vm.handleEndpreisChange}
                />
                {rabattZahl > 0 && (
                  <p style={{ fontSize: "12px", color: "#71717a" }}>
                    Rabatt gilt auf die gesamte Buchung - Endpreis kann hier trotzdem jederzeit von Hand angepasst werden.
                  </p>
                )}
              </div>

              <div className="input-group">
                <label>PKW - Kennzeichen</label>
                <input
                  type="text"
                  placeholder="z.B. DO-123AB"
                  value={vm.bookingDetails.kennzeichen}
                  onChange={(e) => vm.setBookingDetails({ ...vm.bookingDetails, kennzeichen: e.target.value })}
                />
              </div>
            </div>
            <div className="input-group full-width">
              <label>Buchungsinformationen</label>
              <textarea
                placeholder="sonstige Informationen .."
                value={vm.bookingDetails.info}
                onChange={(e) => vm.setBookingDetails({ ...vm.bookingDetails, info: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* WARNUNG BEI NICHT EINHALTUNG DER WOCHENTAGS-REGELN FÜR WOHNUNGEN */}
        {istWohnung(vm.selectedObjekt?.name) && (!vm.checkinWochentagPasst || !vm.checkoutWochentagPasst) && (
          <div
            style={{
              color: "#ef4444",
              fontSize: "14px",
              fontWeight: "600",
              textAlign: "right",
              marginTop: "16px",
              width: "100%",
            }}
          >
            ⚠ {!vm.checkinWochentagPasst && !vm.checkoutWochentagPasst && vm.CHECKIN_WOCHENTAG === vm.CHECKOUT_WOCHENTAG
              ? `Wohnungsbuchungen sind nur von ${vm.CHECKIN_WOCHENTAG} bis ${vm.CHECKOUT_WOCHENTAG} möglich.`
              : !vm.checkinWochentagPasst
              ? `Anreise für Wohnungen ist nur am ${vm.CHECKIN_WOCHENTAG} möglich (gewählt: ${vm.startWochentag}).`
              : `Abreise für Wohnungen ist nur am ${vm.CHECKOUT_WOCHENTAG} möglich (gewählt: ${vm.endWochentag}).`}
          </div>
        )}

        {/* WARNUNG BEI MINDESTAUFENTHALT */}
        {vm.naechteAnz < vm.MINDEST_NAECHTE_WOHNUNG && !vm.istHauptobjektStundenbasiert && (
          <div
            style={{
              color: "#ef4444",
              fontSize: "14px",
              fontWeight: "600",
              textAlign: "right",
              marginTop: "16px",
              width: "100%",
            }}
          >
            ⚠ Mindestaufenthaltsdauer für Wohnungen: {vm.MINDEST_NAECHTE_WOHNUNG} Nächte (aktuell
            gewählt: {vm.naechteAnz}).
          </div>
        )}
        <div className="wizard-actions" style={{ marginTop: "16px" }}>
          <button type="button" className="btn-outline btn-outline--lg" onClick={() => vm.setWizardStep(2)}>
            Zurück
          </button>
          <button type="submit" className="btn-primary" disabled={vm.istBuchungUngueltig || vm.isSaving}>
            {vm.isSaving ? "Speichert..." : "Buchung abschließen"}
          </button>
        </div>
      </form>
    </div>
  );
}