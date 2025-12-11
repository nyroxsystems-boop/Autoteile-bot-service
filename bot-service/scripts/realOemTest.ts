import { findBestOemForVehicle, SearchContext } from "../src/services/oemWebFinder";

async function main() {
  const ctx: SearchContext = {
    vehicle: {
      brand: "BMW",
      model: "320i",
      year: 2001
      // vin: "WBAxxxxxxxxxxxxxx", // optional für mehr Präzision
    },
    userQuery: "Zündkerzen",
    // suspectedNumber: "falls der User schon eine OEM eingegeben hat",
  };

  console.log("Starte Live-OEM-Test mit Kontext:", ctx);

  const result = await findBestOemForVehicle(ctx, true);

  console.log("\n===== OEM-FINDER RESULT =====");
  console.log("Beste OEM:", result.bestOem);
  console.log("Fallback genutzt:", result.fallbackUsed);
  console.log("Bestätigungs-Treffer:", result.confirmationHits);
  console.log("Bestätigungs-Quellen:", result.confirmationSources);
  console.log("Histogramm:", result.histogram);
  console.log("Anzahl Kandidaten:", result.candidates.length);
  console.log("Top 10 Kandidaten:");
  console.log(result.candidates.slice(0, 10));
}

main().catch((err) => {
  console.error("Fehler im Live-OEM-Test:", err);
  process.exit(1);
});
