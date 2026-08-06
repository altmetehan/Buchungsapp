import { BuchungsZusammenfassung } from "../../components/booking/BuchungsZusammenfassung";
import { CountryDropdown } from "../../components/ui/CountryDropdown";
import { TimeDropdown } from "../../components/ui/TimeDropdown";
import { useEinstellungen } from "../../hooks/useEinstellungen";
import "../../styles/shared-ui.css";
import "../../styles/pageStyles/AnfrageErstellen.css";

export function PortalAnfrageSchritt2({ vm }) {
  const { einstellungen } = useEinstellungen();

  return (
    <div className="buchen-container">
      <span className="breadcrumb">
        <button
          type="button"
          className="breadcrumb-link"
          style={{ background: "none", border: "none", padding: 0, font: "inherit" }}
          onClick={() => vm.setWizardStep(1)}
        >
          Anfrage stellen
        </button>{" "}
        &rarr; <span className="active-path">{vm.selectedObjekt?.name}</span>
      </span>
      <h2>Ihre Daten</h2>
      <p className="subtitle">Kontaktdaten eintragen und unverbindlich anfragen</p>

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

      {vm.unterschreitetMindestNaechte && (
        <div
          style={{
            color: "#ef4444",
            fontSize: "14px",
            fontWeight: "600",
            textAlign: "right",
            marginTop: "16px",
            marginBottom: "16px",
            width: "100%",
          }}
        >
          ⚠ Mindestaufenthaltsdauer für Wohnungen: {vm.MINDEST_NAECHTE_WOHNUNG} Nächte (aktuell
          gewählt: {vm.naechteAnz}).
        </div>
      )}

      <form onSubmit={vm.handleSubmitAnfrage}>
        <div className="form-card">
          <h4>
            {vm.istHauptobjektStundenbasiert ? "Uhrzeiten & Kontaktdaten" : "Kontaktdaten"}
          </h4>
          <div className="form-grid">
            {/* STUNDENBASIERTE UHRZEITEN (BUS / FORUM ETC.) */}
            {vm.istHauptobjektStundenbasiert && (
              <>
                <TimeDropdown
                  label="Abholzeit / Beginn"
                  required
                  value={vm.zeiten.anreiseZeit}
                  onChange={(val) => vm.setZeiten({ ...vm.zeiten, anreiseZeit: val })}
                />
                <TimeDropdown
                  label="Rückgabezeit / Ende"
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
                  <div className="input-group full-width" style={{ marginTop: "-8px", marginBottom: "8px" }}>
                    <p style={{ fontSize: "13px", color: "#71717a" }}>
                      {vm.stundenHauptobjekt > 0
                        ? `Gesamtdauer: ${vm.stundenHauptobjekt.toFixed(1)} Stunden`
                        : "⚠ Rückgabezeit muss nach der Abholzeit liegen."}
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="input-group full-width">
              <label>Name (Vor- und Nachname) *</label>
              <input type="text" name="name" placeholder="Vor- und Nachname" required value={vm.gastData.name} onChange={vm.handleGastChange} />
            </div>
            <div className="input-group">
              <label>E-Mail-Adresse *</label>
              <input type="email" name="email" placeholder="E-Mail" required value={vm.gastData.email} onChange={vm.handleGastChange} />
            </div>
            <div className="input-group">
              <label>Telefonnummer</label>
              <input
                type="tel"
                name="telnr"
                placeholder="Telefonnummer"
                value={vm.gastData.telnr}
                onChange={(e) => vm.setGastData({ ...vm.gastData, telnr: e.target.value.replace(/[^0-9+ \-]/g, "") })}
              />
            </div>
            <div className="input-group full-width form-row-split">
              <div className="input-group">
                <label>Straße *</label>
                <input type="text" name="strasse" placeholder="Straße eingeben" required value={vm.gastData.strasse} onChange={vm.handleGastChange} />
              </div>
              <div className="input-group">
                <label>Hausnummer *</label>
                <input type="text" name="hausnummer" placeholder="Hnr." required value={vm.gastData.hausnummer} onChange={vm.handleGastChange} />
              </div>
            </div>
            <div className="input-group full-width form-row-split reverse">
              <div className="input-group">
                <label>Postleitzahl *</label>
                <input type="text" name="plz" placeholder="PLZ" required value={vm.gastData.plz} onChange={vm.handleGastChange} />
              </div>
              <div className="input-group">
                <label>Stadt *</label>
                <input type="text" name="stadt" placeholder="Stadt" required value={vm.gastData.stadt} onChange={vm.handleGastChange} />
              </div>
            </div>

            <CountryDropdown value={vm.gastData.land} onChange={(land) => vm.setGastData({ ...vm.gastData, land })} />
            
            {vm.istHauptobjektWohnung && (
              <div className="input-group full-width radio-section">
                <label>Möchten Sie den Bus dazu anfragen?</label>
                <div className="radio-options">
                  <label className={!vm.zusatzobjektVerfuegbar ? "radio-label-disabled" : ""}>
                    <input
                      type="radio"
                      name="zusatzobjektMieten"
                      value="Ja"
                      checked={vm.bookingDetails.zusatzobjektMieten === "Ja" && vm.zusatzobjektVerfuegbar}
                      disabled={!vm.zusatzobjektVerfuegbar}
                      onChange={(e) =>
                        vm.setBookingDetails({
                          ...vm.bookingDetails,
                          zusatzobjektMieten: e.target.value,
                        })
                      }
                    />{" "}
                    Ja
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="zusatzobjektMieten"
                      value="Nein"
                      checked={vm.bookingDetails.zusatzobjektMieten === "Nein" || !vm.zusatzobjektVerfuegbar}
                      onChange={(e) =>
                        vm.setBookingDetails({
                          ...vm.bookingDetails,
                          zusatzobjektMieten: e.target.value,
                        })
                      }
                    />{" "}
                    Nein
                  </label>
                  <p
                    style={{
                      fontSize: "12px",
                      color: vm.zusatzobjektVerfuegbar ? "#22c55e" : "#ef4444",
                      fontWeight: "600",
                    }}
                  >
                    {vm.zusatzobjektVerfuegbar
                      ? "✓ Bus ist im gewählten Zeitraum verfügbar (inkl. Kombi-Rabatt)."
                      : "✕ Kein Bus in diesem Zeitraum verfügbar."}
                  </p>
                </div>
                {vm.bookingDetails.zusatzobjektMieten === "Ja" && vm.zusatzobjektVerfuegbar && (
                  <p className="radio-section-note" style={{ fontSize: "12px", color: "#71717a" }}>
                    {vm.zugewiesenesZusatzobjekt?.name} steht dem Gast im Zeitraum der Wohnungsbuchung zur
                    Verfügung (Abholung {einstellungen.checkin_zeit} Uhr am Anreisetag, Rückgabe {einstellungen.checkout_zeit} Uhr am Abreisetag)
                    {vm.ZUSATZOBJEKT_KOMBI_RABATT_PROZENT > 0
                      ? ` - inklusive ${vm.ZUSATZOBJEKT_KOMBI_RABATT_PROZENT}% Kombi-Rabatt auf den Zusatz-Anteil.`
                      : "."}
                  </p>
                )}
              </div>
            )}

            <div className="input-group full-width">
              <label>Nachricht (optional)</label>
              <textarea placeholder="Besondere Wünsche, Fragen, ..." value={vm.nachricht} onChange={(e) => vm.setNachricht(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="wizard-actions" style={{ marginTop: "16px" }}>
          <button type="button" className="btn-outline btn-outline--lg" onClick={() => vm.setWizardStep(1)}>
            Zurück
          </button>
          <button type="submit" className="btn-primary" disabled={vm.istAnfrageUngueltig || vm.isSaving}>
            {vm.isSaving ? "Wird gesendet..." : "Anfrage senden"}
          </button>
        </div>
      </form>

      {/* ERFOLGS- UND FEHLER-MODAL */}
      {(vm.wurdeGesendet || vm.sendError) && (
        <div className="modal-backdrop">
          <div className="modal-content form-card" style={{ maxWidth: "480px", textAlign: "center", padding: "40px 24px" }}>
            {vm.wurdeGesendet ? (
              <>
                <div className="anfrage-success-icon">✓</div>
                <h3 style={{ marginBottom: "8px" }}>Anfrage wurde übermittelt</h3>
                <p style={{ color: "#71717a", fontSize: "14px", margin: "0 auto 24px auto", lineHeight: "1.5" }}>
                  Vielen Dank! Wir haben Ihre Anfrage erhalten und melden uns in Kürze bei Ihnen unter <strong>{vm.gastData.email}</strong>.
                </p>
                <div className="wizard-actions" style={{ justifyContent: "center", marginTop: 0 }}>
                  <button type="button" className="btn-primary" onClick={vm.handleNeueAnfrage}>
                    Weitere Anfrage stellen
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="anfrage-error-icon">✕</div>
                <h3 style={{ marginBottom: "8px" }}>Übermittlung fehlgeschlagen</h3>
                <p style={{ color: "#71717a", fontSize: "14px", margin: "0 auto 24px auto", lineHeight: "1.5" }}>
                  Leider konnten wir Ihre Anfrage nicht übermitteln. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt unter <strong>office@beckhoff-verwaltung.at</strong>.
                </p>
                <div className="wizard-actions" style={{ justifyContent: "center", marginTop: 0 }}>
                  <button type="button" className="btn-outline" onClick={() => vm.setSendError(false)}>
                    Schließen
                  </button>
                  <button type="button" className="btn-primary" onClick={vm.handleSubmitAnfrage} disabled={vm.isSaving}>
                    {vm.isSaving ? "Wird gesendet..." : "Erneut versuchen"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}