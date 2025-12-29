"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const oemResolver_1 = require("./services/oemResolver/oemResolver");
async function testOpelAstra() {
    const req = {
        vehicle: {
            make: 'Opel',
            model: 'Astra K 1.4 Turbo',
            year: 2016
        },
        partQuery: {
            rawText: 'Zündkerzen',
            category: 'Engine'
        }
    };
    console.log("Testing Opel Astra K - Zündkerzen...");
    const result = await (0, oemResolver_1.resolveOEM)(req);
    console.log("\n========================================");
    console.log("RESULT:");
    console.log("OEM:", result.primaryOEM || "NOT FOUND");
    console.log("Confidence:", (result.overallConfidence * 100).toFixed(1) + "%");
    console.log("Notes:", result.notes);
    console.log("========================================\n");
}
testOpelAstra().catch(console.error);
