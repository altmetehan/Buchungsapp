import { useState, useEffect, useMemo } from "react";
import { Toast } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { useWebSocket } from "../hooks/useWebSocket";
import { useEinstellungen } from "../hooks/useEinstellungen";
import "../styles/shared-ui.css";
import "../styles/pageStyles/Anfragen.css";

/**
 * @file Anfragen.jsx
 * @description Verwaltung von Buchungsanfragen aus dem öffentlichen Portal.
 *              Ermöglicht das Einsehen, Ablehnen mit Begründung sowie das Annehmen
 *              inklusive Rabattvergabe, automatischer Buchungserstellung und Rechnungserzeugung.
 * @module pages/Anfragen
 */

const ANFRAGEN_API = "/api/anfragen";
const BUCHUNGEN_API = "/api/buchungen";
const RECHNUNGEN_API = "/api/rechnungen";

/**
 * Formatiert einen ISO-Zeitstempel als "DD.MM.YYYY, HH:MM Uhr".
 * @param {string} isoStr
 * @returns {string}
 */
const formatZeitstempel = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.toLocaleDateString("de-DE")}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
};

/**
 * Hilfsfunktion zur Stundenberechnung bei stundenbasierten Objekten.
 *
 * @function
 * @param {Date} startDatum - Startdatum.
 * @param {string} startZeit - Startuhrzeit (HH:MM).
 * @param {Date} endDatum - Enddatum.
 * @param {string} endZeit - Enduhrzeit (HH:MM).
 * @returns {number} Differenz in Stunden.
 */
const berechneStunden = (startDatum, startZeit, endDatum, endZeit) => {
  if (!startDatum || !endDatum || !startZeit || !endZeit) return 0;
  const [sh, sm] = startZeit.split(":").map(Number);
  const [eh, em] = endZeit.split(":").map(Number);

  const start = new Date(startDatum);
  start.setHours(sh, sm, 0, 0);
  const ende = new Date(endDatum);
  ende.setHours(eh, em, 0, 0);

  const diffMs = ende - start;
  return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
};

/**
 * Berechnet den exakten Vorschlagspreis inkl. Zusatzobjekt & Kombirabatt für eine Anfrage.
 *
 * @function
 * @param {Object} anfrage - Anfragedaten.
 * @param {Object} einstellungen - Globale Systemeinstellungen.
 * @returns {number} Gerundeter Vorschlagspreis.
 */
const berechneVorschlagsPreis = (anfrage, einstellungen) => {
  if (!anfrage || !anfrage.anreise || !anfrage.abreise) return 0;

  const [ad, am, ay] = anfrage.anreise.split(".").map(Number);
  const [bd, bm, by] = anfrage.abreise.split(".").map(Number);
  const startD = new Date(ay, am - 1, ad);
  const endD = new Date(by, bm - 1, bd);

  let mainPreis = 0;
  const istWohnung = anfrage.Objekte?.name?.toLowerCase().includes("wohnung");

  if (istWohnung) {
    const naechte = Math.max(1, Math.round((endD - startD) / (1000 * 60 * 60 * 24)));
    mainPreis = naechte * (anfrage.Objekte?.preis || 0);
  } else {
    const stunden = berechneStunden(startD, anfrage.anreise_zeit || "09:00", endD, anfrage.abreise_zeit || "17:00");
    mainPreis = stunden * (anfrage.Objekte?.preis || 0);
  }

  let zusatzPreis = 0;
  if (anfrage.ObjekteZusatz) {
    const checkin = anfrage.anreise_zeit || einstellungen?.checkin_zeit || "15:00";
    const checkout = anfrage.abreise_zeit || einstellungen?.checkout_zeit || "11:00";
    const zusatzStunden = berechneStunden(startD, checkin, endD, checkout);
    const busStundensatz = anfrage.ObjekteZusatz.preis || 0;
    const zusatzRegulaer = zusatzStunden * busStundensatz;
    const kombirabatt = einstellungen?.kombirabatt ?? 0;
    zusatzPreis = zusatzRegulaer * (1 - kombirabatt / 100);
  }

  return Math.round((mainPreis + zusatzPreis) * 100) / 100;
};

