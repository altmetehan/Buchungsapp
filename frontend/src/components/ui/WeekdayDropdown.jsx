import { useState, useRef, useEffect, useMemo } from "react";
import "../../styles/shared-ui.css";

/**
 * @file WeekdayDropdown.jsx
 * @description Custom Wochentags-Auswahlfeld im einheitlichen UI-Design (wie TimeDropdown / CountryDropdown).
 * @module components/ui/WeekdayDropdown
 */

const WOCHENTAG_OPTIONEN = [
  { value: "", label: "Keine Einschränkung (Beliebig)" },
  { value: "Montag", label: "Montag" },
  { value: "Dienstag", label: "Dienstag" },
  { value: "Mittwoch", label: "Mittwoch" },
  { value: "Donnerstag", label: "Donnerstag" },
  { value: "Freitag", label: "Freitag" },
  { value: "Samstag", label: "Samstag" },
  { value: "Sonntag", label: "Sonntag" },
];

/**
 * @param {Object} props
 * @param {string} props.value - Aktuell gewählter Wochentag ("Montag", ... oder "")
 * @param {(wochentag: string) => void} props.onChange - Callback bei Auswahl
 * @param {string} [props.label] - Beschriftung
 * @param {boolean} [props.required] - Pflichtfeld-Kennzeichnung
 * @param {boolean} [props.disabled] - Deaktivierter Zustand
 * @param {string} [props.hint] - Optionaler Hilfetext unterhalb des Felds
 */
export function WeekdayDropdown({
  value,
  onChange,
  label = "Wochentag",
  required = false,
  disabled = false,
  hint,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Schließt das Dropdown bei Klick außerhalb
  useEffect(() => {
    function handleClickOutside(event) {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedOption = useMemo(() => {
    return WOCHENTAG_OPTIONEN.find((opt) => opt.value === value) || WOCHENTAG_OPTIONEN[0];
  }, [value]);

  const waehleWochentag = (val) => {
    onChange(val);
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
        <span>{selectedOption.label}</span>
        <span className="arrow-down">▼</span>
      </div>

      {hint && (
        <span style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
          {hint}
        </span>
      )}

      {isOpen && !disabled && (
        <div className="select-dropdown-popup">
          <div className="select-dropdown-list" style={{ maxHeight: "none"}}>
            {WOCHENTAG_OPTIONEN.map((opt) => (
              <div
                key={opt.value}
                className={`select-dropdown-item ${value === opt.value ? "active" : ""}`}
                onClick={() => waehleWochentag(opt.value)}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WeekdayDropdown;