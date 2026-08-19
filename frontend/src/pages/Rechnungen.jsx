import { useState, useEffect, useMemo, useRef } from "react";
import "../styles/shared-ui.css";
import "../styles/pageStyles/Rechnungen.css";
import { Toast } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { parseGermanDate } from "../utils/javaUtils";

/**
 * @file Rechnungen.jsx
 * @description Rechnungsverwaltung und Archiv. Bietet Monats- und Jahresfilter,
 *              Umsatzstatistiken, manuelle Rechnungserstellung zu bestehenden Buchungen,
 *              Preisanpassungen inklusive Begründungshistorie sowie PDF-Downloads.
 * @module pages/Rechnungen
 */

const RECHNUNGEN_API = "/api/rechnungen";
const BUCHUNGEN_API = "/api/buchungen";

/** Formatiert eine Zahl als Euro-Währung */
const formatEuro = (zahl) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(zahl || 0);

/** Formatiert einen ISO-Zeitstempel */
const formatZeitstempel = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.toLocaleDateString("de-DE")}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
};

/**
 * Rechnungen-Seitenkomponente.
 *
 * @component
 * @returns {JSX.Element} Die gerenderte Rechnungsansicht.
 */
export function Rechnungen() {
  const [rechnungenRaw, setRechnungenRaw] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { toast, showToast, dismissToast } = useToast();

  useEffect(() => {
    async function ladeDaten() {
      try {
        setApiLoading(true);
        const [rechnungenRes, buchungenRes] = await Promise.all([
          fetch(RECHNUNGEN_API),
          fetch(BUCHUNGEN_API),
        ]);
        if (!rechnungenRes.ok || !buchungenRes.ok) {
          throw new Error("Server antwortete mit einem Fehlerstatus");
        }
        setRechnungenRaw(await rechnungenRes.json());
        setBookings(await buchungenRes.json());
        setApiError(null);
      } catch (err) {
        console.error("Rechnungen: Fehler beim Laden vom Backend:", err);
        setApiError(
          "Backend nicht erreichbar. Läuft der Server (node src/server.js im backend-Ordner)?",
        );
      } finally {
        setApiLoading(false);
      }
    }

    ladeDaten();
  }, []);

  /**
   * Normalisiert die rohen Rechnungsdaten und verknüpft sie mit Gast- und Preisanpassungshistorien.
   */
  const invoices = useMemo(() => {
    return rechnungenRaw.map((r) => {
      const buchung = r.Buchungen;
      const anreiseDate = parseGermanDate(buchung?.anreise);
      const abreiseDate = parseGermanDate(buchung?.abreise);
      const zeitDiff = Math.abs(abreiseDate - anreiseDate);
      const naechte = Math.ceil(zeitDiff / (1000 * 60 * 60 * 24));

      const gesamt =
        buchung?.preis !== null && buchung?.preis !== undefined
          ? buchung.preis
          : naechte * (buchung?.Objekte?.preis || 0);

      const objektAnzeige = buchung?.Objekte?.name
        ? `${buchung.Objekte.name}${buchung?.ObjekteZusatz ? " + " + buchung.ObjekteZusatz.name : ""}`
        : "Unbekanntes Objekt";

      return {
        id: r.id,
        buchungId: r.buchung_id,
        rnr: r.rechnungs_nummer,
        datum: r.rechnungs_datum,
        gast: buchung?.Gaeste?.name || "Unbekannter Gast",
        objekt: objektAnzeige,
        betrag: formatEuro(gesamt),
        buchungPreisRoh: gesamt,
        preisanpassungen: buchung?.Preisanpassungen || [],
      };
    });
  }, [rechnungenRaw]);

  const buchungIdsMitRechnung = useMemo(
    () => new Set(rechnungenRaw.map((r) => r.buchung_id)),
    [rechnungenRaw],
  );

  const verfuegbareBuchungen = useMemo(
    () => bookings.filter((b) => !buchungIdsMitRechnung.has(b.id)),
    [bookings, buchungIdsMitRechnung],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const aktuellesDatum = new Date();

  const [selectedMonth, setSelectedMonth] = useState(aktuellesDatum.getMonth());
  const [selectedYear, setSelectedYear] = useState(aktuellesDatum.getFullYear());

  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isBookingDropdownOpen, setIsBookingDropdownOpen] = useState(false);

  const monthDropdownRef = useRef(null);
  const yearDropdownRef = useRef(null);
  const bookingDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        isMonthDropdownOpen &&
        monthDropdownRef.current &&
        !monthDropdownRef.current.contains(event.target)
      ) {
        setIsMonthDropdownOpen(false);
      }
      if (
        isYearDropdownOpen &&
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(event.target)
      ) {
        setIsYearDropdownOpen(false);
      }
      if (
        isBookingDropdownOpen &&
        bookingDropdownRef.current &&
        !bookingDropdownRef.current.contains(event.target)
      ) {
        setIsBookingDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMonthDropdownOpen, isYearDropdownOpen, isBookingDropdownOpen]);

  const monate = [
    { value: 0, label: "Januar" },
    { value: 1, label: "Februar" },
    { value: 2, label: "März" },
    { value: 3, label: "April" },
    { value: 4, label: "Mai" },
    { value: 5, label: "Juni" },
    { value: 6, label: "Juli" },
    { value: 7, label: "August" },
    { value: 8, label: "September" },
    { value: 9, label: "Oktober" },
    { value: 10, label: "November" },
    { value: 11, label: "Dezember" },
  ];

  const jahre = [2026, 2027, 2028, 2029, 2030, 2031];
  const monatName = monate.find((m) => m.value === selectedMonth)?.label || "";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    buchungId: "",
    rechnungsDatum: "",
  });

  const [preisForm, setPreisForm] = useState({
    basisPreis: 0,
    rabattProzent: "0",
    endbetrag: "0",
    grund: "",
  });

  const handleOpenCreateModal = () => {
    setEditingInvoice(null);
    setInvoiceForm({ buchungId: "", rechnungsDatum: "" });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rechnung) => {
    setEditingInvoice(rechnung);
    setInvoiceForm({
      buchungId: rechnung.buchungId,
      rechnungsDatum: rechnung.datum,
    });
    setPreisForm({
      basisPreis: rechnung.buchungPreisRoh,
      rabattProzent: "0",
      endbetrag: rechnung.buchungPreisRoh.toFixed(2),
      grund: "",
    });
    setIsModalOpen(true);
  };

  const handleRabattChange = (e) => {
    const rawVal = e.target.value;
    if (rawVal === "") {
      setPreisForm((prev) => ({ ...prev, rabattProzent: "", endbetrag: prev.basisPreis.toFixed(2) }));
      return;
    }

    let num = parseFloat(rawVal.replace(",", "."));
    if (isNaN(num)) return;

    num = Math.min(100, num);
    const neuerBetrag = Math.max(0, preisForm.basisPreis * (1 - num / 100));

    setPreisForm((prev) => ({
      ...prev,
      rabattProzent: num.toString(),
      endbetrag: (Math.round(neuerBetrag * 100) / 100).toFixed(2),
    }));
  };

  const handleEndbetragChange = (e) => {
    const rawVal = e.target.value;
    const neuerBetrag = parseFloat(rawVal.replace(",", "."));

    let berechneterRabatt = "0";
    if (!isNaN(neuerBetrag) && preisForm.basisPreis > 0) {
      const r = ((preisForm.basisPreis - neuerBetrag) / preisForm.basisPreis) * 100;
      berechneterRabatt = r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
    }

    setPreisForm((prev) => ({ ...prev, endbetrag: rawVal, rabattProzent: berechneterRabatt }));
  };

  const preisWurdeGeaendert =
    editingInvoice != null &&
    !isNaN(parseFloat(preisForm.endbetrag)) &&
    Math.round(parseFloat(preisForm.endbetrag) * 100) !== Math.round(preisForm.basisPreis * 100);

  /**
   * Speichert Rechnungsdaten und führt bei Bedarf eine Preisanpassung durch.
   *
   * @async
   * @function
   * @param {React.FormEvent<HTMLFormElement>} e - Submit-Event.
   * @returns {Promise<void>}
   */
  const handleSaveInvoice = async (e) => {
    e.preventDefault();

    if (!editingInvoice && !invoiceForm.buchungId) {
      return showToast("error", "Bitte eine Buchung für diese Rechnung auswählen.");
    }
    if (preisWurdeGeaendert && !preisForm.grund.trim()) {
      return showToast("error", "Bitte eine Begründung für die Preisänderung angeben.");
    }

    setIsSaving(true);
    try {
      if (editingInvoice) {
        if (preisWurdeGeaendert) {
          const anpassungRes = await fetch(
            `${BUCHUNGEN_API}/${editingInvoice.buchungId}/preisanpassungen`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                neuer_betrag: parseFloat(preisForm.endbetrag.toString().replace(",", ".")),
                grund: preisForm.grund.trim(),
              }),
            },
          );
          if (!anpassungRes.ok) throw new Error("Preisanpassung konnte nicht gespeichert werden");
        }

        const response = await fetch(`${RECHNUNGEN_API}/${editingInvoice.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rechnungs_datum: invoiceForm.rechnungsDatum,
          }),
        });
        if (!response.ok) throw new Error("Aktualisieren fehlgeschlagen");
        const aktualisiert = await response.json();

        setRechnungenRaw(
          rechnungenRaw.map((r) => (r.id === editingInvoice.id ? aktualisiert : r)),
        );

        if (preisWurdeGeaendert) {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === editingInvoice.buchungId ? { ...b, preis: parseFloat(preisForm.endbetrag) } : b,
            ),
          );
        }
        showToast("success", `Rechnung ${editingInvoice.rnr} wurde erfolgreich aktualisiert.`);
      } else {
        const response = await fetch(RECHNUNGEN_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buchung_id: Number(invoiceForm.buchungId),
            rechnungs_datum: invoiceForm.rechnungsDatum,
          }),
        });
        if (!response.ok) throw new Error("Erstellen fehlgeschlagen");
        const neueRechnung = await response.json();

        setRechnungenRaw([neueRechnung, ...rechnungenRaw]);
        showToast("success", `Neue Rechnung für Buchung #${invoiceForm.buchungId} wurde erstellt.`);
      }

      setIsModalOpen(false);
      setEditingInvoice(null);
    } catch (err) {
      console.error("Rechnungen: Fehler beim Speichern:", err);
      showToast("error", "Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  };

  const parseBetrag = (betragStr) => {
    if (!betragStr) return 0;
    const clean = betragStr.replace(/[^0-9,]/g, "").replace(",", ".");
    return parseFloat(clean) || 0;
  };

  const istImAusgewaehltenMonat = (datumStr) => {
    const [, m, y] = datumStr.split(".");
    const targetMonthNum = (selectedMonth + 1).toString().padStart(2, "0");
    const targetYearStr = selectedYear.toString();
    return m === targetMonthNum && y === targetYearStr;
  };

  const rechnungenImAusgewaehltenMonat = invoices.filter((r) =>
    istImAusgewaehltenMonat(r.datum),
  );
  const anzahlMonat = rechnungenImAusgewaehltenMonat.length;

  const summeMonatRaw = rechnungenImAusgewaehltenMonat.reduce(
    (sum, r) => sum + parseBetrag(r.betrag),
    0,
  );
  const summeMonatFormatiert = formatEuro(summeMonatRaw);

  const filteredRechnungen = invoices.filter((res) => {
    if (searchQuery.trim() === "") {
      return istImAusgewaehltenMonat(res.datum);
    }

    const searchWords = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const rnrDarfMitsuchen = searchWords.length === 1;

    const textFelder = [res.gast, res.objekt];
    if (rnrDarfMitsuchen) textFelder.push(res.rnr);

    const durchsuchbarerText = textFelder.filter(Boolean).join(" ").toLowerCase();
    return searchWords.every((word) => durchsuchbarerText.includes(word));
  });

  const gewaehlteBuchung = useMemo(
    () => bookings.find((b) => b.id === Number(invoiceForm.buchungId)),
    [bookings, invoiceForm.buchungId],
  );

  if (apiLoading) return <div style={{ padding: "24px" }}>Lade Rechnungen vom Server...</div>;
  if (apiError) return <div style={{ padding: "24px", color: "#e30000" }}>{apiError}</div>;

  return (
    <div className="rechnungen-container">
      <Toast toast={toast} onClose={dismissToast} />
      <div className="page-header">
        <div className="header-text">
          <h2>Rechnungen</h2>
          <p className="subtitle">
            Übersicht über alle Rechnungen. Rechnungen werden bei einer Buchung automatisch erstellt – 
            über den Button „+ Rechnung erstellen“ kann eine Rechnung bei Bedarf manuell für eine bestehende Buchung nacherzeugt
            werden. Die jeweilige Rechnung kann jederzeit als PDF heruntergeladen werden.          
          </p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreateModal}>
          + Rechnung erstellen
        </button>
      </div>

      <div className="stats-container">
        <div className="stats-item">
          <span className="stats-label">
            Anzahl Rechnungen {monatName} {selectedYear}
          </span>
          <span className="stats-value">{anzahlMonat}</span>
        </div>
        <div className="stats-item">
          <span className="stats-label">
            Summe Rechnungen {monatName} {selectedYear}
          </span>
          <span className="stats-value">{summeMonatFormatiert}</span>
        </div>
      </div>

      <div
        className="filter-bar"
        style={{ display: "flex", gap: "8px", alignItems: "center" }}
      >
        <input
          type="text"
          placeholder="Suche nach Rechnungsnummer, Name oder Apartment ..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flexGrow: 1 }}
        />

        {!searchQuery.trim() && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ position: "relative" }} ref={monthDropdownRef}>
              <div
                className="select-dropdown-trigger"
                onClick={() => {
                  setIsMonthDropdownOpen(!isMonthDropdownOpen);
                  setIsYearDropdownOpen(false);
                }}
                style={{ minWidth: "140px" }}
              >
                <span>{monatName}</span>
                <span className="arrow-down">▼</span>
              </div>

              {isMonthDropdownOpen && (
                <div
                  className="select-dropdown-popup"
                  style={{ top: "52px", left: "auto", right: 0 }}
                >
                  <div className="select-dropdown-list">
                    {monate.map((m) => (
                      <div
                        key={m.value}
                        className={`select-dropdown-item ${selectedMonth === m.value ? "active" : ""}`}
                        onClick={() => {
                          setSelectedMonth(m.value);
                          setIsMonthDropdownOpen(false);
                        }}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: "relative" }} ref={yearDropdownRef}>
              <div
                className="select-dropdown-trigger"
                onClick={() => {
                  setIsYearDropdownOpen(!isYearDropdownOpen);
                  setIsMonthDropdownOpen(false);
                }}
                style={{ minWidth: "100px" }}
              >
                <span>{selectedYear}</span>
                <span className="arrow-down">▼</span>
              </div>

              {isYearDropdownOpen && (
                <div
                  className="select-dropdown-popup"
                  style={{ top: "52px", left: "auto", right: 0 }}
                >
                  <div className="select-dropdown-list">
                    {jahre.map((y) => (
                      <div
                        key={y}
                        className={`select-dropdown-item ${selectedYear === y ? "active" : ""}`}
                        onClick={() => {
                          setSelectedYear(y);
                          setIsYearDropdownOpen(false);
                        }}
                      >
                        {y}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="rechnungen-table-title">
        {searchQuery === ""
          ? `Rechnungen für ${monatName} ${selectedYear}`
          : "Suchergebnisse im gesamten Archiv"}
      </p>

      <div className="card-box">
        <div className="list-row list-header-row list-header-row--sticky grid-rechnungen">
          <span>R.Nr.</span>
          <span>Datum</span>
          <span>Objekt</span>
          <span>Gast</span>
          <span>Betrag</span>
        </div>

        <div className="scroll-box">
          {filteredRechnungen.length > 0 ? (
            filteredRechnungen.map((rechnung) => (
              <div key={rechnung.id} className="list-row grid-rechnungen">
                <span className="res-id">{rechnung.rnr}</span>
                <span className="res-datum">{rechnung.datum}</span>
                <span className="res-objekt">{rechnung.objekt}</span>
                <span className="res-gast">{rechnung.gast}</span>
                <span className="res-betrag">
                  {rechnung.betrag}
                  {rechnung.preisanpassungen.length > 0 && (
                    <span
                      title={`${rechnung.preisanpassungen.length}x angepasst - Details über "Bearbeiten"`}
                      style={{ marginLeft: "6px", fontSize: "11px", color: "#f97316", fontWeight: 700 }}
                    >
                      ✎
                    </span>
                  )}
                </span>

                <div className="row-actions">
                  <button
                    className="btn-outline"
                    onClick={() => handleOpenEditModal(rechnung)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    className="btn-pdf-action"
                    onClick={() => window.open(`${RECHNUNGEN_API}/${rechnung.id}/pdf`, "_blank")}
                  >
                    PDF
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state-row">
              Keine Rechnungen für den ausgewählten Zeitraum vorhanden.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content form-card">
            <h3>
              {editingInvoice
                ? `Rechnung ${editingInvoice.rnr} bearbeiten`
                : "Neue Rechnung erstellen"}
            </h3>
            <form onSubmit={handleSaveInvoice}>
              <div className="form-grid" style={{ marginTop: "16px" }}>
                {!editingInvoice && (
                  <div
                    className="input-group full-width"
                    style={{ position: "relative" }}
                    ref={bookingDropdownRef}
                  >
                    <label>Buchung *</label>
                    <div
                      className="select-dropdown-trigger"
                      onClick={() => setIsBookingDropdownOpen(!isBookingDropdownOpen)}
                    >
                      <span>
                        {gewaehlteBuchung
                          ? `#${gewaehlteBuchung.id} · ${gewaehlteBuchung.Gaeste?.name} · ${gewaehlteBuchung.Objekte?.name} · ${gewaehlteBuchung.anreise}–${gewaehlteBuchung.abreise}`
                          : "— Buchung auswählen —"}
                      </span>
                      <span className="arrow-down">▼</span>
                    </div>

                    {isBookingDropdownOpen && (
                      <div className="select-dropdown-popup">
                        <div className="select-dropdown-list">
                          {verfuegbareBuchungen.length > 0 ? (
                            verfuegbareBuchungen.map((b) => (
                              <div
                                key={b.id}
                                className={`select-dropdown-item ${
                                  Number(invoiceForm.buchungId) === b.id ? "active" : ""
                                }`}
                                onClick={() => {
                                  setInvoiceForm({
                                    ...invoiceForm,
                                    buchungId: b.id,
                                    rechnungsDatum: b.abreise || "",
                                  });
                                  setIsBookingDropdownOpen(false);
                                }}
                              >
                                #{b.id} · {b.Gaeste?.name} · {b.Objekte?.name} · {b.anreise}–{b.abreise}
                              </div>
                            ))
                          ) : (
                            <div className="select-dropdown-empty">
                              Keine passenden Buchungen vorhanden.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {verfuegbareBuchungen.length === 0 && (
                      <p style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
                        Alle Buchungen haben bereits eine Rechnung.
                      </p>
                    )}
                  </div>
                )}

                {editingInvoice && (
                  <div className="input-group full-width">
                    <label>Verknüpfte Buchung</label>
                    <input
                      type="text"
                      disabled
                      className="select-disabled-mock"
                      value={`${editingInvoice.gast} · ${editingInvoice.objekt}`}
                    />
                  </div>
                )}

                <div className="input-group full-width">
                  <label>Rechnungsdatum</label>
                  <input
                    type="text"
                    disabled
                    className="select-disabled-mock"
                    value={invoiceForm.rechnungsDatum}
                    placeholder="Wird nach Buchungsauswahl automatisch befüllt"
                  />
                </div>

                {editingInvoice && (
                  <>
                    <div className="input-group">
                      <label>Ursprünglicher Preis (€)</label>
                      <input
                        type="text"
                        disabled
                        className="select-disabled-mock"
                        value={preisForm.basisPreis.toFixed(2)}
                      />
                    </div>

                    <div className="input-group">
                      <label>Rabatt (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        max="100"
                        placeholder="0"
                        value={preisForm.rabattProzent}
                        onChange={handleRabattChange}
                      />
                      <span style={{ fontSize: "12px", color: "#71717a", marginTop: "2px" }}>
                        Positiv = Reduzierung, negativ = Erhöhung
                      </span>
                    </div>

                    <div className="input-group full-width">
                      <label>Neuer Endbetrag (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={preisForm.endbetrag}
                        onChange={handleEndbetragChange}
                      />
                    </div>

                    <div className="input-group full-width">
                      <label>Begründung {preisWurdeGeaendert && "*"}</label>
                      <textarea
                        rows={2}
                        required={preisWurdeGeaendert}
                        placeholder="z.B. Kulanz wegen Anreiseverzögerung, Nachberechnung Endreinigung, ..."
                        value={preisForm.grund}
                        onChange={(e) => setPreisForm({ ...preisForm, grund: e.target.value })}
                      />
                      <span style={{ fontSize: "12px", color: "#71717a", marginTop: "2px" }}>
                        Wird zusammen mit der Preisänderung dauerhaft auf der Buchung gespeichert und
                        ist dort für den Gast/Chef jederzeit nachvollziehbar.
                      </span>
                    </div>

                    {editingInvoice.preisanpassungen.length > 0 && (
                      <div className="input-group full-width">
                        <label>Bisherige Preisänderungen</label>
                        <div
                          style={{
                            background: "#00000008",
                            borderRadius: "8px",
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {editingInvoice.preisanpassungen.map((a) => (
                            <div key={a.id} style={{ fontSize: "13px" }}>
                              <strong>
                                {formatEuro(a.alter_betrag)} → {formatEuro(a.neuer_betrag)}
                              </strong>{" "}
                              <span style={{ color: "#71717a" }}>· {formatZeitstempel(a.erstellt_am)}</span>
                              <p style={{ color: "#3f3f46", marginTop: "2px" }}>{a.grund}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="wizard-actions" style={{ marginTop: "24px" }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSaving}
                  style={{ padding: "10px 20px", fontSize: "14px" }}
                >
                  {isSaving
                    ? "Speichert..."
                    : editingInvoice
                      ? "Aktualisieren"
                      : "Rechnung erstellen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}