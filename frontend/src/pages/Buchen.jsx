import { useBuchungsAssistent } from "../hooks/useBuchungsAssistent";
import { BuchenSchritt1 } from "../components/booking/BuchenSchritt1";
import { BuchenSchritt2 } from "../components/booking/BuchenSchritt2";
import { BuchenSchritt3 } from "../components/booking/BuchenSchritt3";
import { Toast } from "../components/ui/Toast";

import "../styles/shared-ui.css";
import "../styles/fullcalendar-theme.css";
import "../styles/pageStyles/Buchen.css";

/**
 * @file Buchen.jsx
 * @description Zentraler Einstiegspunkt und Steuerungskomponente für den mehrstufigen
 *              Buchungs-Wizard (Assistenten). Delegiert die Geschäftslogik an das ViewModel
 *              `useBuchungsAssistent` und rendert die Schritte 1 (Objekt/Zeitraum), 2 (Zusatzbus/Optionen)
 *              oder 3 (Gästestammdaten/Abschluss) sowie das Erfolgs-Modal mit PDF-Exporten.
 * @module pages/Buchen
 */

/** API-Endpunkt für Buchungsoperationen und PDF-Generierung */
const BUCHUNGEN_API = "/api/buchungen";

/** API-Endpunkt für Rechnungsoperationen und PDF-Generierung */
const RECHNUNGEN_API = "/api/rechnungen";

/**
 * Buchen-Seitenkomponente.
 *
 * @component
 * @returns {JSX.Element} Der gerenderte Buchungs-Wizard mit Toast- und Erfolgsmodal-Overlays.
 */
export function Buchen() {
  /**
   * ViewModel-State und Handler des Buchungsassistenten.
   */
  const vm = useBuchungsAssistent();

  let inhalt;
  if (vm.apiLoading) {
    inhalt = <div style={{ padding: "24px" }}>Lade Buchungssystem-Stammdaten...</div>;
  } else if (vm.apiError) {
    inhalt = <div style={{ padding: "24px", color: "#e30000" }}>{vm.apiError}</div>;
  } else if (!vm.istNeueBuchungRoute) {
    inhalt = <BuchenSchritt1 vm={vm} />;
  } else if (vm.wizardStep === 2) {
    inhalt = <BuchenSchritt2 vm={vm} />;
  } else if (vm.wizardStep === 3) {
    inhalt = <BuchenSchritt3 vm={vm} />;
  }

  return (
    <>
      <Toast toast={vm.toast} onClose={vm.dismissToast} />
      {inhalt}

      {/* Erfolgs-Modal mit PDF-Download-Optionen */}
      {vm.angenommeneBuchungErfolg && (
        <div className="modal-backdrop">
          <div className="modal-content form-card modal-card--sm">
            <div className="anfragen-success-content">
              <div className="anfragen-success-icon">✓</div>
              <h3 className="anfragen-success-title">Buchung erfolgreich abgeschlossen!</h3>
              <p className="anfragen-success-desc">
                Die Buchung für <strong>{vm.angenommeneBuchungErfolg.gastName}</strong> wurde erfasst.
                {vm.angenommeneBuchungErfolg.rechnungsNummer && (
                  <> Die Information für die Buchhaltung <strong>{vm.angenommeneBuchungErfolg.rechnungsNummer}</strong> wurde automatisch erstellt. </>
                )}
                <br />
                Sie können die Dokumente jetzt direkt herunterladen.
              </p>

              <div className="anfragen-success-actions">
                {vm.angenommeneBuchungErfolg.buchungId && (
                  <button
                    type="button"
                    className="btn-primary buchungsbestaetigung"
                    onClick={() =>
                      window.open(`${BUCHUNGEN_API}/${vm.angenommeneBuchungErfolg.buchungId}/pdf`, "_blank")
                    }
                  >
                    Buchungsbestätigung (PDF)
                  </button>
                )}

                {vm.angenommeneBuchungErfolg.rechnungId && (
                  <button
                    type="button"
                    className="btn-primary rechnung"
                    onClick={() =>
                      window.open(`${RECHNUNGEN_API}/${vm.angenommeneBuchungErfolg.rechnungId}/pdf`, "_blank")
                    }
                  >
                    Information für die Buchhaltung (PDF)
                  </button>
                )}

                <button
                  type="button"
                  className="btn-outline"
                  style={{ marginTop: "12px" }}
                  onClick={vm.resetAssistent}
                >
                  Fertig / Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}