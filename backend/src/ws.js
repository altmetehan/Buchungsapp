import { WebSocketServer } from "ws";

/**
 * ws.js
 * -----
 * Zentrale WebSocket-Verwaltung für das Backend: Sobald eine Route
 * Daten ändert (Buchung angelegt, Anfrage angenommen, Gast gelöscht,
 * ...), ruft sie am Ende broadcast(...) auf, und jeder gerade
 * verbundene Client bekommt sofort Bescheid, statt sich die Änderung
 * per Polling selbst erfragen zu müssen.
 *
 * Bewusst simpel gehalten: ein gemeinsamer Kanal für alle Clients,
 * keine Authentifizierung, keine einzelnen "Räume" pro Nutzer. Für
 * eine interne Verwaltungsoberfläche mit einer Handvoll gleichzeitiger
 * Personen ist das ausreichend - jeder darf ohnehin dieselben Daten
 * sehen.
 */

/**
 * Der aktive WebSocket-Server, oder null, solange initWebSocket() noch
 * nicht aufgerufen wurde.
 * @type {import("ws").WebSocketServer | null}
 */
let wss = null;

/**
 * Hängt den WebSocket-Server an einen bestehenden HTTP-Server und
 * richtet einen periodischen Ping/Pong-Heartbeat ein, um tote
 * Verbindungen zu erkennen. Muss genau einmal beim Serverstart
 * aufgerufen werden, mit dem rohen HTTP-Server (nicht der
 * Express-App selbst!) als Argument - siehe server.js. Der
 * WebSocket-Server hängt sich dadurch an denselben Port wie die
 * normale REST-API, es muss also nichts an Firewall/CORS zusätzlich
 * freigeschaltet werden.
 *
 * @param {import("http").Server} httpServer - der rohe HTTP-Server aus server.js
 * @returns {void}
 */
export function initWebSocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket) => {
    console.log("WebSocket: neuer Client verbunden");

    // Ping/Pong-Herzschlag: ohne den würde eine Verbindung, die z.B.
    // durch einen Laptop-Standby oder einen WLAN-Wackler tot ist, im
    // Backend trotzdem ewig als "offen" geführt werden - broadcast()
    // würde dann sinnlos versuchen, an einen längst verschwundenen
    // Client zu senden. Antwortet ein Client zweimal hintereinander
    // (60 Sekunden) nicht mehr auf den Ping, wird die Verbindung hart
    // gekappt.
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("close", () => {
      console.log("WebSocket: Client getrennt");
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (socket.isAlive === false) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  // Falls der WebSocket-Server selbst mal geschlossen wird (z.B. beim
  // sauberen Herunterfahren), den Heartbeat-Timer nicht als Zombie
  // weiterlaufen lassen.
  wss.on("close", () => clearInterval(heartbeatInterval));
}

/**
 * Schickt ein Event an alle aktuell verbundenen Clients raus.
 *
 * Ist "wss" noch gar nicht initialisiert (z.B. weil eine Route in
 * einem Test ohne echten Server aufgerufen wird), passiert einfach
 * nichts - broadcast() soll niemals selbst der Grund sein, warum ein
 * eigentlich erfolgreicher API-Request mit einem 500er fehlschlägt.
 *
 * @param {string} type - Event-Name, z.B. "buchungen:changed", "anfragen:changed"
 * @param {object} [payload={}] - optionale Zusatzinfo (z.B. die betroffene ID) - aktuell ungenutzt vom Frontend, das lädt bei jedem Event einfach komplett neu, steht aber schon bereit für später
 * @returns {void}
 */
export function broadcast(type, payload = {}) {
  if (!wss) return;

  const message = JSON.stringify({ type, payload });

  wss.clients.forEach((socket) => {
    // readyState 1 = OPEN. Clients, die gerade erst verbinden (0) oder
    // schon am Abbauen sind (2/3), werden übersprungen statt einen
    // Fehler zu werfen.
    if (socket.readyState === 1) {
      socket.send(message);
    }
  });
}