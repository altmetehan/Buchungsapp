import { useState, useEffect } from "react";
import "../styles/shared-ui.css";
import "../styles/pageStyles/Objekte.css";
import { Toast } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { validateForm, required, isNonNegativeNumber } from "../utils/validation";
import { istWohnung } from "../utils/javaUtils";

/**
 * @file Objekte.jsx
 * @description Verwaltung von Ferienunterkünften, Fahrzeugen und sonstigen Mietobjekten.
 *              Bietet Funktionen zur Pflege von Namen, Beschreibungen, KFZ-Kennzeichen,
 *              Preisen sowie der öffentlichen Sichtbarkeit (Portal-Kalender & Anfrage-Seite),
 *              inklusive Validierung und Löschschutz bei aktiven Belegungen.
 * @module pages/Objekte
 */

const API_BASE = "/api/objekte";

const LEERES_FORMULAR = { name: "", beschreibung: "", kennzeichen: "", preis: "", oeffentlich: false };

/**
 * Validierungsregeln für Objektstammdaten.
 * @constant
 * @type {Object.<string, Array<Function>>}
 */
const OBJEKT_VALIDATION_RULES = {
  name: [required("Objektname ist erforderlich")],
  beschreibung: [required("Beschreibung ist erforderlich")],
  preis: [required("Preis ist erforderlich"), isNonNegativeNumber()],
};

/**
 * Objekte-Seitenkomponente.
 *
 * @component
 * @returns {JSX.Element} Die gerenderte Objektverwaltung.
 */
