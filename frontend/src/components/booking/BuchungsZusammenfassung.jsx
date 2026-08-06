import { useState, useRef, useEffect } from "react";
import { ZeitraumKalender } from "./ZeitraumKalender";
import { GuestCountModal } from "./GuestCountModal";
import { formatDe, istWohnung } from "../../utils/javaUtils";
import "../../styles/shared-ui.css";

/**
 * BuchungsZusammenfassung
 * ------------------------
 * Die editierbare Zusammenfassungs-Leiste, die in Schritt 2 & 3 des
 * Buchungs-Assistenten über dem eigentlichen Formular sitzt: Objekt,
 * Zeitraum und Gästezahl lassen sich hier direkt per Klick ändern,
 * ohne zurück auf Schritt 1 zu müssen. Zeigt außerdem eine Warnung an,
 * falls das gewählte Objekt im aktuellen Zeitraum nicht mehr
 * verfügbar ist (z.B. weil der Zeitraum nachträglich geändert wurde).
 *
 * @param {object} props
 * @param {object} props.selectedObjekt
 * @param {(obj: object) => void} props.onSelectObjekt
 * @param {{start: Date|null, end: Date|null}} props.dateRange
 * @param {Function} props.onDateClick
 * @param {Date|null} props.hoveredDate
 * @param {Function} props.onHoverChange
 * @param {Function} props.onClearSelection
 * @param {number} props.naechteAnz
 * @param {string} props.startISO
 * @param {string} props.endISO
 * @param {object[]} props.objektStammdaten
 * @param {Function} props.istVerfuegbar
 * @param {boolean} props.selectedObjektVerfuegbar
 * @param {number} props.gesamtpreis
 * @param {{erwachsene: number, kinder: number}} props.guestCounts
 * @param {Function} props.onGuestCountsChange
 * @param {number|null} [props.stundenAnz] - bei stundenbasierten Objekten die Gesamtdauer in Stunden statt Nächten
 * @param {string|null} [props.kollisionsText] - individueller Warntext bei Kollision (sonst Standardtext)
 * @returns {JSX.Element}
 */
