import "dotenv/config";
import { prisma } from "../src/prismaClient.js"; 

async function main() {
  console.log("🌱 Starte Datenbank-Seeding...");

  // 1. Alte Daten löschen (in umgekehrter Abhängigkeits-Reihenfolge)
  await prisma.preisanpassungen.deleteMany();
  await prisma.rechnungen.deleteMany();
  await prisma.buchungen.deleteMany();
  await prisma.anfragen.deleteMany();
  await prisma.anfrageGaeste.deleteMany();
  await prisma.gaeste.deleteMany();
  await prisma.objekte.deleteMany();
  await prisma.einstellungen.deleteMany();

// 2. Einstellungen erstellen
  await prisma.einstellungen.create({
    data: {
      id: 1,
      checkin_zeit: "15:00",
      checkout_zeit: "11:00",
      mindest_naechte_wohnung: 2,
      kombirabatt: 20,
      checkin_wochentag: "",
      checkout_wochentag: "",
    },
  });

  // 3. Objekte erstellen
  const objekte = await Promise.all([
    prisma.objekte.create({ data: { id: 1, name: "Wohnung 1", beschreibung: "4 Zimmer, 55m²", preis: 110.0 } }),
    prisma.objekte.create({ data: { id: 2, name: "Wohnung 2", beschreibung: "4 Zimmer, 60m²", preis: 120.0 } }),
    prisma.objekte.create({ data: { id: 3, name: "Wohnung 3", beschreibung: "4 Zimmer, 50m²", preis: 100.0 } }),
    prisma.objekte.create({ data: { id: 4, name: "Vito Bus", beschreibung: "2021 BJ, 132 PS, 7 Sitze", preis: 3.0, kennzeichen: "BZ-123AB" } }),
    prisma.objekte.create({ data: { id: 5, name: "Forum Beckhoff", beschreibung: "Forumsaal im 4. Stock im Beckhoff Gebäude", preis: 1.5 } }),
  ]);

  // 4. Gäste erstellen
  const gaesteData = [
    { id: 1, name: "Max Mustermann", email: "max.mustermann@email.at", telnr: "+43 660 1234567", strasse: "Musterstraße", hnr: "10", plz: "1010", stadt: "Wien", land: "Österreich" },
    { id: 2, name: "Thomas Müller", email: "thomas.mueller@web.de", telnr: "+49 170 1234567", strasse: "Hauptstraße", hnr: "42a", plz: "10115", stadt: "Berlin", land: "Deutschland" },
    { id: 3, name: "Sabine Hofer", email: "sabine.hofer@gmx.at", telnr: "+43 660 9876543", strasse: "Feldweg", hnr: "7", plz: "6020", stadt: "Innsbruck", land: "Österreich" },
    { id: 4, name: "Anna Krainer", email: "anna.krainer@gmail.com", telnr: "+43 650 4433221", strasse: "Getreidegasse", hnr: "220", plz: "5020", stadt: "Salzburg", land: "Österreich" },
    { id: 5, name: "Christian Steiner", email: "c.steiner@bluewin.ch", telnr: "+41 44 2223344", strasse: "Bahnhofstrasse", hnr: "50", plz: "8001", stadt: "Zürich", land: "Schweiz" },
    { id: 6, name: "Sarah Wagner", email: "sarah.wagner@wagner-bau.at", telnr: "+43 660 1122334", strasse: "Wiener Straße", hnr: "89", plz: "3100", stadt: "St. Pölten", land: "Österreich" },
    { id: 7, name: "Marco de Basque", email: "m.debasque@mail.es", telnr: "+34 123 514690", strasse: "Carrer de Mallorca", hnr: "6", plz: "08013", stadt: "Barcelona", land: "Spanien" },
    { id: 8, name: "Elena Petrova", email: "elena.p@mail.ru", telnr: "+7 495 123-45-67", strasse: "Tverskaya Street", hnr: "89", plz: "125009", stadt: "Moskau", land: "Russland" },
    { id: 9, name: "Michael Schneider", email: "m.schneider@t-online.de", telnr: "+49 89 5555778", strasse: "Alpenstraße", hnr: "12", plz: "80331", stadt: "München", land: "Deutschland" },
    { id: 10, name: "Jean Dupont", email: "j.dupont@orange.fr", telnr: "+33 6 12345678", strasse: "Rue de Rivoli", hnr: "705", plz: "75001", stadt: "Paris", land: "Frankreich" },
    { id: 11, name: "John Smith", email: "john.smith@outlook.com", telnr: "+44 20 7946 0958", strasse: "Baker Street", hnr: "221B", plz: "NW1 6XE", stadt: "London", land: "Vereinigtes Königreich" },
  ];

  for (const g of gaesteData) {
    await prisma.gaeste.create({ data: g });
  }

  // 5. AnfrageGäste erstellen
  const anfrageGaesteData = [
    { id: 1, name: "Marco de Basque", email: "m.debasque@mail.es", telnr: "+34 123 514690", strasse: "Carrer de Mallorca", hnr: "6", plz: "08013", stadt: "Barcelona", land: "Spanien" },
    { id: 2, name: "Elena Petrova", email: "elena.p@mail.ru", telnr: "+7 495 123-45-67", strasse: "Tverskaya Street", hnr: "89", plz: "125009", stadt: "Moskau", land: "Russland" },
    { id: 3, name: "Michael Schneider", email: "m.schneider@t-online.de", telnr: "+49 89 5555778", strasse: "Alpenstraße", hnr: "12", plz: "80331", stadt: "München", land: "Deutschland" },
    { id: 4, name: "Luca Rossi", email: "luca.rossi@libero.it", telnr: "+39 02 1234567", strasse: "Via Dante", hnr: "14", plz: "20121", stadt: "Mailand", land: "Italien" },
    { id: 5, name: "Bastian Pillwein", email: "b.pillwein@outlook.com", telnr: "+43 665 1156165", strasse: "Hauptstraße", hnr: "11", plz: "6706", stadt: "Bürs", land: "Österreich" },
    { id: 6, name: "John Smith", email: "john.smith@outlook.com", telnr: "+44 20 7946 0958", strasse: "Baker Street", hnr: "221B", plz: "NW1 6XE", stadt: "London", land: "Österreich" },
    { id: 7, name: "Metehan Altundal", email: "m.altundal@beckhoff.at", telnr: "0660 7282163", strasse: "Fritz-Hahn-Gasse", hnr: "1", plz: "1100", stadt: "Wien", land: "Österreich" },
  ];

  for (const ag of anfrageGaesteData) {
    await prisma.anfrageGaeste.create({ data: ag });
  }

  // 6. Anfragen erstellen
  const anfragenData = [
    { id: 1, anfrage_gast_id: 1, objekt_id: 1, anreise: "15.09.2026", abreise: "18.09.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 2, kinder: 0, infos: "Anreise am späten Nachmittag.", status: "angenommen", angenommen_am: new Date("2026-08-06T08:43:14Z") },
    { id: 2, anfrage_gast_id: 2, objekt_id: 4, anreise: "20.09.2026", abreise: "20.09.2026", anreise_zeit: "09:00", abreise_zeit: "17:00", infos: "Benötigen Kindersitz für den Bus.", status: "angenommen", angenommen_am: new Date("2026-08-06T08:43:59Z") },
    { id: 3, anfrage_gast_id: 3, objekt_id: 2, objekt_id_2: 4, anreise: "01.10.2026", abreise: "05.10.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 4, kinder: 1, infos: "Anfrage inklusive Vito Bus.", status: "angenommen", angenommen_am: new Date("2026-08-06T08:44:11Z") },
    { id: 4, anfrage_gast_id: 4, objekt_id: 5, anreise: "10.09.2026", abreise: "10.09.2026", anreise_zeit: "10:00", abreise_zeit: "16:00", infos: "Firmenpräsentation im Forum.", status: "abgelehnt", ablehnungsgrund: "Raum bereits wegen Eigenbedarf reserviert." },
    { id: 5, anfrage_gast_id: 5, objekt_id: 3, anreise: "25.09.2026", abreise: "28.09.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 2, kinder: 0, infos: "Ruhiges Zimmer gewünscht.", status: "abgelehnt", ablehnungsgrund: "Keine Kapazitäten frei.", abgelehnt_am: new Date("2026-08-06T08:44:24Z") },
    { id: 6, anfrage_gast_id: 6, objekt_id: 1, objekt_id_2: 4, anreise: "10.08.2026", abreise: "12.08.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 2, infos: "Ich liebe Beckhoff!", status: "angenommen", angenommen_am: new Date("2026-08-06T08:53:47Z") },
    { id: 7, anfrage_gast_id: 7, objekt_id: 4, anreise: "29.08.2026", abreise: "29.08.2026", anreise_zeit: "09:00", abreise_zeit: "17:00", status: "offen" },
    { id: 8, anfrage_gast_id: 6, objekt_id: 4, anreise: "29.08.2026", abreise: "29.08.2026", anreise_zeit: "09:00", abreise_zeit: "17:00", status: "offen" },
  ];

  for (const a of anfragenData) {
    await prisma.anfragen.create({ data: a });
  }

  // 7. Buchungen erstellen
  const buchungenData = [
    { id: 1, gast_id: 1, objekt_id: 1, anreise: "01.07.2026", abreise: "05.07.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 2, kinder: 0, preis: 400.0, infos: "Vergangene Buchung" },
    { id: 2, gast_id: 2, objekt_id: 2, objekt_id_2: 4, anreise: "04.08.2026", abreise: "10.08.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 2, kinder: 1, preis: 780.0, infos: "Aktuelle Sommerbuchung" },
    { id: 3, gast_id: 3, objekt_id: 4, anreise: "15.08.2026", abreise: "15.08.2026", anreise_zeit: "09:00", abreise_zeit: "17:00", preis: 24.0, infos: "Tagesausflug" },
    { id: 4, gast_id: 4, objekt_id: 3, anreise: "01.09.2026", abreise: "07.09.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 2, kinder: 0, preis: 540.0, infos: "Herbsturlaub" },
    { id: 5, gast_id: 5, objekt_id: 5, anreise: "12.09.2026", abreise: "12.09.2026", anreise_zeit: "08:00", abreise_zeit: "18:00", preis: 15.0, infos: "Workshop Tagung" },
    { id: 6, gast_id: 6, objekt_id: 1, anreise: "15.10.2026", abreise: "20.10.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 3, kinder: 0, preis: 550.0, infos: "Geschäftsreise" },
    { id: 7, gast_id: 7, objekt_id: 1, anreise: "15.09.2026", abreise: "18.09.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 2, kinder: 0, preis: 450.0, infos: "Anreise am späten Nachmittag." },
    { id: 8, gast_id: 8, objekt_id: 4, anreise: "20.09.2026", abreise: "20.09.2026", anreise_zeit: "09:00", abreise_zeit: "17:00", preis: 24.0, infos: "Benötigen Kindersitz für den Bus." },
    { id: 9, gast_id: 9, objekt_id: 2, objekt_id_2: 4, anreise: "01.10.2026", abreise: "05.10.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 4, kinder: 1, preis: 700.8, infos: "Anfrage inklusive Vito Bus." },
    { id: 10, gast_id: 10, objekt_id: 1, anreise: "07.08.2026", abreise: "09.08.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 2, kinder: 0, preis: 220.0 },
    { id: 11, gast_id: 11, objekt_id: 1, objekt_id_2: 4, anreise: "10.08.2026", abreise: "12.08.2026", anreise_zeit: "15:00", abreise_zeit: "11:00", erwachsene: 2, preis: 325.0, infos: "Ich liebe Beckhoff!" },
  ];

  for (const b of buchungenData) {
    await prisma.buchungen.create({ data: b });
  }

  // 8. Rechnungen erstellen
  const rechnungenData = [
    { id: 1, buchung_id: 1, rechnungs_nummer: "RE-2026-0001", rechnungs_datum: "05.07.2026" },
    { id: 2, buchung_id: 2, rechnungs_nummer: "RE-2026-0002", rechnungs_datum: "10.08.2026" },
    { id: 3, buchung_id: 3, rechnungs_nummer: "RE-2026-0003", rechnungs_datum: "15.08.2026" },
    { id: 4, buchung_id: 4, rechnungs_nummer: "RE-2026-0004", rechnungs_datum: "07.09.2026" },
    { id: 5, buchung_id: 5, rechnungs_nummer: "RE-2026-0005", rechnungs_datum: "12.09.2026" },
    { id: 6, buchung_id: 6, rechnungs_nummer: "RE-2026-0006", rechnungs_datum: "20.10.2026" },
    { id: 7, buchung_id: 7, rechnungs_nummer: "RE-2026-0007", rechnungs_datum: "18.09.2026" },
    { id: 8, buchung_id: 8, rechnungs_nummer: "RE-2026-0008", rechnungs_datum: "20.09.2026" },
    { id: 9, buchung_id: 9, rechnungs_nummer: "RE-2026-0009", rechnungs_datum: "05.10.2026" },
    { id: 10, buchung_id: 10, rechnungs_nummer: "RE-2026-0010", rechnungs_datum: "09.08.2026" },
    { id: 11, buchung_id: 11, rechnungs_nummer: "RE-2026-0011", rechnungs_datum: "12.08.2026" },
  ];

  for (const r of rechnungenData) {
    await prisma.rechnungen.create({ data: r });
  }

  // 9. Preisanpassungen erstellen
  await prisma.preisanpassungen.createMany({
    data: [
      { id: 1, buchung_id: 1, alter_betrag: 440.0, neuer_betrag: 400.0, grund: "Kulanz wegen verspätetem Check-in" },
      { id: 2, buchung_id: 4, alter_betrag: 600.0, neuer_betrag: 540.0, grund: "10% Stammkundenrabatt gewährt" },
    ],
  });

  console.log("✅ Datenbank erfolgreich befüllt!");
}

main()
  .catch((e) => {
    console.error("❌ Fehler beim Seeden:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });