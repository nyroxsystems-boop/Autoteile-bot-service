const localInventoryProvider = require("./providers/localInventoryProvider");
const externalInventoryProvider = require("./providers/externalInventoryProvider");

// Dies ist die zentrale Stelle, um lokale + externe Bestände zusammenzuführen. Die KI muss nur diesen Service nutzen.
async function getCombinedAvailability(oemNumber) {
  const [local, external] = await Promise.all([
    localInventoryProvider.checkAvailabilityByOem(oemNumber),
    externalInventoryProvider.checkAvailabilityByOem(oemNumber)
  ]);

  const results = [...local, ...external].sort((a, b) => {
    if (a.source === b.source) return 0;
    return a.source === "local" ? -1 : 1;
  });

  return {
    oemNumber: String(oemNumber || "").trim(),
    results
  };
}

module.exports = {
  getCombinedAvailability
};
