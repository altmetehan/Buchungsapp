import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
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
 * Gruppierte Menüstruktur für die Admin-Navigation
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
  const [isCollapsed, setIsCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 1200,
  );
  const [offeneAnfragenAnzahl, setOffeneAnfragenAnzahl] = useState(0);

  /**
   * Steuert die Sichtbarkeit des Profil-Flyouts oberhalb des Benutzernamens.
   * @type {[boolean, Function]}
   */
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Schließt das Menü beim Klick außerhalb
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navigate = useNavigate();

  // Anzahl offener Anfragen laden
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

  // Live-Aktualisierung über WebSocket bei Anfragen-Änderungen
  useWebSocket("anfragen:changed", ladeOffeneAnfragenCount);

  /**
   * Führt den Logout aus und leitet den Nutzer zum öffentlichen Portal weiter.
   */
  const handleLogout = () => {
    setIsUserMenuOpen(false);
    navigate("/portal");
  };

  return (
    <div className="app-container">
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

          {/* Menü Toggle Button mit Zähler-Badge */}
          <button
            className="toggle-button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ position: "relative" }}
            title={offeneAnfragenAnzahl > 0 ? `${offeneAnfragenAnzahl} offene Anfrage(n)` : "Menü umschalten"}
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
                  onClick={() => {
                    if (window.innerWidth <= 1200) setIsCollapsed(true);
                  }}
                >
                  <span className="bullet-dot">•</span>
                  <span style={{ flex: 1 }}>{item.label}</span>

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

          {/* Eingeloggter Benutzer mit Aufklappfeld nach oben */}
          <div className="sidebar-user-wrapper" ref={userMenuRef}>
            {isUserMenuOpen && (
              <div className="sidebar-user-popover">
                <div className="sidebar-user-popover-info">
                  <div className="popover-name">Administrator</div>
                  <div className="popover-email">admin@system.local</div>
                </div>
                <div className="popover-divider" />
                <button
                  type="button"
                  className="popover-logout-btn"
                  onClick={handleLogout}
                >
                  <span>Abmelden</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className={`sidebar-user-button ${isUserMenuOpen ? "active" : ""}`}
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              title="Benutzerprofil anzeigen"
            >
              <div className="sidebar-user-avatar">M</div>
              {!isCollapsed && (
                <div className="sidebar-user-meta">
                  <span className="sidebar-user-name">Metehan</span>
                </div>
              )}
            </button>
          </div>
        </div>
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