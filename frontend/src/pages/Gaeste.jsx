import { useState, useMemo, useEffect } from "react";
import { CountryDropdown } from "../components/ui/CountryDropdown";
import { Toast } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { validateForm, required, isEmail } from "../utils/validation";
import "../styles/shared-ui.css";
import "../styles/pageStyles/Gaeste.css";

/**
 * @file Gaeste.jsx
 * @description Verwaltung von Gästestammdaten. Bietet tabellarische Übersicht mit
 *              Such- und Paginierungsfunktionen, modalen Dialogen zum Anlegen/Bearbeiten
 *              sowie Soft-Delete mit Prüfung auf bestehende Buchungen.
 * @module pages/Gaeste
 */

const API_BASE = "/api/gaeste";

/**
 * Zentrale Validierungsregeln für Gästedaten.
 * @constant
 * @type {Object.<string, Array<Function>>}
 */
const GUEST_VALIDATION_RULES = {
  name: [required("Name ist erforderlich")],
  email: [required("E-Mail ist erforderlich"), isEmail()],
  strasse: [required("Straße ist erforderlich")],
  hnr: [required("Hausnummer ist erforderlich")],
  plz: [required("PLZ ist erforderlich")],
  stadt: [required("Stadt ist erforderlich")],
  land: [required("Bitte ein Land auswählen")],
};

/**
 * Gästeverwaltungs-Seitenkomponente.
 *
 * @component
 * @returns {JSX.Element} Die gerenderte Gästeverwaltung.
 */