export function Objekte() {
  const [objects, setObjects] = useState([]);

  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { toast, showToast, dismissToast } = useToast();
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    async function ladeObjekte() {
      try {
        setApiLoading(true);
        const response = await fetch(API_BASE);
        if (!response.ok) {
          throw new Error(`Server antwortete mit Status ${response.status}`);
        }
        setObjects(await response.json());
        setApiError(null);
      } catch (err) {
        console.error("Objekte: Fehler beim Laden vom Backend:", err);
        setApiError(
          "Backend nicht erreichbar. Läuft der Server (node src/server.js im backend-Ordner)?",
        );
      } finally {
        setApiLoading(false);
      }
    }

    ladeObjekte();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingObject, setEditingObject] = useState(null);
  const [objectToDelete, setObjectToDelete] = useState(null);
  const [newObject, setNewObject] = useState(LEERES_FORMULAR);

  /** Öffnet das Modal zum Erstellen eines neuen Objekts. */
  const handleOpenCreateModal = () => {
    setEditingObject(null);
    setFormErrors({});
    setNewObject(LEERES_FORMULAR);
    setIsModalOpen(true);
  };

  /** Öffnet das Modal zur Bearbeitung eines bestehenden Objekts. */
  const handleOpenEditModal = (object) => {
    setEditingObject(object);
    setFormErrors({});
    setNewObject({
      name: object.name,
      beschreibung: object.beschreibung || "",
      kennzeichen: object.kennzeichen || "",
      preis: object.preis?.toString() || "",
      oeffentlich: Boolean(object.oeffentlich),
    });
    setIsModalOpen(true);
  };

  /**
   * Speichert das Objekt per POST oder PUT nach Validierung.
   *
   * @async
   * @function
   * @param {React.FormEvent<HTMLFormElement>} e - Submit-Event.
   * @returns {Promise<void>}
   */
  const handleSaveObject = async (e) => {
    e.preventDefault();

    const { valid, errors } = validateForm(newObject, OBJEKT_VALIDATION_RULES);
    setFormErrors(errors);
    if (!valid) {
      showToast("error", "Bitte die markierten Felder korrigieren.");
      return;
    }

    const preisNormalisiert = newObject.preis.toString().replace(",", ".");
    const preisZahl = parseFloat(preisNormalisiert);

    const payload = {
      name: newObject.name,
      beschreibung: newObject.beschreibung,
      kennzeichen: newObject.kennzeichen || null,
      preis: Math.round(preisZahl * 100) / 100,
      oeffentlich: newObject.oeffentlich,
    };

    setIsSaving(true);
    try {
      if (editingObject) {
        const response = await fetch(`${API_BASE}/${editingObject.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Aktualisieren fehlgeschlagen");
        const aktualisiertesObjekt = await response.json();
        setObjects(objects.map((o) => (o.id === editingObject.id ? aktualisiertesObjekt : o)));
      } else {
        const response = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Erstellen fehlgeschlagen");
        setObjects([...objects, await response.json()]);
      }

      setIsModalOpen(false);
      setNewObject(LEERES_FORMULAR);
      setEditingObject(null);
      showToast("success", editingObject ? "Objekt wurde aktualisiert." : "Neues Objekt wurde angelegt.");
    } catch (err) {
      console.error("Objekte: Fehler beim Speichern:", err);
      showToast("error", "Speichern fehlgeschlagen. Bitte prüfen, ob das Backend läuft.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Führt das Soft-Delete eines Objekts aus.
   *
   * @async
   * @function
   * @returns {Promise<void>}
   */
  const handleConfirmDeleteObject = async () => {
    if (!objectToDelete) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/${objectToDelete.id}`, { method: "DELETE" });
      if (!response.ok) {
        const fehler = await response.json().catch(() => ({}));
        throw new Error(fehler.error || "Löschen fehlgeschlagen");
      }
      setObjects(objects.filter((o) => o.id !== objectToDelete.id));
      showToast("success", `${objectToDelete.name} wurde gelöscht.`);
      setObjectToDelete(null);
    } catch (err) {
      console.error("Objekte: Fehler beim Löschen:", err);
      showToast("error", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e) => {
    setNewObject({ ...newObject, [e.target.name]: e.target.value });
    if (formErrors[e.target.name]) setFormErrors({ ...formErrors, [e.target.name]: undefined });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingObject(null);
    setFormErrors({});
  };

  if (apiLoading) return <p>Lade Objekte vom Server...</p>;
  if (apiError) return <p style={{ color: "#e30000" }}>{apiError}</p>;

  return (
    <div className="object-container">
      <Toast toast={toast} onClose={dismissToast} />
      <div className="page-header">
        <div className="header-text">
          <h2>Objekte</h2>
          <p className="subtitle">Übersicht und Verwaltung aller Objekte</p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreateModal}>
          + Neues Objekt erstellen
        </button>
      </div>

      <div className="card-box">
        <div className="list-row list-header-row list-header-row--sticky grid-objekte">
          <span>ID</span>
          <span>Name</span>
          <span>Beschreibung</span>
          <span>Kennzeichen</span>
          <span className="object-oeffentlich-header">Öffentlich</span>
          <span className="object-preis-header">Preis pro Nacht</span>
          <span></span>
        </div>

        <div className="scroll-box">
          {objects.length > 0 ? (
            objects.map((object) => (
              <div key={object.id} className="list-row grid-objekte">
                <span className="object-id">#{object.id}</span>
                <span className="object-name">{object.name}</span>
                <span className="object-desc">{object.beschreibung}</span>
                <span className="object-desc">{object.kennzeichen}</span>
                <span
                  className="object-oeffentlich"
                  title={object.oeffentlich ? "Im Portal sichtbar" : "Im Portal nicht sichtbar"}
                >
                  {object.oeffentlich ? (
                    <span style={{ color: "#2b9348", fontWeight: 700 }}>✓</span>
                  ) : (
                    <span style={{ color: "#e30000", fontWeight: 500, fontSize: "15px" }}>X</span>
                  )}
                </span>
                <span className="object-preis" style={object.preis === 0 ? { fontWeight: 400, color: "#8e8e93", fontSize: "12px" } : {}}>
                  {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(object.preis)}{" "}
                </span>
                <div className="row-actions">
                  <button className="btn-outline" onClick={() => handleOpenEditModal(object)}>
                    Bearbeiten
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state-row">Keine Objekte gefunden.</div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content form-card">
            <h3>{editingObject ? `${editingObject.name} bearbeiten` : "Neues Objekt erstellen"}</h3>
            <form onSubmit={handleSaveObject} noValidate>
              <div className="form-grid" style={{ marginTop: "16px" }}>
                <div className="input-group full-width">
                  <label>Objektname *</label>
                  <input
                    type="text"
                    name="name"
                    value={newObject.name}
                    onChange={handleInputChange}
                    placeholder="z.B. Apartment 4"
                  />
                  {formErrors.name && <span style={{ color: "#ef4444", fontSize: "12px" }}>{formErrors.name}</span>}
                </div>
                <div className="input-group full-width">
                  <label>Beschreibung *</label>
                  <input
                    type="text"
                    name="beschreibung"
                    value={newObject.beschreibung}
                    onChange={handleInputChange}
                    placeholder="z.B. 3 Zimmer, Balkon, 70m²"
                  />
                  {formErrors.beschreibung && (
                    <span style={{ color: "#ef4444", fontSize: "12px" }}>{formErrors.beschreibung}</span>
                  )}
                </div>
                <div className="input-group full-width">
                  <label>Kennzeichen</label>
                  <input
                    type="text"
                    name="kennzeichen"
                    value={newObject.kennzeichen}
                    onChange={handleInputChange}
                    placeholder="z.B. BZ-123AB"
                  />
                </div>
                <div className="input-group full-width">
                  <label>{istWohnung(newObject.name) ? "Preis pro Nacht (€) *" : "Preis pro Stunde (€) *"}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    name="preis"
                    min="0"
                    value={newObject.preis}
                    onChange={handleInputChange}
                    placeholder={istWohnung(newObject.name) ? "z.B. 120" : "z.B. 15,50"}
                  />
                  {formErrors.preis && <span style={{ color: "#ef4444", fontSize: "12px" }}>{formErrors.preis}</span>}
                </div>

                <div
                  className="input-group full-width"
                  style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}
                >
                  <input
                    type="checkbox"
                    id="oeffentlich-checkbox"
                    checked={newObject.oeffentlich}
                    onChange={(e) => setNewObject({ ...newObject, oeffentlich: e.target.checked })}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <label htmlFor="oeffentlich-checkbox" style={{ marginBottom: 0, cursor: "pointer" }}>
                    Öffentlich sichtbar (Portal-Belegungsplan &amp; Anfrage-Seite)
                  </label>
                </div>
                <span style={{ fontSize: "12px", color: "#71717a", marginTop: "-12px", gridColumn: "span 2" }}>
                  Nur öffentliche Objekte sind für Besucher unter /portal im Kalender wählbar und können dort
                  angefragt werden.
                </span>
              </div>

              <div className="modal-footer-flex">
                {editingObject ? (
                  <button
                    type="button"
                    className="btn-delete-modal"
                    onClick={() => {
                      setObjectToDelete(editingObject);
                      setIsModalOpen(false);
                    }}
                  >
                    Objekt löschen
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="modal-footer-right">
                  <button type="button" className="btn-outline" onClick={handleCloseModal}>
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSaving}
                    style={{ padding: "10px 20px", fontSize: "14px" }}
                  >
                    {isSaving ? "Speichert..." : editingObject ? "Aktualisieren" : "Erstellen"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {objectToDelete && (
        <div className="modal-backdrop">
          <div className="modal-content modal-delete form-card">
            <h3>Objekt löschen?</h3>
            <p className="modal-delete-text">
              Möchtest du das Objekt <strong>{objectToDelete.name}</strong> unwiderruflich löschen?
            </p>
            <div className="wizard-actions" style={{ marginTop: "24px" }}>
              <button className="btn-outline" onClick={() => setObjectToDelete(null)} disabled={isSaving}>
                Abbrechen
              </button>
              <button
                className="btn-primary"
                style={{ padding: "10px 20px", fontSize: "14px" }}
                onClick={handleConfirmDeleteObject}
                disabled={isSaving}
              >
                {isSaving ? "Löscht..." : "Ja, löschen."}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}