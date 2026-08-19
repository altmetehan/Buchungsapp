export function germanToISO(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split(".");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

export function parseGermanDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return new Date(0);
  const parts = dateStr.split(".").map(Number);
  if (parts.length !== 3) return new Date(0);
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

export function istStundenbasiert(objekt) {
  return !objekt?.name?.toLowerCase().includes("wohnung");
}

export function ueberschneidenSich(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

export function datumZeitUeberschneidenSich(
  startA,
  zeitStartA,
  endA,
  zeitEndA,
  startB,
  zeitStartB,
  endB,
  zeitEndB
) {
  const a1 = new Date(`${startA}T${zeitStartA || "00:00"}`);
  const a2 = new Date(`${endA}T${zeitEndA || "23:59"}`);
  const b1 = new Date(`${startB}T${zeitStartB || "00:00"}`);
  const b2 = new Date(`${endB}T${zeitEndB || "23:59"}`);
  return a1 < b2 && a2 > b1;
}

export function berechneStundenISO(startISO, startZeit, endISO, endZeit) {
  if (!startISO || !endISO || !startZeit || !endZeit) return 0;
  const [sh, sm] = startZeit.split(":").map(Number);
  const [eh, em] = endZeit.split(":").map(Number);
  const [sy, smonth, sd] = startISO.split("-").map(Number);
  const [ey, emonth, ed] = endISO.split("-").map(Number);
  const start = new Date(sy, smonth - 1, sd, sh, sm, 0, 0);
  const ende = new Date(ey, emonth - 1, ed, eh, em, 0, 0);
  const diffMs = ende - start;
  return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
}