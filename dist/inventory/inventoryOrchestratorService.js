"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCombinedAvailabilityByOem = getCombinedAvailabilityByOem;
const providerRegistry_1 = require("./providerRegistry");
async function getCombinedAvailabilityByOem(oemNumber) {
    const providers = (0, providerRegistry_1.getAllProviders)();
    const providerResults = await Promise.all(providers.map(async (provider) => {
        try {
            const items = await provider.checkAvailabilityByOem(oemNumber);
            return items || [];
        }
        catch (err) {
            console.error("[InventoryOrchestrator] Provider failed", provider.constructor.name, err?.message);
            return [];
        }
    }));
    const flat = providerResults.reduce((acc, arr) => acc.concat(arr), []);
    return {
        oemNumber,
        results: flat
    };
}
