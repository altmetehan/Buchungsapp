import { Routes, Route } from "react-router-dom";
import { AdminApp } from "./AdminApp";
import { PortalApp } from "./PortalApp";

/**
 * App
 * ----
 * Oberster Router der gesamten Anwendung: teilt bewusst in ZWEI
 * komplett getrennte "Unter-Apps" auf, die sich für den Besucher wie
 * zwei verschiedene Webseiten anfühlen sollen - jede mit eigenem
 * Sidebar-Layout:
 *
 * - "/portal/*"  -> PortalApp: die öffentliche Seite für Interessenten
 *                   (nur Kalender + Anfrage stellen, KEINE internen
 *                   Admin-Daten sichtbar oder erreichbar)
 * - alles andere -> AdminApp: die bisherige interne Verwaltungsoberfläche
 *
 * Die Aufteilung passiert HIER, ganz oben, bevor überhaupt irgendein
 * Sidebar-Layout gerendert wird.
 */
function App() {
  return (
    <Routes>
      <Route path="/portal/*" element={<PortalApp />} />
      <Route path="/*" element={<AdminApp />} />
    </Routes>
  );
}

export default App;