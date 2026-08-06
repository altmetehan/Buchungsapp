import { useEffect, useRef } from "react";

const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

// ─── EINE GEMEINSAME VERBINDUNG FÜR DIE GANZE APP ───
// Diese drei Variablen leben bewusst außerhalb der Hook-Funktion, auf
// Modul-Ebene - sie existieren also nur ein einziges Mal, egal wie oft
// useWebSocket() in verschiedenen Komponenten aufgerufen wird. Ohne das
// würde z.B. das Dashboard und gleichzeitig die Sidebar (wegen des
// Anfragen-Badges) je eine eigene WebSocket-Verbindung zum selben
// Server aufmachen.
let socket = null;
let reconnectTimer = null;
const listenersByEvent = new Map(); // "buchungen:changed" -> Set<callback>

/**
 * Öffnet die gemeinsame Verbindung (falls noch keine offen/im Aufbau
 * ist) und verteilt eingehende Nachrichten an die passenden Abonnenten.
 */
function getSharedSocket() {
  const bereitsVerbunden =
    socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING);
  if (bereitsVerbunden) return socket;

  socket = new WebSocket(WS_URL);

  socket.addEventListener("message", (event) => {
    let nachricht;
    try {
      nachricht = JSON.parse(event.data);
    } catch (err) {
      console.error("useWebSocket: Nachricht konnte nicht gelesen werden:", err);
      return;
    }

    const { type, payload } = nachricht;
    const abonnenten = listenersByEvent.get(type);
    if (!abonnenten) return; // niemand hört gerade auf dieses Event - einfach ignorieren

    abonnenten.forEach((callback) => callback(payload));
  });

  // Verbindung verloren (Server neu gestartet, kurzer Netzwerk-Hänger,
  // Laptop aus dem Standby geholt, ...) - nach 3 Sekunden automatisch
  // einen neuen Verbindungsversuch starten, statt dass die Live-
  // Aktualisierung stillschweigend für den Rest der Session tot ist.
  socket.addEventListener("close", () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      socket = null;
      getSharedSocket();
    }, 3000);
  });

  socket.addEventListener("error", () => {
    socket.close();
  });

  return socket;
}

/**
 * useWebSocket
 * ------------
 * Abonniert ein bestimmtes Event vom Backend (z.B. "buchungen:changed")
 * und ruft "onEvent" jedes Mal auf, wenn der Server dieses Event
 * broadcastet - siehe backend/src/ws.js für die Gegenseite.
 *
 * Verwendung:
 *   useWebSocket("anfragen:changed", () => ladeAnfragen(false));
 *
 * @param {string} eventType - z.B. "buchungen:changed", "anfragen:changed", "gaeste:changed", "objekte:changed", "rechnungen:changed"
 * @param {(payload: any) => void} onEvent - wird bei jedem passenden Event aufgerufen
 */
export function useWebSocket(eventType, onEvent) {
  // Über eine Ref immer die neueste Version von "onEvent" greifbar
  // halten, ohne dass sich die Abo-Liste bei jedem Render der
  // aufrufenden Komponente neu aufbauen muss.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    getSharedSocket();

    const callback = (payload) => onEventRef.current(payload);

    if (!listenersByEvent.has(eventType)) {
      listenersByEvent.set(eventType, new Set());
    }
    listenersByEvent.get(eventType).add(callback);

    // Beim Unmount nur den eigenen Listener wieder austragen - die
    // gemeinsame Verbindung selbst bleibt bestehen, weil ja evtl. noch
    // andere Komponenten darauf angewiesen sind.
    return () => {
      listenersByEvent.get(eventType)?.delete(callback);
    };
  }, [eventType]);
}