/**
 * Anfragen-Seitenkomponente.
 *
 * @component
 * @returns {JSX.Element} Die gerenderte Anfragenverwaltung.
 */
export function Anfragen() {
  const { toast, showToast, dismissToast } = useToast();
  const { einstellungen } = useEinstellungen();

  const [searchQuery, setSearchQuery] = useState("");
  const [anfragen, setAnfragen] = useState([]);
  const [alleBuchungen, setAlleBuchungen] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const [verarbeiteId, setVerarbeiteId] = useState(null);

  const [selectedAnfrageDetails, setSelectedAnfrageDetails] = useState(null);
  const [ablehnenAnfrage, setAblehnenAnfrage] = useState(null);
  const [ablehnungsgrund, setAblehnungsgrund] = useState("");

  const [annehmenAnfrage, setAnnehmenAnfrage] = useState(null);
  const [annehmenBasisPreis, setAnnehmenBasisPreis] = useState(0);
  const [annehmenRabattProzent, setAnnehmenRabattProzent] = useState("0");
  const [annehmenPreis, setAnnehmenPreis] = useState("0");

  const [angenommeneBuchungErfolg, setAngenommeneBuchungErfolg] = useState(null);

  /**
   * Lädt alle Anfragen und verknüpfte Buchungen.
   *
   * @async
   * @function
   * @param {boolean} [isInitial=false]
   * @returns {Promise<void>}
   */
  const ladeDaten = async (isInitial = false) => {
    try {
      if (isInitial) setApiLoading(true);

      const [anfragenRes, buchungenRes] = await Promise.all([
        fetch(ANFRAGEN_API),
        fetch(BUCHUNGEN_API).catch(() => null),
      ]);

      if (!anfragenRes.ok) throw new Error("Fehler beim Laden");

      const rawAnfragenData = await anfragenRes.json();

      const anfragenData = rawAnfragenData.map((a) => ({
        ...a,
        name: a.AnfrageGaeste?.name || a.name || "",
        email: a.AnfrageGaeste?.email || a.email || "",
        telnr: a.AnfrageGaeste?.telnr || a.telnr || "",
        strasse: a.AnfrageGaeste?.strasse || a.strasse || "",
        hnr: a.AnfrageGaeste?.hnr || a.hnr || "",
        plz: a.AnfrageGaeste?.plz || a.plz || "",
        stadt: a.AnfrageGaeste?.stadt || a.stadt || "",
        land: a.AnfrageGaeste?.land || a.land || "Österreich",
      }));

      setAnfragen(anfragenData);

      if (buchungenRes && buchungenRes.ok) {
        const buchungenData = await buchungenRes.json();
        setAlleBuchungen(buchungenData);
      }

      setApiError(null);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
      if (isInitial) setApiError("Backend nicht erreichbar.");
    } finally {
      if (isInitial) setApiLoading(false);
    }
  };

  useEffect(() => {
    ladeDaten(true);
  }, []);

  useWebSocket("anfragen:changed", () => ladeDaten(false));

  /**
   * Prüft, ob eine Anfrage dem Suchfilter entspricht.
   *
   * @function
   * @param {Object} a - Anfragedatensatz.
   * @param {string} query - Suchbegriff.
   * @returns {boolean}
   */
  const matchesSearch = (a, query) => {
    if (!query.trim()) return true;

    const searchWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (searchWords.length === 0) return true;

    const idDarfMitsuchen = searchWords.length === 1;

    const textFelder = [
      a.name,
      a.email,
      a.Objekte?.name,
      a.ObjekteZusatz?.name,
      a.infos,
      a.ablehnungsgrund,
      a.anreise,
      a.abreise,
    ];

    if (idDarfMitsuchen) {
      textFelder.push(a.id?.toString(), `#${a.id}`);
    }

    const durchsuchbarerText = textFelder.filter(Boolean).join(" ").toLowerCase();

    return searchWords.every((word) => {
      if (/^\d+$/.test(word)) {
        const regex = new RegExp(`\\b${word}\\b`, "i");
        return regex.test(durchsuchbarerText);
      }
      return durchsuchbarerText.includes(word);
    });
  };

  const offeneAnfragen = useMemo(() => {
    return anfragen
      .filter((a) => a.status === "offen")
      .filter((a) => matchesSearch(a, searchQuery));
  }, [anfragen, searchQuery]);

  const letzteEntschiedene = useMemo(() => {
    const isSearching = searchQuery.trim() !== "";
    const vorDreiTagen = new Date();
    vorDreiTagen.setDate(vorDreiTagen.getDate() - 3);

    return anfragen
      .filter((a) => a.status !== "offen")
      .filter((a) => {
        if (isSearching) {
          return matchesSearch(a, searchQuery);
        }
        const entscheidungsDatum = new Date(a.angenommen_am || a.abgelehnt_am);
        return entscheidungsDatum >= vorDreiTagen;
      })
      .sort((a, b) => new Date(b.angenommen_am || b.abgelehnt_am) - new Date(a.angenommen_am || a.abgelehnt_am));
  }, [anfragen, searchQuery]);

  /**
   * Prüft anhand der E-Mail, ob der Gast bereits frühere Buchungen im System hat (Stammgast).
   *
   * @function
   * @param {string} email - E-Mail des Gastes.
   * @returns {{hatGebucht: boolean, count: number}}
   */
  const getGastHistorie = (email) => {
    if (!email) return { hatGebucht: false, count: 0 };
    const eLower = email.toLowerCase().trim();
    const bisherige = alleBuchungen.filter((b) => b.Gaeste?.email?.toLowerCase().trim() === eLower);
    return {
      hatGebucht: bisherige.length > 0,
      count: bisherige.length,
    };
  };

  const handleOpenAnnehmenModal = (anfrage) => {
    setSelectedAnfrageDetails(null);
    const vorschlag = berechneVorschlagsPreis(anfrage, einstellungen);
    const exakterVorschlag = Math.round(vorschlag * 100) / 100;

    setAnnehmenAnfrage(anfrage);
    setAnnehmenBasisPreis(exakterVorschlag);
    setAnnehmenRabattProzent("0");
    setAnnehmenPreis(exakterVorschlag.toFixed(2));
  };

  const handleOpenAblehnenModal = (anfrage) => {
    setSelectedAnfrageDetails(null);
    setAblehnenAnfrage(anfrage);
  };

  const handleAnnehmenRabattChange = (e) => {
    const rawVal = e.target.value;
    if (rawVal === "") {
      setAnnehmenRabattProzent("");
      setAnnehmenPreis(annehmenBasisPreis.toFixed(2));
      return;
    }

    let num = parseFloat(rawVal.replace(",", "."));
    if (isNaN(num)) return;

    num = Math.max(0, Math.min(100, num));
    const neuerPreis = Math.max(0, annehmenBasisPreis * (1 - num / 100));

    setAnnehmenRabattProzent(num.toString());
    setAnnehmenPreis((Math.round(neuerPreis * 100) / 100).toFixed(2));
  };

  const handleAnnehmenPreisChange = (e) => {
    const rawVal = e.target.value;
    const neuerPreis = parseFloat(rawVal.replace(",", "."));

    let berechneterRabatt = "0";
    if (!isNaN(neuerPreis) && annehmenBasisPreis > 0) {
      let r = ((annehmenBasisPreis - neuerPreis) / annehmenBasisPreis) * 100;
      r = Math.max(0, Math.min(100, r));
      berechneterRabatt = r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
    }

    setAnnehmenPreis(rawVal);
    setAnnehmenRabattProzent(berechneterRabatt);
  };

  const annehmenPreisNum = parseFloat(annehmenPreis.toString().replace(",", "."));
  const annehmenPreisWurdeGeaendert =
    annehmenAnfrage != null &&
    !isNaN(annehmenPreisNum) &&
    Math.abs(annehmenPreisNum - annehmenBasisPreis) > 0.009;

  /**
   * Bestätigt die Annahme einer Anfrage und erzeugt Buchung sowie Rechnung.
   *
   * @async
   * @function
   * @returns {Promise<void>}
   */
  const handleAnnehmenBestaetigen = async () => {
    setVerarbeiteId(annehmenAnfrage.id);
    try {
      const response = await fetch(`${ANFRAGEN_API}/${annehmenAnfrage.id}/annehmen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preis: parseFloat(annehmenPreis.toString().replace(",", ".")) || 0,
        }),
      });
      if (!response.ok) {
        const fehler = await response.json().catch(() => ({}));
        throw new Error(fehler.error || "Annehmen fehlgeschlagen");
      }

      const resultData = await response.json();

      setAngenommeneBuchungErfolg({
        gastName: annehmenAnfrage.name,
        buchungId: resultData.buchung?.id,
        rechnungId: resultData.rechnung?.id,
      });

      setAnnehmenAnfrage(null);
      await ladeDaten();
    } catch (err) {
      console.error("Anfragen: Fehler beim Annehmen:", err);
      showToast("error", err.message);
    } finally {
      setVerarbeiteId(null);
    }
  };

  /**
   * Lehnt eine Anfrage mit Begründung ab.
   *
   * @async
   * @function
   * @returns {Promise<void>}
   */
  const handleAblehnenBestaetigen = async () => {
    if (!ablehnungsgrund.trim()) {
      showToast("error", "Bitte einen Ablehnungsgrund angeben.");
      return;
    }

    setVerarbeiteId(ablehnenAnfrage.id);
    try {
      const response = await fetch(`${ANFRAGEN_API}/${ablehnenAnfrage.id}/ablehnen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grund: ablehnungsgrund }),
      });
      if (!response.ok) {
        const fehler = await response.json().catch(() => ({}));
        throw new Error(fehler.error || "Ablehnen fehlgeschlagen");
      }
      showToast("success", `Anfrage von ${ablehnenAnfrage.name} wurde abgelehnt.`);
      setAblehnenAnfrage(null);
      setAblehnungsgrund("");
      await ladeDaten();
    } catch (err) {
      console.error("Anfragen: Fehler beim Ablehnen:", err);
      showToast("error", err.message);
    } finally {
      setVerarbeiteId(null);
    }
  };

  if (apiLoading) return <p className="anfragen-loading">Lade Anfragen vom Server...</p>;
  if (apiError) return <p className="anfragen-error">{apiError}</p>;

  return (
    <div className="anfragen-container">
      <Toast toast={toast} onClose={dismissToast} />

      <div className="page-header">
        <div className="header-text">
          <h2>Anfragen</h2>
          <p className="subtitle">Buchungsanfragen von der öffentlichen Anfrage-Seite annehmen oder ablehnen.</p>
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Suche nach Name, ID, Objekt, E-Mail oder Ablehnungsgrund..."
          className="search-input search-input-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <p className="anfragen-section-title">
        Offene Anfragen [{offeneAnfragen.length}]
      </p>

      <div className="card-box">
        <div className="list-row list-header-row list-header-row--sticky grid-anfragen-offen">
          <span>ID</span>
          <span>Name</span>
          <span>Objekt</span>
          <span>Zeitraum</span>
          <span>E-Mail</span>
          <span>Nachricht</span>
          <span></span>
        </div>

        <div className="scroll-box">
          {offeneAnfragen.length > 0 ? (
            offeneAnfragen.map((a) => {
              const historie = getGastHistorie(a.email);
              return (
                <div key={a.id} className="list-row grid-anfragen-offen">
                  <span className="res-id">#{a.id}</span>
                  <span className="res-name">
                    {a.name}{" "}
                    {historie.hatGebucht && (
                      <span
                        className="stammgast-star"
                        title={`Stammgast (${historie.count} bisherige Buchung${historie.count > 1 ? "en" : ""})`}
                      >
                        ⭐
                      </span>
                    )}
                  </span>
                  <span>
                    {a.Objekte?.name}
                    {a.ObjekteZusatz ? ` + ${a.ObjekteZusatz.name}` : ""}
                  </span>
                  <span>
                    {a.anreise} – {a.abreise}
                  </span>
                  <span>
                    {a.email}
                  </span>
                  {a.infos ? (
                    <span className="anfrage-nachricht-text" title={a.infos}>
                      {a.infos}
                    </span>
                  ) : (
                    <span className="anfrage-nachricht-empty">-</span>
                  )}
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-outline"
                      title="Details ansehen"
                      onClick={() => setSelectedAnfrageDetails(a)}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-ablehnen"
                      title="Anfrage ablehnen"
                      onClick={() => handleOpenAblehnenModal(a)}
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-annehmen"
                      title="Anfrage annehmen und Buchung erstellen"
                      onClick={() => handleOpenAnnehmenModal(a)}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state-row">
              {searchQuery.trim() !== ""
                ? "Keine offenen Anfragen für deine Suchanfrage gefunden."
                : "Aktuell keine offenen Anfragen."}
            </div>
          )}
        </div>
      </div>

      <p className="anfragen-section-title anfragen-section-title--secondary">
        {searchQuery.trim() !== "" ? "Entschiedene Anfragen " : "Entschiedene Anfragen der letzten 3 Tage "}
        [{letzteEntschiedene.length}]
      </p>

      <div className="card-box">
        <div className="list-row list-header-row list-header-row--sticky grid-anfragen-entschieden">
          <span>ID</span>
          <span>Name</span>
          <span>Objekt</span>
          <span>Zeitraum</span>
          <span>E-Mail</span>
          <span>Status</span>
          <span>Details</span>
        </div>

        <div className="scroll-box">
          {letzteEntschiedene.length > 0 ? (
            letzteEntschiedene.map((a) => {
              const historie = getGastHistorie(a.email);
              return (
                <div key={a.id} className="list-row grid-anfragen-entschieden">
                  <span className="res-id">#{a.id}</span>
                  <span className="res-name">
                    {a.name}{" "}
                    {historie.hatGebucht && (
                      <span
                        className="stammgast-star"
                        title={`Stammgast (${historie.count} bisherige Buchung${historie.count > 1 ? "en" : ""})`}
                      >
                        ⭐
                      </span>
                    )}
                  </span>
                  <span>
                    {a.Objekte?.name}
                    {a.ObjekteZusatz ? ` + ${a.ObjekteZusatz.name}` : ""}
                  </span>
                  <span>
                    {a.anreise} - {a.abreise}
                  </span>
                  <span>
                    {a.email}
                  </span>
                  <span className={`tag ${a.status}`}>{a.status}</span>
                  <span>
                    {a.status === "angenommen" ? (
                      <span className="anfrage-grund-text">angenommen am {formatZeitstempel(a.angenommen_am)}</span>
                    ) : (
                      <>
                        <span className="anfrage-grund-text anfrage-grund-text--block">
                          abgelehnt am {formatZeitstempel(a.abgelehnt_am)}
                        </span>
                        <span className="anfrage-grund-text anfrage-grund-text--italic">
                          „{a.ablehnungsgrund}“
                        </span>
                      </>
                    )}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="empty-state-row">
              {searchQuery.trim() !== ""
                ? "Keine entschiedenen Anfragen für deine Suchanfrage gefunden."
                : "Keine entschiedenen Anfragen in den letzten 3 Tagen."}
            </div>
          )}
        </div>
      </div>

      {selectedAnfrageDetails && (
        <div className="modal-backdrop">
          <div className="modal-content modal-details form-card">
            <div className="modal-header-flex">
              <h3 className="modal-header-title">Anfrage #{selectedAnfrageDetails.id}</h3>
              <span className="tag offen modal-header-tag">Offen</span>
            </div>

            {(() => {
              const historie = getGastHistorie(selectedAnfrageDetails.email);
              return (
                <div
                  className={`stammgast-banner ${
                    historie.hatGebucht ? "stammgast-banner--bekannt" : "stammgast-banner--neu"
                  }`}
                >
                  <span className="stammgast-banner-icon">{historie.hatGebucht ? "⭐" : "🆕"}</span>
                  <div>
                    <strong>{historie.hatGebucht ? "Bekannter Stammgast" : "Neuer Gast"}</strong>
                    <p className="stammgast-banner-desc">
                      {historie.hatGebucht
                        ? `Dieser Gast hat bereits ${historie.count} Buchung(en) in unserem System.`
                        : "Dieser Gast stellt zum ersten Mal eine Anfrage."}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="details-grid">
              <div className="detail-card-block">
                <h4 className="detail-block-title">Gästedaten</h4>
                <p className="detail-primary-text">{selectedAnfrageDetails.name}</p>
                <p className="detail-secondary-text detail-secondary-text--bold">
                  {selectedAnfrageDetails.erwachsene !== null ? (
                    <>
                      👥 {selectedAnfrageDetails.erwachsene ?? 0} Erwachsene
                      {selectedAnfrageDetails.kinder ? ` · ${selectedAnfrageDetails.kinder} Kind(er)` : ""}
                    </>
                  ) : null}
                </p>
                <p className="detail-secondary-text">✉ {selectedAnfrageDetails.email}</p>
                <p className="detail-secondary-text">📞 {selectedAnfrageDetails.telnr || "Keine Telefonnummer"}</p>
                <p className="detail-address-divider">
                  📍 {selectedAnfrageDetails.strasse} {selectedAnfrageDetails.hnr}, {selectedAnfrageDetails.plz}{" "}
                  {selectedAnfrageDetails.stadt}, {selectedAnfrageDetails.land?.toUpperCase()}
                </p>
              </div>

              <div className="detail-card-block">
                <h4 className="detail-block-title">Objekt & Zeitraum</h4>
                <p className="detail-primary-text">{selectedAnfrageDetails.Objekte?.name}</p>
                {selectedAnfrageDetails.ObjekteZusatz && (
                  <p className="detail-secondary-text detail-secondary-text--bus">
                    + Mitgebuchter Bus: {selectedAnfrageDetails.ObjekteZusatz.name}
                  </p>
                )}
                <p className="detail-primary-text detail-primary-text--spaced">
                  📅 {selectedAnfrageDetails.anreise} bis {selectedAnfrageDetails.abreise}
                </p>
              </div>

              <div className="detail-card-block-full detail-card-block-full--compact">
                <h4 className="detail-block-title">Nachricht / Notiz vom Gast</h4>
                <p
                  className={`detail-primary-text detail-nachricht-text ${
                    selectedAnfrageDetails.infos ? "" : "detail-nachricht-text--empty"
                  }`}
                >
                  {selectedAnfrageDetails.infos || "Keine Nachricht hinterlegt."}
                </p>
              </div>
            </div>

            <div className="modal-footer-flex modal-footer-flex--spaced">
              <button
                type="button"
                className="btn-outline btn-close-modal"
                onClick={() => setSelectedAnfrageDetails(null)}
              >
                Schließen
              </button>

              <div className="modal-footer-right">
                <button
                  type="button"
                  className="btn-delete-modal"
                  onClick={() => handleOpenAblehnenModal(selectedAnfrageDetails)}
                >
                  Ablehnen
                </button>

                <button
                  type="button"
                  className="btn-primary btn-annehmen"
                  onClick={() => handleOpenAnnehmenModal(selectedAnfrageDetails)}
                >
                  Annehmen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {annehmenAnfrage && (
        <div className="modal-backdrop">
          <div className="modal-content form-card modal-card--sm">
            <h3>Anfrage #{annehmenAnfrage.id} annehmen</h3>
            <p className="modal-delete-text modal-subtext--spaced">
              Erstellt eine Buchung für {annehmenAnfrage.name} ({annehmenAnfrage.Objekte?.name}
              {annehmenAnfrage.ObjekteZusatz ? ` + ${annehmenAnfrage.ObjekteZusatz.name}` : ""}).
            </p>

            <div className="form-grid form-grid--spaced">
              <div className="input-group">
                <label>Automatischer Vorschlag (€)</label>
                <input type="text" disabled className="select-disabled-mock" value={annehmenBasisPreis.toFixed(2)} />
              </div>

              <div className="input-group">
                <label>Rabatt (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  value={annehmenRabattProzent}
                  onChange={handleAnnehmenRabattChange}
                />
              </div>

              <div className="input-group full-width">
                <label>Endpreis (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={annehmenPreis}
                  onChange={handleAnnehmenPreisChange}
                />
                <span className="input-help-text">
                  Wird bei Rabatt-Änderung automatisch angepasst, kann aber manuell überschrieben werden.
                </span>
                {annehmenPreisWurdeGeaendert && (
                  <span className="input-help-text">
                    Der Gast wird über die Preisänderung nicht automatisch benachrichtigt - bitte bei Bedarf selbst informieren.
                  </span>
                )}
              </div>
            </div>

            <div className="wizard-actions wizard-actions--spaced">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setAnnehmenAnfrage(null)}
                disabled={verarbeiteId === annehmenAnfrage.id}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAnnehmenBestaetigen}
                disabled={verarbeiteId === annehmenAnfrage.id}
              >
                {verarbeiteId === annehmenAnfrage.id ? "Erstellt Buchung..." : "Buchung erstellen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {ablehnenAnfrage && (
        <div className="modal-backdrop">
          <div className="modal-content form-card modal-card--sm">
            <h3>Anfrage #{ablehnenAnfrage.id} ablehnen</h3>
            <p className="modal-delete-text modal-subtext--spaced">
              Bitte einen Grund angeben - dieser wird dauerhaft mit der Anfrage gespeichert.
            </p>
            <div className="input-group full-width input-group--spaced">
              <label>Ablehnungsgrund *</label>
              <textarea
                rows={3}
                autoFocus
                placeholder="z.B. Objekt im Zeitraum bereits anderweitig reserviert"
                value={ablehnungsgrund}
                onChange={(e) => setAblehnungsgrund(e.target.value)}
              />
            </div>
            <div className="wizard-actions wizard-actions--spaced">
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setAblehnenAnfrage(null);
                  setAblehnungsgrund("");
                }}
                disabled={verarbeiteId === ablehnenAnfrage.id}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAblehnenBestaetigen}
                disabled={verarbeiteId === ablehnenAnfrage.id}
              >
                {verarbeiteId === ablehnenAnfrage.id ? "Speichert..." : "Ablehnen bestätigen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {angenommeneBuchungErfolg && (
        <div className="modal-backdrop">
          <div className="modal-content form-card modal-card--sm">
            <div className="anfragen-success-content">
              <div className="anfragen-success-icon">✓</div>
              <h3 className="anfragen-success-title">Anfrage erfolgreich angenommen!</h3>
              <p className="anfragen-success-desc">
                Die Buchung für <strong>{angenommeneBuchungErfolg.gastName}</strong> wurde erstellt.
                Sie können die Dokumente jetzt direkt herunterladen und dem Gast zukommen lassen.
              </p>

              <div className="anfragen-success-actions">
                {angenommeneBuchungErfolg.buchungId && (
                  <button
                    type="button"
                    className="btn-primary buchungsbestaetigung"
                    onClick={() =>
                      window.open(`${BUCHUNGEN_API}/${angenommeneBuchungErfolg.buchungId}/pdf`, "_blank")
                    }
                  >
                    Buchungsbestätigung (PDF)
                  </button>
                )}

                {angenommeneBuchungErfolg.rechnungId && (
                  <button
                    type="button"
                    className="btn-primary rechnung"
                    onClick={() =>
                      window.open(`${RECHNUNGEN_API}/${angenommeneBuchungErfolg.rechnungId}/pdf`, "_blank")
                    }
                  >
                    Rechnung (PDF)
                  </button>
                )}

                <button
                  type="button"
                  className="btn-outline"
                  style={{ marginTop: "12px" }}
                  onClick={() => setAngenommeneBuchungErfolg(null)}
                >
                  Fertig / Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}