import { useState, useRef, useEffect, useMemo } from "react";
import "../../styles/datedropdown.css";

/**
 * DateDropdown
 * ------------
 * Datums-Auswahlfeld im selben Look wie TimeDropdown / CountryDropdown
 * (gleiche Trigger-/Popup-Klassen aus shared-ui.css) - ersetzt das
 * native <input type="date">.
 *
 * @param {object} props
 * @param {string} props.value - aktuell gewähltes Datum im ISO-Format "YYYY-MM-DD"
 * @param {(isoDate: string) => void} props.onChange
 * @param {string} [props.label]
 * @param {boolean} [props.required]
 * @param {boolean} [props.disabled]
 * @param {string} [props.minDate] - Mindestdatum "YYYY-MM-DD"
 * @param {string} [props.maxDate] - Höchstdatum "YYYY-MM-DD"
 */
export function DateDropdown({
  value,
  onChange,
  label = "Datum",
  required = true,
  disabled = false,
  minDate,
  maxDate,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  useEffect(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      if (y && m) setViewDate(new Date(y, m - 1, 1));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayFormatted = useMemo(() => {
    if (!value) return "";
    const [y, m, d] = value.split("-");
    if (!y || !m || !d) return value;
    return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
  }, [value]);

  const changeMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalDays = lastDay.getDate();
    const days = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        isoStr: "",
        disabled: true,
      });
    }

    for (let d = 1; d <= totalDays; d++) {
      const monthStr = String(month + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const iso = `${year}-${monthStr}-${dayStr}`;

      let isDisabled = false;
      if (minDate && iso < minDate) isDisabled = true;
      if (maxDate && iso > maxDate) isDisabled = true;

      days.push({
        day: d,
        isCurrentMonth: true,
        isoStr: iso,
        disabled: isDisabled,
        isSelected: iso === value,
      });
    }

    return days;
  }, [viewDate, minDate, maxDate, value]);

  const monatsNamen = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  const selectDay = (dayObj) => {
    if (dayObj.disabled || !dayObj.isCurrentMonth) return;
    onChange(dayObj.isoStr);
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
        <span>{displayFormatted || "Bitte wählen..."}</span>
        <span className="arrow-down" style={{ fontSize: "14px" }}>📅</span>
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
        <div className="select-dropdown-popup date-dropdown-popup">
          <div className="date-dropdown-header">
            <button
              type="button"
              className="btn-outline"
              style={{ padding: "2px 8px", minWidth: "auto" }}
              onClick={() => changeMonth(-1)}
            >
              &lt;
            </button>
            <span className="date-dropdown-header-title">
              {monatsNamen[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              className="btn-outline"
              style={{ padding: "2px 8px", minWidth: "auto" }}
              onClick={() => changeMonth(1)}
            >
              &gt;
            </button>
          </div>

          <div className="date-dropdown-weekdays">
            <div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div>
          </div>

          <div className="date-dropdown-grid">
            {calendarDays.map((d, index) => {
              const classNames = ["date-dropdown-day"];
              if (!d.isCurrentMonth) classNames.push("other-month");
              if (d.disabled) classNames.push("disabled");
              if (d.isSelected) classNames.push("selected");

              return (
                <div
                  key={index}
                  className={classNames.join(" ")}
                  onClick={() => selectDay(d)}
                >
                  {d.day}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}