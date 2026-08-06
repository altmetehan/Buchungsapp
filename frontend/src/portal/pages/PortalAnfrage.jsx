import { usePortalAnfrage } from "../../hooks/usePortalAnfrage";
import { PortalAnfrageSchritt1 } from "../components/PortalAnfrageSchritt1";
import { PortalAnfrageSchritt2 } from "../components/PortalAnfrageSchritt2";
import { Toast } from "../../components/ui/Toast";

import "../../styles/shared-ui.css";
import "../../styles/fullcalendar-theme.css";
import "../../styles/pageStyles/Buchen.css";

/**
 * PortalAnfrage
 * -------------
 * Seiten-Komponente für die öffentliche 2-Schritte-Anfrage-Seite.
 * Exakt dasselbe Architektur-Muster wie pages/Buchen.jsx: die
 * komplette Logik steckt im usePortalAnfrage()-Hook, diese Datei
 * entscheidet nur noch, welcher der zwei Schritte angezeigt wird.
 *
 * @returns {JSX.Element}
 */
export function PortalAnfrage() {
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