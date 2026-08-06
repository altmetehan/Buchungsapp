import { useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";

import "./styles/reset.css";
import "./styles/layout.css";

import beckhoffLogo from "./assets/logoschwarz.png";

import { PortalKalender } from "./portal/pages/PortalKalender";
import { PortalAnfrage } from "./portal/pages/PortalAnfrage";

/** Bewusst nur zwei Punkte - mehr soll ein Besucher hier nicht sehen. */
const PORTAL_NAV_ITEMS = [
  { label: "Verfügbarkeit", path: "/portal/kalender" },
  { label: "Anfrage stellen", path: "/portal/anfrage" },
];

/**
 * PortalApp
 * ---------
 * Die öffentliche, nach außen gerichtete Seite für Interessenten - hat
 * BEWUSST ihr eigenes, unabhängiges Sidebar-Layout (nicht das aus
 * AdminApp.jsx), damit hier niemals versehentlich interne Menüpunkte
 * (Gäste, Rechnungen, ...) auftauchen können. Nutzt dieselben
 * CSS-Klassen aus layout.css/shared-ui.css wie der Admin-Bereich
 * (gleiche Optik/Designsprache), aber mit einem komplett eigenen,
 * sehr kurzen Menü - fühlt sich dadurch wie eine eigenständige Seite
 * an, sieht aber trotzdem konsistent nach "Beckhoff" aus.
 */
export function PortalApp() {
  // RESPONSIVE: siehe AdminApp.jsx - dieselbe Logik für den öffentlichen Bereich.
  const [isCollapsed, setIsCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 900,
  );

  return (
    <div className="app-container">
      {/* RESPONSIVE: siehe AdminApp.jsx - identisches Overlay-Muster für
          den öffentlichen Bereich. */}
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
          <button className="toggle-button" onClick={() => setIsCollapsed(!isCollapsed)}>
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </button>
        </div>

        {!isCollapsed && (
          <>
            <nav className="nav-links">
              <div className="nav-section">
                <div className="nav-section-title">Buchungsportal</div>
                {PORTAL_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className="nav-button"
                    onClick={() => {
                      if (window.innerWidth <= 1200) setIsCollapsed(true);
                    }}
                  >
                    <span className="bullet-dot">•</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>

            {/* SWITCH-BUTTON ZUR ADMIN-ANSICHT */}
            <div className="sidebar-footer">
              <NavLink
                to="/dashboard"
                className="nav-button"
                style={{
                  fontWeight: "600",
                  color: "#dc2626",
                }}
                onClick={() => {
                  if (window.innerWidth <= 1200) setIsCollapsed(true);
                }}
              >
                <span className="bullet-dot">🔒</span>
                Zur Admin-Ansicht
              </NavLink>
            </div>
          </>
        )}
      </aside>

      <main className="main-content">
        <Routes>
          <Route index element={<Navigate to="kalender" replace />} />
          <Route path="kalender" element={<PortalKalender />} />
          <Route path="anfrage" element={<PortalAnfrage />} />
          <Route path="*" element={<Navigate to="kalender" replace />} />
        </Routes>
      </main>
    </div>
  );
}