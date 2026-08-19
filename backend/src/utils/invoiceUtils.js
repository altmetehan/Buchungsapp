import { prisma } from "../prismaClient.js";

/**
 * invoiceUtils.js
 * ---------------
 * Zentrale Vergabe fortlaufender Rechnungsnummern im Format
 * "RE-<Jahr>-<4-stellig>", z.B. "RE-2026-0007". Die Nummerierung
 * beginnt pro Kalenderjahr wieder bei 1.
 */

/**
 * Ermittelt die nächste freie Rechnungsnummer für das aktuelle Jahr,
 * indem die höchste bereits vergebene Nummer des Jahres gesucht und um
 * 1 erhöht wird.
 *
 * WICHTIG - Nebenläufigkeit: Wird diese Funktion außerhalb einer
 * Datenbank-Transaktion aufgerufen (kein "dbClient" übergeben), können
 * zwei nahezu gleichzeitige Aufrufe theoretisch dieselbe Nummer
 * berechnen, bevor der erste Aufruf seine Rechnung tatsächlich
 * gespeichert hat (klassisches Read-Then-Write-Rennen). In
 * routes/anfragen.routes.js wird das bereits korrekt vermieden, indem
 * der transaktionale Client "tx" übergeben wird, sodass die
 * Nummernvergabe und das Anlegen der Rechnung atomar zusammen
 * passieren. Der direkte Aufruf in routes/rechnungen.routes.js (POST /)
 * läuft dagegen ohne Transaktion - bei sehr seltenen, exakt
 * zeitgleichen manuellen Rechnungserstellungen ist dort theoretisch
 * eine doppelt vergebene Nummer möglich. Für den aktuellen
 * Nutzungsumfang (interne Verwaltung, wenige gleichzeitige Nutzer) ist
 * das Risiko vernachlässigbar, sollte aber bei Bedarf durch
 * Übergabe von "tx" an dieser Stelle ebenfalls geschlossen werden.
 *
 * @param {import("@prisma/client").PrismaClient|import("@prisma/client").Prisma.TransactionClient} [dbClient=prisma] - Prisma-Client oder Transaktions-Client (tx), über den die Abfrage läuft
 * @returns {Promise<string>} z.B. "RE-2026-0007"
 */
export async function generiereNaechsteRechnungsnummer(dbClient = prisma) {
  const jahr = new Date().getFullYear();

  const rechnungenDesJahres = await dbClient.rechnungen.findMany({
    where: {
      rechnungs_nummer: { startsWith: `RE-${jahr}-` },
    },
    select: { rechnungs_nummer: true },
  });

  // Aus jeder vorhandenen Nummer den letzten Bindestrich-Teil (die
  // laufende Zahl) extrahieren, um darauf aufzubauen.
  const vorhandeneZahlen = rechnungenDesJahres.map((r) => {
    const teile = r.rechnungs_nummer.split("-");
    const zahl = parseInt(teile[teile.length - 1], 10);
    return isNaN(zahl) ? 0 : zahl;
  });

  const hoechsteZahl = vorhandeneZahlen.length > 0 ? Math.max(...vorhandeneZahlen) : 0;
  const naechsteZahl = hoechsteZahl + 1;

  return `RE-${jahr}-${String(naechsteZahl).padStart(4, "0")}`;
}