# 🏠 Beckhoff Verwaltungs- & Buchungssystem

Ein modernes, webbasiertes Buchungs- und Verwaltungssystem für Ferienwohnungen, Fahrzeuge (z. B. Vito Bus) und Veranstaltungsräume (z. B. Forum Beckhoff).

Das System bietet ein öffentliches Portal für Gastanfragen sowie ein internes Verwaltungs-Dashboard mit Echtzeit-Synchronisation, automatischer Preiskalkulation, PDF-Generierung und flexibler Kundenverwaltung.

---

## 🚀 Hauptfunktionen & Highlights

- **Intelligente Verfügbarkeitsprüfung:**
  - **Nächteweise Buchungen:** Für Wohnungen inkl. konfigurierbarer Mindestaufenthaltsdauer.
  - **Stundenbasierte Buchungen:** Für Fahrzeuge und Säle mit exakter Uhrzeit-Auswahl und automatischer Zeitanpassung im Dropdown.
  - **Kombibuchungen:** Gleichzeitige Buchung von Wohnung + Zusatzobjekt (z. B. Bus) mit automatischer Kombi-Rabattberechnung.

- **Zweistufiges Gästedaten-System (Spam-Schutz):**
  - `AnfrageGaeste`: Unverbindliche Anfragen aus dem öffentlichen Portal landen in einer separaten Tabelle, um die Haupt-Datenbank sauber zu halten.
  - **Übernahme in `Gaeste`:** Erst bei der Annahme einer Anfrage wird der Gast automatisch in den offiziellen Kundenstamm übernommen.

- **PDF-Generierung On-the-Fly:**
  - Dynamische Erstellung von **Buchungsbestätigungen** und **Rechnungen** direkt im Browser (ohne serverseitige Speicherung veralteter Dateien).
  - Rechnungen werden bei jedem Abruf frisch generiert – nachträgliche Preisanpassungen sind dadurch immer sofort korrekt sichtbar.

- **⚡ Echtzeit-Synchronisation via WebSocket:**
  - Neue Buchungen, Anfragen sowie Objekt- und Gaständerungen werden live an alle verbundenen Clients gepusht – kein Polling mehr nötig.
  - Ein rotes Badge in der Sidebar zeigt offene Anfragen in Echtzeit an.

- **💰 Preisanpassungs-Historie:**
  - Jede nachträgliche Preisänderung einer Buchung wird mit Grund und Zeitstempel dauerhaft protokolliert und ist in der Buchungskarte und auf der Rechnung nachvollziehbar.

- **🗑️ Soft-Delete für Gäste & Objekte:**
  - Gäste und Objekte werden beim Löschen nicht endgültig entfernt, solange noch aktive oder zukünftige Buchungen bestehen – verhindert inkonsistente Daten.

- **📅 Automatische Kalender-Legende:**
  - Jedes Objekt bekommt automatisch eine eigene, konsistente Farbe im Kalender (auch neu angelegte Objekte) – die Legende ist klickbar und filtert die Ansicht.

- **📱 Vollständig responsives Design:**
  - Sidebar-Overlay auf Tablet/Handy, horizontal scrollbare Tabellen und angepasste Formulare für jede Bildschirmgröße.

- **⚙️ Zentrale Einstellungen:**
  - Check-in-/Check-out-Zeit, Mindestaufenthalt für Wohnungen und Kombi-Rabatt für Zusatzbuchungen werden zentral gepflegt und wirken sich sofort überall in der App aus.

---

## 🛠️ Tech-Stack

| Bereich | Technologien |
|---|---|
| **Frontend** | React (Vite), React Router, FullCalendar, modulares CSS |
| **Backend** | Node.js, Express, Prisma ORM, SQLite (`better-sqlite3`) |
| **Echtzeit** | WebSocket (`ws`) |
| **PDF** | `@react-pdf/renderer` |
| **Deployment** | Docker (Multi-Stage-Build), nginx |

---

## 📁 Projektstruktur

```
Buchungsapp/
├── backend/                 # Express-API, Prisma-Schema, PDF-Generierung, WebSocket
├── frontend/                # React-App (Admin- und Portal-Bereich)
└── docker-compose.yml       # Startet Backend + Frontend zusammen
```

Details zu den einzelnen Unterordnern (Routen, Komponenten, Hooks, Styles) siehe die Kommentare am Kopf der jeweiligen Dateien – jede zentrale Datei ist dort kurz erklärt.

---

## ⚡ Setup

### Lokal (ohne Docker)

Voraussetzung: Node.js 20+

**Backend**

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
node src/server.js
```

Läuft danach auf `http://localhost:3001` (REST-API + WebSocket auf demselben Port).

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Läuft danach auf `http://localhost:5173` und leitet `/api` sowie `/ws` per Vite-Proxy an `localhost:3001` weiter.

### 🐳 Mit Docker

Voraussetzung: Docker Desktop

Im Projekt-Root (dort, wo `docker-compose.yml` liegt):

```bash
docker compose up --build
```

- 🌐 Frontend erreichbar unter `http://localhost:8080`
- 🔌 Backend/API unter `http://localhost:3001`
- 💾 Die SQLite-Datenbank liegt in einem benannten Docker-Volume (`db-data`) und übersteht damit Neustarts/Rebuilds
- 🔧 Beim Containerstart führt `entrypoint.sh` automatisch `npx prisma db push` aus, bevor der Server startet

> **Hinweis für ein echtes Server-Deployment:** Aktuell sind einige API-Aufrufe im Frontend noch fest auf `localhost:3001` verdrahtet. Vor einem Deployment auf einen echten Server müssen diese auf `import.meta.env.VITE_API_URL` umgestellt werden.

---

## 🔀 Admin- vs. Portal-Ansicht

Für diese erste Testversion gibt es unten in der Sidebar (sowohl im Admin- als auch im Portal-Bereich) einen Button, mit dem man direkt zwischen der internen **Admin-Ansicht** und der öffentlichen **Portal-Ansicht** hin- und herspringen kann. Praktisch für die Testphase, um ohne zwei separate URLs/Tabs beide Seiten schnell durchzuklicken.

> ⚠️ Vor einem echten Go-Live sollte der Admin-Bereich hinter einer Authentifizierung liegen und der Switch-Button entfernt oder nur für eingeloggte Admins sichtbar sein.

---

## ⚠️ Bekannte Einschränkungen / offene Punkte

- 🔐 Kein Login/keine Benutzerverwaltung – aktuell ist der komplette Admin-Bereich offen erreichbar
- 🌍 Hardcodierte `localhost:3001`-URLs müssen vor einem Server-Deployment auf Umgebungsvariablen umgestellt werden

---

## 📬 Ansprechpartner

Bei Fragen zum Projekt: **Metehan A.** (Praktikant)