// Platzhalter für externe Integrationen:
// - HTTP-APIs von ERP / Shops
// - Scraper (z.B. Playwright/Puppeteer), wenn keine API verfügbar ist
// Der Bot spricht nur /api/inventory/by-oem an, dieser Provider kann später echte Datenquellen anbinden.

async function checkAvailabilityByOem(oemNumber) {
  const normalized = String(oemNumber || "").trim();
  const basePrice = 50;
  const price = Math.round((basePrice * 1.1 + Number.EPSILON) * 100) / 100;

  return [
    {
      source: "external-demo",
      oemNumber: normalized,
      title: `Demo externes Lager für OEM ${normalized}`,
      brand: "UNKNOWN",
      model: "UNKNOWN",
      price,
      currency: "EUR",
      availableQuantity: 50,
      deliveryTime: "1-2 Tage"
    }
  ];
}

module.exports = {
  name: "external-demo",
  checkAvailabilityByOem
};
