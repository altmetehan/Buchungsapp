import { Link, useNavigate } from "react-router-dom";
import { BuchungsZusammenfassung } from "./BuchungsZusammenfassung";
import { CountryDropdown } from "../ui/CountryDropdown";
import { istWohnung } from "../../utils/javaUtils";
import "../../styles/shared-ui.css";

/**
 * BuchenSchritt2
 * --------------
 * Schritt 2 des Buchungs-Assistenten: Gästedaten erfassen, inklusive
 * Autofill-Vorschlägen aus der bestehenden Gästeliste (sobald man 2+
 * Zeichen im Namensfeld tippt). Wie BuchenSchritt1 reine Anzeige - der
 * komplette Zustand kommt aus dem useBuchungsAssistent-Hook ("vm").
 *
 * @param {{vm: object}} props
 * @returns {JSX.Element}
 */
export function BuchenSchritt2({ vm }) {
  const navigate = useNavigate();

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
        gesamtpreis={vm.gesamtpreisBerechnet}
        guestCounts={vm.guestCounts}
        onGuestCountsChange={(erwachsene, kinder) => vm.setGuestCounts({ erwachsene, kinder })}
        stundenAnz={vm.istHauptobjektStundenbasiert ? vm.stundenHauptobjekt : null}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          vm.setWizardStep(3);
        }}
      >
        <div className="form-card">
          <h4>Tragen Sie die Details ein</h4>
          <div className="form-grid">
            {/* NAME MIT AUTOFILL-VORSCHLÄGEN */}
            <div className="input-group full-width" style={{ position: "relative" }} ref={vm.guestSuggestRef}>
              <label>Name (Vor- und Nachname) *</label>
              <input
                type="text"
                name="name"
                placeholder="Vor- und Nachname"
                required
                autoComplete="off"
                value={vm.guestData.name}
                onChange={vm.handleGuestChange}
                onFocus={() => vm.guestData.name.trim().length >= 2 && vm.setIsGuestSuggestOpen(true)}
              />
              {vm.matchedGuestId && (
                <p style={{ fontSize: "12px", color: "#2b9348", marginTop: "4px" }}>
                  ✓ Bestehender Gast ausgewählt - Änderungen werden beim Speichern übernommen.
                </p>
              )}
              {vm.isGuestSuggestOpen && vm.gastVorschlaege.length > 0 && (
                <div className="select-dropdown-popup" style={{ top: "68px" }}>
                  <div className="select-dropdown-list">
                    {vm.gastVorschlaege.map((g) => (
                      <div key={g.id} className="select-dropdown-item" onClick={() => vm.handleSelectGuestSuggestion(g)}>
                        <strong>{g.name}</strong>
                        <span style={{ color: "#71717a", marginLeft: "8px" }}>{g.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="input-group">
              <label>E-Mail-Adresse *</label>
              <input
                type="email"
                name="email"
                placeholder="E-Mail"
                required
                value={vm.guestData.email}
                onChange={vm.handleGuestChange}
              />
            </div>
            <div className="input-group">
              <label>Telefonnummer</label>
              <input
                type="tel"
                name="telefon"
                placeholder="Telefonnummer"
                value={vm.guestData.telefon}
                onChange={(e) =>
                  vm.setGuestData({ ...vm.guestData, telefon: e.target.value.replace(/[^0-9+ \-]/g, "") })
                }
              />
            </div>
            {/* SPALTEN-SPLIT: STRASSE (3/4) UND HAUSNUMMER (1/4) */}
            <div className="input-group full-width form-row-split">
              <div className="input-group">
                <label>Straße *</label>
                <input
                  type="text"
                  name="strasse"
                  placeholder="Straße eingeben"
                  required
                  value={vm.guestData.strasse}
                  onChange={vm.handleGuestChange}
                />
              </div>
              <div className="input-group">
                <label>Hausnummer *</label>
                <input
                  type="text"
                  name="hausnummer"
                  placeholder="Hnr."
                  required
                  value={vm.guestData.hausnummer}
                  onChange={vm.handleGuestChange}
                />
              </div>
            </div>
            <div className="input-group full-width form-row-split reverse">
              <div className="input-group">
                <label>Postleitzahl *</label>
                <input
                  type="text"
                  name="plz"
                  placeholder="PLZ"
                  required
                  value={vm.guestData.plz}
                  onChange={vm.handleGuestChange}
                />
              </div>
              <div className="input-group">
                <label>Stadt *</label>
                <input
                  type="text"
                  name="stadt"
                  placeholder="Stadt"
                  required
                  value={vm.guestData.stadt}
                  onChange={vm.handleGuestChange}
                />
              </div>
            </div>

            <CountryDropdown value={vm.guestData.land} onChange={(land) => vm.setGuestData({ ...vm.guestData, land })} />
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
        {vm.naechteAnz < vm.MINDEST_NAECHTE_WOHNUNG && istWohnung(vm.selectedObjekt?.name) && (
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
          <button type="button" className="btn-outline btn-outline--lg" onClick={() => navigate("/buchen")}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary" disabled={vm.istBuchungUngueltig}>
            Nächster Schritt
          </button>
        </div>
      </form>
    </div>
  );
}