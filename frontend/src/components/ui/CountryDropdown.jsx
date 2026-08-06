import { useState, useRef, useEffect, useMemo } from "react";
import { laender } from "../laender.js";
import "../../styles/shared-ui.css";

/**
 * CountryDropdown
 * ----------------
 * Durchsuchbares Länder-Auswahlfeld. Österreich/Deutschland/Schweiz
 * stehen immer oben (häufigste Fälle), der Rest ist alphabetisch
 * sortiert und wird live nach der Sucheingabe gefiltert.
 *
 * Gemeinsame Komponente für Buchen.jsx und Gaeste.jsx - beide Seiten
 * verwenden sie einfach mit ihrem eigenen "value"/"onChange".
 *
 * Props:
 * - value:     der aktuell ausgewählte Ländername (String)
 * - onChange:  (land: string) => void - wird bei Auswahl aufgerufen
 * - label:     Beschriftung über dem Feld (Standard: "Land")
 * - required:  ob das Feld für die native HTML5-Formularvalidierung als
 *              Pflichtfeld gelten soll (Standard: true)
 */
export function CountryDropdown({ value, onChange, label = "Land", required = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  // Schließt das Dropdown, sobald irgendwo außerhalb des Feldes geklickt wird
  useEffect(() => {
    function handleClickOutside(event) {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  /** Angeheftete Länder zuerst, Rest alphabetisch, dann nach Suchbegriff gefiltert. */
  const sortierteLaender = useMemo(() => {
    const angeheftet = ["Österreich", "Deutschland", "Schweiz"];
    const rest = laender
      .filter((l) => !angeheftet.includes(l))
      .sort((a, b) => a.localeCompare(b, "de"));
    const zusammengefuegt = [...angeheftet, ...rest];
    return searchQuery
      ? zusammengefuegt.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase()))
      : zusammengefuegt;
  }, [searchQuery]);

  const waehleLand = (land) => {
    onChange(land);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="input-group full-width" style={{ position: "relative" }} ref={dropdownRef}>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <div className="select-dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span>{value || "Bitte wählen..."}</span>
        <span className="arrow-down">▼</span>
      </div>

      {/* Unsichtbares Pflichtfeld, damit die native HTML5-Validierung
          ("Bitte füllen Sie dieses Feld aus") auch für dieses
          Custom-Dropdown greift, obwohl es kein echtes <select> ist. */}
      {required && (
        <input
          type="text"
          value={value}
          required
          onChange={() => {}}
          tabIndex={-1}
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            width: "1px",
            height: "1px",
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      )}

      {isOpen && (
        <div className="select-dropdown-popup">
          <input
            type="text"
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="select-dropdown-search"
          />
          <div className="select-dropdown-list">
            <div
              className="select-dropdown-item"
              style={{ color: "#71717a", borderBottom: "1px solid #e4e4e7", fontWeight: "600" }}
              onClick={() => waehleLand("")}
            >
              — Auswahl aufheben —
            </div>
            {sortierteLaender.map((l) => (
              <div
                key={l}
                className={`select-dropdown-item ${value === l ? "active" : ""}`}
                onClick={() => waehleLand(l)}
              >
                {l}
              </div>
            ))}
            {sortierteLaender.length === 0 && (
              <div className="select-dropdown-empty">Keine Treffer</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}