export function BuchungsZusammenfassung({
  selectedObjekt,
  onSelectObjekt,
  dateRange,
  onDateClick,
  hoveredDate,
  onHoverChange,
  onClearSelection,
  naechteAnz,
  startISO,
  endISO,
  objektStammdaten,
  istVerfuegbar,
  selectedObjektVerfuegbar,
  gesamtpreis,
  guestCounts,
  onGuestCountsChange,
  stundenAnz = null,
  kollisionsText = null,
}) {
  const [isObjektDropdownOpen, setIsObjektDropdownOpen] = useState(false);
  const [isZeitraumEditorOpen, setIsZeitraumEditorOpen] = useState(false);
  const [isGuestPopupOpen, setIsGuestPopupOpen] = useState(false);
  const objektDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (isObjektDropdownOpen && objektDropdownRef.current && !objektDropdownRef.current.contains(event.target)) {
        setIsObjektDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isObjektDropdownOpen]);

  return (
    <>
      <div className="booking-summary-bar">
        {/* Feld 1: Objekt */}
        <div className="summary-field-wrapper" ref={objektDropdownRef}>
          <button
            type="button"
            className={`summary-field ${!selectedObjektVerfuegbar ? "summary-field--warning" : ""}`}
            onClick={() => setIsObjektDropdownOpen(!isObjektDropdownOpen)}
          >
            <strong>
              {selectedObjekt?.name} <span className="summary-field-edit-hint">Ändern</span>
            </strong>
            <p style={{ fontSize: "12px", color: !selectedObjektVerfuegbar ? "#ef4444" : "#71717a" }}>
              {!selectedObjektVerfuegbar ? "⚠ Nicht verfügbar" : selectedObjekt?.details}
            </p>
          </button>
          {isObjektDropdownOpen && (
            <div className="select-dropdown-popup summary-dropdown-popup">
              <div className="select-dropdown-list">
                {objektStammdaten.map((obj) => {
                  const ist0Naechte = naechteAnz === 0;
                  const verfuegbarInDb = istVerfuegbar(obj.name, startISO, endISO);

                  const verfuegbar =
                    obj.id === selectedObjekt?.id || (istWohnung(obj.name) && ist0Naechte ? false : verfuegbarInDb);
                  const zeigeBelegtText = obj.id !== selectedObjekt?.id && !verfuegbarInDb;

                  return (
                    <div
                      key={obj.id}
                      className={`select-dropdown-item ${selectedObjekt?.id === obj.id ? "active" : ""} ${!verfuegbar ? "radio-label-disabled" : ""}`}
                      onClick={() => {
                        if (verfuegbar) {
                          onSelectObjekt(obj);
                          setIsObjektDropdownOpen(false);
                        }
                      }}
                    >
                      {obj.name}
                      {zeigeBelegtText && " (im Zeitraum belegt)"}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Feld 2: Zeitraum */}
        <button type="button" className="summary-field" onClick={() => setIsZeitraumEditorOpen(true)}>
          <strong>
            {formatDe(dateRange.start)} - {formatDe(dateRange.end)} <span className="summary-field-edit-hint">Ändern</span>
          </strong>
          <p style={{ fontSize: "12px", color: "#71717a" }}>
            {stundenAnz != null
              ? `${stundenAnz.toFixed(1)} Std.`
              : `${naechteAnz} ${naechteAnz === 1 ? "Nacht" : "Nächte"}`}
          </p>
        </button>

        {/* Feld 3: Gästeanzahl - nur bei Wohnungen relevant */}
        {istWohnung(selectedObjekt?.name) ? (
          <button type="button" className="summary-field" onClick={() => setIsGuestPopupOpen(true)}>
            <strong>
              {guestCounts.erwachsene} Erwachsene <span className="summary-field-edit-hint">Ändern</span>
            </strong>
            <p style={{ fontSize: "12px", color: "#71717a" }}>{guestCounts.kinder} Kinder</p>
          </button>
        ) : (
          <div className="summary-field" style={{ fontStyle: "italic" }}>
            <strong style={{ opacity: "0.5" }}>Gäste</strong>
            <p style={{ fontSize: "12px", color: "#71717a" }}>Die Gästeanzahl ist bei diesem Objekt irrelevant.</p>
          </div>
        )}

        {/* Feld 4: Gesamtpreis */}
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "12px", color: "#71717a" }}>Gesamtpreis</span>
          <h3 style={{ color: "#e30000" }}>€ {gesamtpreis.toFixed(2).replace(".", ",")}</h3>
        </div>
      </div>

      {!selectedObjektVerfuegbar && istWohnung(selectedObjekt?.name) && (
        <div className="summary-warning-banner">
          {kollisionsText || `⚠ ${selectedObjekt?.name} ist im gewählten Zeitraum bereits belegt.`}
        </div>
      )}

      {isZeitraumEditorOpen && (
        <div className="modal-backdrop">
          <div className="modal-content form-card" style={{ maxWidth: "420px" }}>
            <h3 style={{ marginBottom: "16px" }}>Zeitraum ändern</h3>
            <ZeitraumKalender
              dateRange={dateRange}
              onDateClick={onDateClick}
              hoveredDate={hoveredDate}
              onHoverChange={onHoverChange}
              onClearSelection={onClearSelection}
            />
            <div className="wizard-actions" style={{ marginTop: "20px" }}>
              <button type="button" className="btn-primary" onClick={() => setIsZeitraumEditorOpen(false)}>
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      <GuestCountModal
        isOpen={isGuestPopupOpen}
        initialAdults={guestCounts.erwachsene}
        initialChildren={guestCounts.kinder}
        onClose={() => setIsGuestPopupOpen(false)}
        onConfirm={(erwachsene, kinder) => {
          onGuestCountsChange(erwachsene, kinder);
          setIsGuestPopupOpen(false);
        }}
      />
    </>
  );
}