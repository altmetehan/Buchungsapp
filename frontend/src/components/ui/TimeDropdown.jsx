import { useState, useRef, useEffect, useMemo } from "react";
import "../../styles/shared-ui.css";

/**
 * TimeDropdown
 * ------------
 * Uhrzeit-Auswahlfeld im selben Look wie CountryDropdown.
 *
 * @param {object} props
 * @param {string} props.value - aktuell gewählte Zeit "HH:MM", oder ""
 * @param {(zeit: string) => void} props.onChange
 * @param {string} [props.label]
 * @param {boolean} [props.required]
 * @param {boolean} [props.disabled]
 * @param {string} [props.minTime] - "HH:MM", Standard "00:00"
 * @param {string} [props.maxTime] - "HH:MM", Standard "23:59"
 * @param {number} [props.stepMinutes] - Rasterung der Liste, Standard 30
 * @param {boolean} [props.exclusiveMin] - Wenn true, wird minTime selbst ausgeschlossen (erstes Element = minTime + stepMinutes)
 * @returns {JSX.Element}
 */
export function TimeDropdown({
  value,
  onChange,
  label = "Uhrzeit",
  required = true,
  disabled = false,
  minTime = "00:00",
  maxTime = "23:59",
  stepMinutes = 30,
  exclusiveMin = false, // <-- NEU: schließt minTime selbst aus (für Rückgabezeit)
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.querySelector(".select-dropdown-item.active")?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen]);

  const zeiten = useMemo(() => {
    if (!minTime) return [];
    const [minH, minM] = minTime.split(":").map(Number);
    const [maxH, maxM] = maxTime.split(":").map(Number);

    // Wenn exclusiveMin true ist, starten wir 30 Minuten NACH minTime
    let startMinuten = minH * 60 + minM;
    if (exclusiveMin) {
      startMinuten += stepMinutes;
    }
    const endMinuten = maxH * 60 + maxM;

    const liste = [];
    for (let m = startMinuten; m <= endMinuten; m += stepMinutes) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      liste.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }

    return liste;
  }, [minTime, maxTime, stepMinutes, exclusiveMin]);

  const waehleZeit = (zeit) => {
    onChange(zeit);
    setIsOpen(false);
  };

  return (
    <div className="input-group" style={{ position: "relative" }} ref={dropdownRef}>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <div
        className="select-dropdown-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      >
        <span>{value ? `${value} Uhr` : "Bitte wählen..."}</span>
        <span className="arrow-down">▼</span>
      </div>

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

      {isOpen && !disabled && (
        <div className="select-dropdown-popup">
          <div className="select-dropdown-list" ref={listRef}>
            {zeiten.map((zeit) => (
              <div
                key={zeit}
                className={`select-dropdown-item ${value === zeit ? "active" : ""}`}
                onClick={() => waehleZeit(zeit)}
              >
                {zeit} Uhr
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}