export function Gaeste() {
  const { toast, showToast, dismissToast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [guests, setGuests] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [guestToDelete, setGuestToDelete] = useState(null);

  /** @type {[Object, Function]} Feldbezogene Validierungsfehler */
  const [formErrors, setFormErrors] = useState({});

  /** @type {[Object, Function]} Formularzustand für neuen oder editierten Gast */
  const [newGuest, setNewGuest] = useState({
    name: "", email: "", telnr: "", strasse: "", hnr: "", plz: "", stadt: "", land: "",
  });

  /**
   * Lädt alle aktiven Gäste vom Backend.
   */
  useEffect(() => {
    async function ladeGaeste() {
      try {
        setApiLoading(true);
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error(`Server antwortete mit Status ${response.status}`);
        setGuests(await response.json());
        setApiError(null);
      } catch (err) {
        console.error("Gaeste: Fehler beim Laden vom Backend:", err);
        setApiError("Backend nicht erreichbar. Läuft der Server (node src/server.js im backend-Ordner)?");
      } finally {
        setApiLoading(false);
      }
    }
    ladeGaeste();
  }, []);

  /**
   * Filtert Gäste basierend auf dem aktuellen Suchbegriff across all attributes.
   */
  const filteredGuests = useMemo(() => {
    return guests.filter((res) => {
      const search = searchQuery.toLowerCase();
      return (
        res.id?.toString().includes(search) ||
        res.name?.toLowerCase().includes(search) ||
        res.email?.toLowerCase().includes(search) ||
        res.strasse?.toLowerCase().includes(search) ||
        res.hnr?.toLowerCase().includes(search) ||
        res.stadt?.toLowerCase().includes(search) ||
        res.telnr?.toString().toLowerCase().includes(search) ||
        res.plz?.toString().includes(search)
      );
    });
  }, [guests, searchQuery]);

  /**
   * Sortiert die gefilterten Gäste anhand der aktiven Spaltenkonfiguration.
   */
  const sortedGuests = useMemo(() => {
    return [...filteredGuests].sort((a, b) => {
      const valA = a[sortConfig.key] ?? "";
      const valB = b[sortConfig.key] ?? "";
      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredGuests, sortConfig]);

  /**
   * Behandelt Änderungen an Texteingabefeldern und setzt bestehende Validierungsfehler zurück.
   *
   * @function
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input-Event.
   * @returns {void}
   */
  const handleInputChange = (e) => {
    setNewGuest({ ...newGuest, [e.target.name]: e.target.value });
    if (formErrors[e.target.name]) {
      setFormErrors({ ...formErrors, [e.target.name]: undefined });
    }
  };

  /** Öffnet das Modal im Erstellungsmodus. */
  const handleOpenCreateModal = () => {
    setEditingGuest(null);
    setFormErrors({});
    setNewGuest({ name: "", email: "", telnr: "", strasse: "", hnr: "", plz: "", stadt: "", land: "Österreich" });
    setIsModalOpen(true);
  };

  /** Öffnet das Modal zur Bearbeitung eines bestehenden Gastes. */
  const handleOpenEditModal = (guest) => {
    setEditingGuest(guest);
    setFormErrors({});
    setNewGuest({
      name: guest.name,
      email: guest.email || "",
      telnr: guest.telnr || "",
      strasse: guest.strasse || "",
      hnr: guest.hnr || "",
      plz: guest.plz || "",
      stadt: guest.stadt || "",
      land: guest.land || "",
    });
    setIsModalOpen(true);
  };

  /**
   * Validiert und speichert einen Gast per POST (Neu) oder PUT (Update).
   *
   * @async
   * @function
   * @param {React.FormEvent<HTMLFormElement>} e - Submit-Event.
   * @returns {Promise<void>}
   */
  const handleSaveGuest = async (e) => {
    e.preventDefault();
    
    const { valid, errors } = validateForm(newGuest, GUEST_VALIDATION_RULES);
    setFormErrors(errors);
    if (!valid) {
      showToast("error", "Bitte die markierten Felder korrigieren.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingGuest) {
        const response = await fetch(`${API_BASE}/${editingGuest.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newGuest),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Aktualisieren fehlgeschlagen.");
        }

        const aktualisierterGast = await response.json();
        setGuests(guests.map((g) => (g.id === editingGuest.id ? aktualisierterGast : g)));
      } else {
        const response = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newGuest),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Erstellen fehlgeschlagen.");
        }

        const neuerGast = await response.json();
        setGuests([neuerGast, ...guests]);
      }

      showToast("success", editingGuest ? "Gast wurde aktualisiert." : "Neuer Gast wurde angelegt.");
      handleCloseModal();
    } catch (err) {
      console.error("Gaeste: Fehler beim Speichern:", err);
      showToast("error", err.message || "Speichern fehlgeschlagen. Bitte Backend prüfen.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Führt das Soft-Delete eines Gastes im Backend aus.
   *
   * @async
   * @function
   * @returns {Promise<void>}
   */
  const handleConfirmDeleteGuest = async () => {
    if (!guestToDelete) return;
    setIsSaving(true);

    try {
      const response = await fetch(`${API_BASE}/${guestToDelete.id}`, { method: "DELETE" });
      if (!response.ok) {
        const fehler = await response.json().catch(() => ({}));
        throw new Error(fehler.error || "Löschen fehlgeschlagen");
      }

      setGuests(guests.filter((g) => g.id !== guestToDelete.id));
      showToast("success", `${guestToDelete.name} (${guestToDelete.email}) wurde gelöscht.`);
      setGuestToDelete(null);
    } catch (err) {
      console.error("Gaeste: Fehler beim Löschen:", err);
      showToast("error", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  /** Schließt das Erstell-/Bearbeitungs-Modal. */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGuest(null);
    setFormErrors({});
  };

  /**
   * Ändert die Spaltensortierung.
   *
   * @function
   * @param {string} key - Eigenschaftsname für die Sortierung.
   * @returns {void}
   */
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  /** Liefert das passende Pfeil-Symbol für den Tabellenheader. */
  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentGuests = sortedGuests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedGuests.length / itemsPerPage);

  /**
   * Render-Helfer für Inline-Fehlermeldungen.
   * @param {{field: string}} props
   */
  const FieldError = ({ field }) =>
    formErrors[field] ? (
      <span style={{ color: "#ef4444", fontSize: "12px", marginTop: "2px" }}>{formErrors[field]}</span>
    ) : null;

  if (apiLoading) return <p>Lade Gäste vom Server...</p>;
  if (apiError) return <p style={{ color: "#e30000" }}>{apiError}</p>;

  return (
    <div className="guests-container">
      <Toast toast={toast} onClose={dismissToast} />

      <div className="page-header">
        <div className="header-text">
          <h2>Gästeverwaltung</h2>
          <p className="subtitle">Gäste anzeigen und bearbeiten.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreateModal}>
          + Neuen Gast erfassen
        </button>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Suche nach Name, ID, E-Mail ..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          style={{ width: "100%" }}
        />
      </div>

      <div className="card-box">
        <div className="list-row list-header-row list-header-row--sticky grid-guests">
          <span className="sortable-header" onClick={() => requestSort("id")}>ID{getSortIndicator("id")}</span>
          <span className="sortable-header" onClick={() => requestSort("name")}>Name{getSortIndicator("name")}</span>
          <span>E-Mail</span>
          <span>Telefonnummer</span>
          <span>Adresse</span>
          <span></span>
        </div>
        <div className="scroll-box scroll-box--tall">
          {currentGuests.length > 0 ? (
            currentGuests.map((guest) => (
              <div key={guest.id} className="list-row grid-guests">
                <span className="res-id">#{guest.id}</span>
                <span className="res-name">{guest.name}</span>
                <span className="guest-email">{guest.email}</span>
                <span>{guest.telnr}</span>
                <span>{guest.strasse} {guest.hnr}, {guest.plz} {guest.stadt}, {guest.land?.toUpperCase()}</span>
                <div className="row-actions">
                  <button className="btn-outline" onClick={() => handleOpenEditModal(guest)}>
                    Bearbeiten
                  </button>
                  {guest.email ? (
                    <a
                      href={`mailto:${guest.email}`}
                      className="btn-mail-action"
                      title={`E-Mail an ${guest.email} senden`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      E-Mail
                    </a>
                  ) : (
                    <button className="btn-mail-action" disabled title="Keine E-Mail vorhanden">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      E-Mail
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state-row">Keine Gäste gefunden.</div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination-bar">
            <button className="btn-outline" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>&lt; Zurück</button>
            <span className="pagination-info">Seite <strong>{currentPage}</strong> von {totalPages}</span>
            <button className="btn-outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Weiter &gt;</button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content form-card">
            <h3>{editingGuest ? "Gast bearbeiten" : "Neuen Gast erfassen"}</h3>
            <form onSubmit={handleSaveGuest} noValidate>
              <div className="form-grid" style={{ marginTop: "16px" }}>
                <div className="input-group full-width">
                  <label>Name (Vor- & Nachname) *</label>
                  <input type="text" name="name" value={newGuest.name} onChange={handleInputChange} placeholder="z.B. Max Mustermann" />
                  <FieldError field="name" />
                </div>
                <div className="input-group">
                  <label>E-Mail *</label>
                  <input type="email" name="email" value={newGuest.email} onChange={handleInputChange} placeholder="E-Mail-Adresse" />
                  <FieldError field="email" />
                </div>
                <div className="input-group">
                  <label>Telefonnummer</label>
                  <input
                    type="tel"
                    name="telnr"
                    value={newGuest.telnr}
                    placeholder="Telefonnummer"
                    onChange={(e) => {
                      const erlaubteZeichen = e.target.value.replace(/[^0-9+ /-]/g, "");
                      setNewGuest({ ...newGuest, telnr: erlaubteZeichen });
                    }}
                  />
                </div>
                <div className="input-group full-width form-row-split">
                  <div className="input-group">
                    <label>Straße *</label>
                    <input type="text" name="strasse" value={newGuest.strasse} onChange={handleInputChange} placeholder="Straße" />
                    <FieldError field="strasse" />
                  </div>
                  <div className="input-group">
                    <label>Hausnummer *</label>
                    <input type="text" name="hnr" value={newGuest.hnr} onChange={handleInputChange} placeholder="Hausnummer" />
                    <FieldError field="hnr" />
                  </div>
                </div>
                <div className="input-group full-width form-row-split reverse">
                  <div className="input-group">
                    <label>PLZ *</label>
                    <input type="text" name="plz" value={newGuest.plz} onChange={handleInputChange} placeholder="PLZ" />
                    <FieldError field="plz" />
                  </div>
                  <div className="input-group">
                    <label>Stadt *</label>
                    <input type="text" name="stadt" value={newGuest.stadt} onChange={handleInputChange} placeholder="Stadt" />
                    <FieldError field="stadt" />
                  </div>
                </div>

                <div className="input-group full-width" style={{ padding: 0 }}>
                  <CountryDropdown
                    value={newGuest.land}
                    onChange={(land) => {
                      setNewGuest({ ...newGuest, land });
                      if (formErrors.land) setFormErrors({ ...formErrors, land: undefined });
                    }}
                  />
                  <FieldError field="land" />
                </div>
              </div>

              <div className="modal-footer-flex">
                {editingGuest ? (
                  <button type="button" className="btn-delete-modal" onClick={() => { setGuestToDelete(editingGuest); setIsModalOpen(false); }}>
                    Gast löschen
                  </button>
                ) : (
                  <div></div>
                )}
                <div className="modal-footer-right">
                  <button type="button" className="btn-outline" onClick={handleCloseModal}>Abbrechen</button>
                  <button type="submit" className="btn-primary" disabled={isSaving} style={{ padding: "10px 20px", fontSize: "14px" }}>
                    {isSaving ? "Speichert..." : editingGuest ? "Aktualisieren" : "Speichern"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {guestToDelete && (
        <div className="modal-backdrop">
          <div className="modal-content modal-delete form-card">
            <h3>Gast löschen?</h3>
            <p className="modal-delete-text">
              Möchtest du den Gast <strong>{guestToDelete.name}</strong> unwiderruflich löschen?
            </p>
            <div className="wizard-actions" style={{ marginTop: "24px" }}>
              <button className="btn-outline" onClick={() => setGuestToDelete(null)} disabled={isSaving}>Abbrechen</button>
              <button className="btn-primary" style={{ padding: "10px 20px", fontSize: "14px" }} onClick={handleConfirmDeleteGuest} disabled={isSaving}>
                {isSaving ? "Löscht..." : "Ja, löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}