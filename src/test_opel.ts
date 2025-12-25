
import { resolveOEM } from './services/oemResolver/oemResolver';
import { logger } from './utils/logger';

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
    const result = await resolveOEM(req as any);

    console.log("\n========================================");
    console.log("RESULT:");
    console.log("OEM:", result.primaryOEM || "NOT FOUND");
    console.log("Confidence:", (result.overallConfidence * 100).toFixed(1) + "%");
    console.log("Notes:", result.notes);
    console.log("========================================\n");
}

testOpelAstra().catch(console.error);
