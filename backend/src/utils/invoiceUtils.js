import { prisma } from "../prismaClient.js";

export async function generiereNaechsteRechnungsnummer(dbClient = prisma) {
  const jahr = new Date().getFullYear();
  const rechnungenDesJahres = await dbClient.rechnungen.findMany({
    where: {
      rechnungs_nummer: { startsWith: `RE-${jahr}-` },
    },
    select: { rechnungs_nummer: true },
  });

  const vorhandeneZahlen = rechnungenDesJahres.map((r) => {
    const teile = r.rechnungs_nummer.split("-");
    const zahl = parseInt(teile[teile.length - 1], 10);
    return isNaN(zahl) ? 0 : zahl;
  });

  const hoechsteZahl = vorhandeneZahlen.length > 0 ? Math.max(...vorhandeneZahlen) : 0;
  const naechsteZahl = hoechsteZahl + 1;
  return `RE-${jahr}-${String(naechsteZahl).padStart(4, "0")}`;
}