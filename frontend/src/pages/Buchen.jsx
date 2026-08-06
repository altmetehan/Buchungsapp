import { useBuchungsAssistent } from "../hooks/useBuchungsAssistent";
import { BuchenSchritt1 } from "../components/booking/BuchenSchritt1";
import { BuchenSchritt2 } from "../components/booking/BuchenSchritt2";
import { BuchenSchritt3 } from "../components/booking/BuchenSchritt3";
import { Toast } from "../components/ui/Toast";

import "../styles/shared-ui.css";
import "../styles/fullcalendar-theme.css";
import "../styles/pageStyles/Buchen.css";

const BUCHUNGEN_API = "/api/buchungen";
const RECHNUNGEN_API = "/api/rechnungen";

/**
 * Buchen
 * ------
 * Seiten-Komponente für den kompletten Buchungs-Assistenten. Diese
 * Datei macht bewusst fast nichts selbst: sie holt den gesamten
 * Zustand und die Geschäftslogik aus useBuchungsAssistent() (dem
 * "View-Model") und entscheidet nur noch, welcher der drei Schritte
 * gerade angezeigt werden soll. Die Anzeige jedes Schritts steckt in
 * einer eigenen Komponente (BuchenSchritt1/2/3, alle unter
 * components/booking/).
 *
 * Der <Toast /> sitzt bewusst außerhalb der Lade-/Fehler-/Schritt-
 * Verzweigung, damit die Erfolgs-/Fehlermeldung beim Speichern
 * unabhängig davon sichtbar bleibt, was gerade darunter angezeigt wird
 * (z.B. nachdem der Assistent nach einer erfolgreichen Buchung schon
 * wieder auf Schritt 1 zurückgesprungen ist).
 *
 * @returns {JSX.Element}
 */
export function Buchen() {
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
                  <> Die Rechnung <strong>{vm.angenommeneBuchungErfolg.rechnungsNummer}</strong> wurde automatisch erstellt. </>
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
                    Rechnung (PDF)
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
