import express from "express";
import cors from "cors";
import { createServer } from "http";

import gaesteRoutes from "./routes/gaeste.routes.js";
import buchungenRoutes from "./routes/buchungen.routes.js";
import objekteRoutes from "./routes/objekte.routes.js";
import rechnungenRoutes from "./routes/rechnungen.routes.js";
import einstellungenRoutes from "./routes/einstellungen.routes.js";
import anfragenRoutes from "./routes/anfragen.routes.js";
import { initWebSocket } from "./ws.js";

/**
 * server.js
 * ---------
 * Einstiegspunkt des Express-Backends. Startet auf Port 3001 und
 * bindet die Ressourcen-Router ein (Gäste, Buchungen, Objekte,
 * Rechnungen, Einstellungen, Anfragen) - die eigentliche
 * Geschäftslogik jedes Endpunkts steckt in der jeweiligen Datei unter
 * routes/.
 *
 * Express läuft hier bewusst nicht über app.listen() direkt, sondern
 * über einen explizit erzeugten http.Server (createServer(app)):
 * WebSockets brauchen Zugriff auf den rohen HTTP-Server (den Teil, der
 * die Netzwerkverbindung offen hält), nicht auf die Express-App selbst
 * - Express reicht Requests intern sowieso an so einen Server durch.
 * Indem der Server hier selbst erzeugt wird, kann er zusätzlich an
 * initWebSocket() übergeben werden, und WebSocket + REST-API laufen
 * huckepack auf demselben Port 3001 - für den Client ändert sich
 * dadurch nichts an der Adresse, nur das Protokoll (ws:// statt
 * http://) kommt dazu.
 *
 * Start: `node src/server.js` im backend-Ordner.
 */

/** Express-App-Instanz - hält Middleware und Router-Registrierungen. */
const app = express();

/** Fester Port für REST-API und WebSocket (siehe Datei-Kommentar oben). */
const PORT = 3001;

// Erlaubt Cross-Origin-Requests vom Frontend (Vite-Dev-Server / nginx).
app.use(cors());
// Parst eingehende JSON-Bodies automatisch in req.body.
app.use(express.json());

// --- Ressourcen-Router einbinden ---
// Jede Zeile bindet einen fachlichen Bereich unter seinem eigenen
// "/api/..."-Präfix ein. Die eigentliche Logik (GET/POST/PUT/DELETE)
// steckt jeweils in der importierten Router-Datei.
app.use("/api/gaeste", gaesteRoutes);
app.use("/api/buchungen", buchungenRoutes);
app.use("/api/objekte", objekteRoutes);
app.use("/api/rechnungen", rechnungenRoutes);
app.use("/api/einstellungen", einstellungenRoutes);
app.use("/api/anfragen", anfragenRoutes);

// Roher HTTP-Server, auf dem Express UND der WebSocket-Server
// gemeinsam laufen (siehe Datei-Kommentar oben).
const httpServer = createServer(app);
initWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend läuft auf http://localhost:${PORT} (inkl. WebSocket)`);
});