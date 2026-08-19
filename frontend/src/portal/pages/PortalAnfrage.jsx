import { usePortalAnfrage } from "../../hooks/usePortalAnfrage";
import { PortalAnfrageSchritt1 } from "../components/PortalAnfrageSchritt1";
import { PortalAnfrageSchritt2 } from "../components/PortalAnfrageSchritt2";
import { Toast } from "../../components/ui/Toast";

import "../../styles/shared-ui.css";
import "../../styles/fullcalendar-theme.css";
import "../../styles/pageStyles/Buchen.css";

/**
 * @file PortalAnfrage.jsx
 * @description Öffentliche Seite zur Erfassung von Buchungsanfragen für externe Interessenten.
 *              Steuert den zweistufigen Anfrageprozess (Schritt 1: Objekt-, Zeit- und Busauswahl;
 *              Schritt 2: Kontaktdaten, Personenanzahl und Notizen) basierend auf dem `usePortalAnfrage`-ViewModel.
 * @module portal/pages/PortalAnfrage
 */

/**
 * PortalAnfrage-Seitenkomponente.
 *
 * @component
 * @returns {JSX.Element} Der gerenderte 2-Schritte-Anfrage-Wizard inklusive Toast-Meldungen.
 */
export function PortalAnfrage() {
  /**
   * Zentraler ViewModel-State und Aktions-Handler für das öffentliche Buchungsportal.
   */
  const vm = usePortalAnfrage();

  let inhalt;
  if (vm.apiLoading) {
    inhalt = <div style={{ padding: "24px" }}>Lade Verfügbarkeiten...</div>;
  } else if (vm.apiError) {
    inhalt = <div style={{ padding: "24px", color: "#e30000" }}>{vm.apiError}</div>;
  } else if (vm.wizardStep === 1) {
    inhalt = <PortalAnfrageSchritt1 vm={vm} />;
  } else {
    inhalt = <PortalAnfrageSchritt2 vm={vm} />;
  }

  return (
    <>
      <Toast toast={vm.toast} onClose={vm.dismissToast} />
      {inhalt}
    </>
  );
}

export default PortalAnfrage;