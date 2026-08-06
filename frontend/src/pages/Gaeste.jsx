import { useState, useMemo, useEffect } from "react";
import { CountryDropdown } from "../components/ui/CountryDropdown";
import { Toast } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { validateForm, required, isEmail } from "../utils/validation";
import "../styles/shared-ui.css";
import "../styles/pageStyles/Gaeste.css";

const API_BASE = "/api/gaeste";

// ─── ZENTRALE VALIDIERUNGSREGELN FÜR DAS GAST-FORMULAR ───
// Bewusst als Konstante außerhalb der Komponente, damit sie nicht bei
// jedem Render neu gebaut wird.
const GUEST_VALIDATION_RULES = {
  name: [required("Name ist erforderlich")],
  email: [required("E-Mail ist erforderlich"), isEmail()],
  strasse: [required("Straße ist erforderlich")],
  hnr: [required("Hausnummer ist erforderlich")],
  plz: [required("PLZ ist erforderlich")],
  stadt: [required("Stadt ist erforderlich")],
  land: [required("Bitte ein Land auswählen")],
};

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

  // Feldfehler aus der letzten Validierung, z.B. { email: "..." }
  const [formErrors, setFormErrors] = useState({});

  const [newGuest, setNewGuest] = useState({
    name: "", email: "", telnr: "", strasse: "", hnr: "", plz: "", stadt: "", land: "",
  });

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

  const sortedGuests = useMemo(() => {
    return [...filteredGuests].sort((a, b) => {
      const valA = a[sortConfig.key] ?? "";
      const valB = b[sortConfig.key] ?? "";
      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredGuests, sortConfig]);

  const handleInputChange = (e) => {
    setNewGuest({ ...newGuest, [e.target.name]: e.target.value });
    // Sobald der Nutzer ein fehlerhaftes Feld anfasst, dessen Fehler
    // sofort ausblenden - sonst bleibt die rote Meldung stur stehen,
    // obwohl schon längst korrigiert wurde.
    if (formErrors[e.target.name]) {
      setFormErrors({ ...formErrors, [e.target.name]: undefined });
    }
  };

  const handleOpenCreateModal = () => {
    setEditingGuest(null);
    setFormErrors({});
    setNewGuest({ name: "", email: "", telnr: "", strasse: "", hnr: "", plz: "", stadt: "", land: "Österreich" });
    setIsModalOpen(true);
  };

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

  const handleSaveGuest = async (e) => {
    e.preventDefault();

    // Zentrale Validierung statt verstreuter if-Abfragen. "land" wird
    // hier nicht per HTML5-required geprüft, weil es ein Custom-
    // Dropdown ist (CountryDropdown hat zwar selbst ein unsichtbares
    // Pflicht-Input für die native Browser-Meldung, aber die zentrale
    // Validierung hier fängt es zusätzlich sauber und einheitlich mit
    // den anderen Feldern ab).
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
        if (!response.ok) throw new Error("Aktualisieren fehlgeschlagen");
        const aktualisierterGast = await response.json();
        setGuests(guests.map((g) => (g.id === editingGuest.id ? aktualisierterGast : g)));
      } else {
        const response = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newGuest),
        });
        if (!response.ok) throw new Error("Erstellen fehlgeschlagen");
        const neuerGast = await response.json();
        setGuests([neuerGast, ...guests]);
      }

      showToast("success", editingGuest ? "Gast wurde aktualisiert." : "Neuer Gast wurde angelegt.");
      handleCloseModal();
    } catch (err) {
      console.error("Gaeste: Fehler beim Speichern:", err);
      showToast("error", "Speichern fehlgeschlagen. Bitte Backend prüfen.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteGuest = async () => {
    if (!guestToDelete) return;
    setIsSaving(true);

    try {
      const response = await fetch(`${API_BASE}/${guestToDelete.id}`, { method: "DELETE" });
      if (!response.ok) {
        // Die Backend-Fehlermeldung (z.B. "hat noch aktive Buchungen")
        // wird 1:1 an den Nutzer weitergereicht, statt ihn nur mit
        // einem generischen "fehlgeschlagen" allein zu lassen.
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGuest(null);
    setFormErrors({});
  };

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentGuests = sortedGuests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedGuests.length / itemsPerPage);

  /** Kleiner, wiederverwendbarer Helfer für die rote Fehlermeldung unter einem Feld. */
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
            {/* noValidate: HTML5-Pflichtfeld-Popups aus, weil eine eigene,
                zentrale Validierung mit klareren Meldungen unter jedem
                Feld angezeigt wird. */}
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