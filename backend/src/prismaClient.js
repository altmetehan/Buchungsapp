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
const connectionString = process.env.DATABASE_URL || "file:./prisma/test.db";

const adapter = new PrismaBetterSqlite3({ url: connectionString });

export const prisma = new PrismaClient({ adapter });
