import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * prismaClient.js
 * ---------------
 * Zentrale Prisma-Instanz für das gesamte Backend. Jede Route
 * importiert dieses eine "prisma"-Objekt, statt selbst einen Client zu
 * erzeugen - so gibt es garantiert nur eine Datenbankverbindung.
 *
 * Die Verbindungs-URL kommt aus der Umgebungsvariable DATABASE_URL
 * (siehe .env, Format: "file:./prisma/test.db"), mit einem lokalen
 * SQLite-Pfad als Fallback, falls die .env fehlt.
 */

/**
 * SQLite-Verbindungsstring. Nutzt DATABASE_URL aus der Umgebung, oder
 * fällt auf eine lokale Standard-Datei zurück, falls keine .env
 * geladen werden konnte (z.B. bei einem frischen Checkout ohne .env).
 * @type {string}
 */
const connectionString = process.env.DATABASE_URL || "file:./prisma/test.db";

/** Better-SQLite3-Adapter, den Prisma für den DB-Zugriff nutzt. */
const adapter = new PrismaBetterSqlite3({ url: connectionString });

/**
 * Die einzige PrismaClient-Instanz der Anwendung. Wird von allen
 * routes/*.js-Dateien importiert.
 * @type {PrismaClient}
 */
export const prisma = new PrismaClient({ adapter });