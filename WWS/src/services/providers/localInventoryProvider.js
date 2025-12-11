const partModel = require("../../models/partModel");

async function checkAvailabilityByOem(oemNumber) {
  const normalized = String(oemNumber || "").trim();
  let matches = partModel.findPartsByQuery({ oemNumber: normalized });

  if (!matches.length) {
    // Fallback: try free text search in case OEM formatting differs.
    matches = partModel.findPartsByQuery({ search: normalized });
  }

  return matches.map((part) => {
    const availableQuantity = Math.max(0, part.stockLocal - part.stockReserved);
    return {
      source: "local",
      partId: part.id,
      oemNumber: part.oemNumber,
      title: part.title,
      brand: part.brand,
      model: `${part.model} ${part.modelCode}`,
      price: part.price,
      currency: part.currency,
      availableQuantity,
      deliveryTime: availableQuantity > 0 ? "sofort" : "nicht verfügbar",
      raw: part
    };
  });
}

module.exports = {
  name: "local",
  checkAvailabilityByOem
};
