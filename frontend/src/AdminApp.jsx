import { useState, useEffect, useCallback } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useWebSocket } from "./hooks/useWebSocket";

import "./styles/reset.css";
import "./styles/layout.css";

import beckhoffLogo from "./assets/logoschwarz.png";

import { Dashboard } from "./pages/Dashboard";
import { Reservierungen } from "./pages/Reservierungen";
import { Gaeste } from "./pages/Gaeste";
import { Buchen } from "./pages/Buchen";
import { Kalender } from "./pages/Kalender";
import { Rechnungen } from "./pages/Rechnungen";
import { Objekte } from "./pages/Objekte";
import { Einstellungen } from "./pages/Einstellungen";
import { Anfragen } from "./pages/Anfragen";

const ANFRAGEN_API = "/api/anfragen";

/**
 * Gruppierte Menüstruktur für eine saubere visuelle Hierarchie.
 */
const NAV_SECTIONS = [
  {
    title: "Übersicht",
    items: [
      { label: "Dashboard", path: "/dashboard" },
      { label: "Buchen", path: "/buchen" },
      { label: "Kalender", path: "/kalender" },
    ],
  },
  {
    title: "Vorgänge",
    items: [
      { label: "Anfragen", path: "/anfragen" },
      { label: "Reservierungen", path: "/reservierungen" },
      { label: "Rechnungen", path: "/rechnungen" },
    ],
  },
  {
    title: "Stammdaten",
    items: [
      { label: "Gäste", path: "/gaeste" },
      { label: "Objekte", path: "/objekte" },
    ],
  },
];

export function AdminApp() {
  // RESPONSIVE: bis 1200px startet die Sidebar eingeklappt (nur
  // Logo + Burger-Menü sichtbar), ab 1200px (Desktop) wie bisher
  // ausgeklappt. Deckt damit auch iPad im Querformat (~1024-1194px) ab.
  // Ohne das würde die App auf einem Tablet beim allerersten Öffnen
  // sofort mit einem Vollbild-Menü-Overlay über dem Dashboard starten.
  const [isCollapsed, setIsCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 1200,
  );
  const [offeneAnfragenAnzahl, setOffeneAnfragenAnzahl] = useState(0);

  // ─── ANZAHL DER OFFENEN ANFRAGEN LADEN ───
  const ladeOffeneAnfragenCount = useCallback(async () => {
    try {
      const response = await fetch(ANFRAGEN_API);
      if (!response.ok) return;
      const data = await response.json();
      const anzahl = data.filter((a) => a.status === "offen").length;
      setOffeneAnfragenAnzahl(anzahl);
    } catch (err) {
      console.error("AdminApp: Fehler beim Laden der Anfragen-Anzahl:", err);
    }
  }, []);

  useEffect(() => {
    ladeOffeneAnfragenCount();
  }, [ladeOffeneAnfragenCount]);

  // Der Server meldet sich aktiv über den WebSocket, sobald irgendwo
  // eine neue Anfrage reinkommt oder eine bestehende angenommen/
  // abgelehnt wird - das rote Badge hier in der Sidebar aktualisiert
  // sich dadurch nahezu in Echtzeit.
  useWebSocket("anfragen:changed", ladeOffeneAnfragenCount);

  return (
    <div className="app-container">
      {/* RESPONSIVE: abgedunkelter Hintergrund hinter der ausgeklappten
          Sidebar - existiert nur im DOM, während die Sidebar offen ist,
          und ist per CSS (layout.css) ohnehin nur unter 900px sichtbar.
          Klick irgendwo daneben schließt das Menü wieder, genau wie man
          es von mobilen App-Menüs gewohnt ist. */}
      {!isCollapsed && (
        <div className="mobile-sidebar-backdrop" onClick={() => setIsCollapsed(true)} />
      )}
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          {!isCollapsed && (
            <div className="logo">
              <img src={beckhoffLogo} alt="Beckhoff Logo" className="logo-img" />
            </div>
          )}
          
          {/* Drei-Striche-Button mit rotem Counter-Badge (auch bei zugeklappter Sidebar sichtbar) */}
          <button
            className="toggle-button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ position: "relative" }}
            title={offeneAnfragenAnzahl > 0 ? `${offeneAnfragenAnzahl} offene Anfrage(n)` : "Menü einklappen"}
          >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>

            {offeneAnfragenAnzahl > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: "bold",
                  borderRadius: "50%",
                  minWidth: "16px",
                  height: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  lineHeight: 1,
                }}
              >
                {offeneAnfragenAnzahl}
              </span>
            )}
          </button>
        </div>

        {!isCollapsed && (
          <>
            <nav className="nav-links">
              {NAV_SECTIONS.map((section, idx) => (
                <div key={section.title} className="nav-section">
                  {idx > 0 && <div className="nav-divider" />}
                  <div className="nav-section-title">{section.title}</div>
                  {section.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className="nav-button"
                      style={{ display: "flex", alignItems: "center" }}
                      // RESPONSIVE: auf Tablet/Handy liegt die Sidebar als
                      // Overlay über der Seite - nach der Navigation soll
                      // sie sich von selbst wieder schließen, statt dass
                      // der Nutzer sie jedes Mal manuell zuklappen muss.
                      // Auf Desktop (>1200px) greift window.innerWidth hier
                      // nicht ein, weil die Sidebar dort ohnehin nur Platz
                      // "verschiebt" statt etwas zu verdecken.
                      onClick={() => {
                        if (window.innerWidth <= 1200) setIsCollapsed(true);
                      }}
                    >
                      <span className="bullet-dot">•</span>
                      <span style={{ flex: 1 }}>{item.label}</span>

                      {/* Kleines Badge neben dem Menüpunkt "Anfragen" */}
                      {item.path === "/anfragen" && offeneAnfragenAnzahl > 0 && (
                        <span
                          style={{
                            backgroundColor: "#ef4444",
                            color: "#ffffff",
                            fontSize: "11px",
                            fontWeight: "bold",
                            borderRadius: "10px",
                            padding: "2px 7px",
                            marginLeft: "auto",
                          }}
                        >
                          {offeneAnfragenAnzahl}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>

            <div className="sidebar-footer">
              <NavLink
                to="/einstellungen"
                className="nav-button"
                onClick={() => {
                  if (window.innerWidth <= 1200) setIsCollapsed(true);
                }}
              >
                <span className="bullet-dot">⚙</span>
                Einstellungen
              </NavLink>
              {/* SWITCH BUTTON ZUR GÄSTEANSICHT */}
              <NavLink
                to="/portal"
                className="nav-button"
                style={{
                  marginTop: "6px",
                  backgroundColor: "#rgba(0, 0, 0, 0.05)",
                  fontWeight: "600",
                  color: "#2563eb",
                }}
                onClick={() => {
                  if (window.innerWidth <= 1200) setIsCollapsed(true);
                }}
              >
                <span className="bullet-dot">🌐</span>
                Gäste Ansicht
              </NavLink>
            </div>
          </>
        )}
      </aside>

      <main className="main-content">
        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="buchen/*" element={<Buchen />} />
          <Route path="anfragen" element={<Anfragen />} />
          <Route path="reservierungen" element={<Reservierungen />} />
          <Route path="rechnungen" element={<Rechnungen />} />
          <Route path="kalender" element={<Kalender />} />
          <Route path="gaeste" element={<Gaeste />} />
          <Route path="objekte" element={<Objekte />} />
          <Route path="einstellungen" element={<Einstellungen />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}