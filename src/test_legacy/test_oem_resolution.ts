import * as dotenv from 'dotenv';
import path from 'path';

// Load env before imports
dotenv.config({ path: path.join(__dirname, '../.env') });

import { resolveOEM } from './services/oemResolver/oemResolver';
import { OEMResolverRequest } from './services/oemResolver/types';

const TEST_CASES = [
    {
        name: "1. VW Passat B8 Oil Filter",
        vehicle: { hsn: "0603", tsn: "BPX", make: "Volkswagen", model: "Passat B8 2.0 TDI", year: 2016, kw: 110 },
        part: { rawText: "Ölfilter", normalizedCategory: "oil_filter", suspectedNumber: "" }
    },
    {
        name: "2. Ford Fiesta MK7 Brake Discs",
        vehicle: { hsn: "8566", tsn: "AWJ", make: "Ford", model: "Fiesta MK7 1.25", year: 2010, kw: 60 },
        part: { rawText: "Bremsscheiben vorne", normalizedCategory: "brake_disc", suspectedNumber: "" }
    },
    {
        name: "3. Opel Astra J Ignition Coil",
        vehicle: { hsn: "0035", tsn: "AXP", make: "Opel", model: "Astra J 1.4 Turbo", year: 2012, kw: 103 },
        part: { rawText: "Zündspule", normalizedCategory: "ignition_coil", suspectedNumber: "" }
    },
    {
        name: "4. Renault Clio IV Air Filter",
        vehicle: { hsn: "3333", tsn: "AZR", make: "Renault", model: "Clio IV 0.9 TCe", year: 2015, kw: 66 },
        part: { rawText: "Luftfilter Motor", normalizedCategory: "air_filter", suspectedNumber: "" }
    },
    {
        name: "5. Fiat 500 Timing Belt Kit",
        vehicle: { hsn: "4136", tsn: "AQC", make: "Fiat", model: "500 1.2", year: 2014, kw: 51 },
        part: { rawText: "Zahnriemensatz", normalizedCategory: "timing_belt_kit", suspectedNumber: "" }
    },
    {
        name: "6. Toyota Yaris Wiper Blades",
        vehicle: { hsn: "5013", tsn: "AAG", make: "Toyota", model: "Yaris XP9 1.33", year: 2009, kw: 74 },
        part: { rawText: "Scheibenwischer vorne", normalizedCategory: "wiper_blade", suspectedNumber: "" }
    },
    {
        name: "7. Skoda Octavia III Rear Shock",
        vehicle: { hsn: "8004", tsn: "ANJ", make: "Skoda", model: "Octavia III 2.0 TDI", year: 2017, kw: 110 },
        part: { rawText: "Stoßdämpfer hinten", normalizedCategory: "shock_absorber", suspectedNumber: "" }
    },
    {
        name: "8. Mercedes W212 Fuel Filter",
        vehicle: { hsn: "1313", tsn: "BGU", make: "Mercedes-Benz", model: "E-Klasse W212 E220 CDI", year: 2013, kw: 125 },
        part: { rawText: "Kraftstofffilter", normalizedCategory: "fuel_filter", suspectedNumber: "" }
    },
    {
        name: "9. BMW 3er F30 Brake Pads Rear",
        vehicle: { hsn: "0005", tsn: "BLH", make: "BMW", model: "3er F30 320d", year: 2014, kw: 135 },
        part: { rawText: "Bremsbeläge hinten", normalizedCategory: "brake_pad", suspectedNumber: "" }
    },
    {
        name: "10. Audi A4 B9 Cabin Filter",
        vehicle: { hsn: "0588", tsn: "BFL", make: "Audi", model: "A4 B9 2.0 TDI", year: 2018, kw: 140 },
        part: { rawText: "Innenraumfilter", normalizedCategory: "cabin_filter", suspectedNumber: "" }
    }
];
// ------------------------------------------------------------------
// Dynamically generate additional synthetic test cases to reach 100 total
while (TEST_CASES.length < 100) {
    const idx = TEST_CASES.length + 1;
    const brands = ["Volkswagen", "Audi", "BMW", "Mercedes", "Ford", "Renault", "Toyota", "Skoda", "Fiat", "Honda"];
    const parts = ["Ölfilter", "Bremsscheiben vorne", "Zündspule", "Luftfilter", "Zahnriemensatz", "Scheibenwischer", "Stoßdämpfer", "Kraftstofffilter", "Bremsbeläge hinten", "Innenraumfilter", "Sport‑Bremssattel", "Performance‑Auspuff"];
    const make = brands[idx % brands.length];
    const model = `${make} Modell ${idx}`;
    const year = 2010 + (idx % 12);
    const part = parts[idx % parts.length];
    TEST_CASES.push({
        name: `Auto-${idx}: ${make} ${model} (${year}) – ${part}`,
        vehicle: { hsn: "XXXX", tsn: "YYYY", make, model, year, kw: 0 },
        part: { rawText: part, normalizedCategory: "generic", suspectedNumber: "" }
    });
}


async function runBatch() {
    for (const t of TEST_CASES) {
        console.log(`\n\n=============================================`);
        console.log(`RUNNING TEST: ${t.name}`);
        console.log(`Vehicle: ${t.vehicle.make} ${t.vehicle.model}`);
        console.log(`Part: ${t.part.rawText}`);
        console.log(`=============================================`);

        const req: OEMResolverRequest = {
            orderId: "TEST-BATCH-" + Math.floor(Math.random() * 1000),
            vehicle: { ...t.vehicle, vin: "" },
            partQuery: t.part
        };

        try {
            const result = await resolveOEM(req);
            console.log(`>> Primary OEM: ${result.primaryOEM || "NONE"}`);
            console.log(`>> Confidence: ${(result.overallConfidence * 100).toFixed(1)}%`);
            console.log(`>> Note: ${result.notes}`);

            if (result.primaryOEM) console.log("✅ PASSED");
            else console.log("⚠️ FAILED");
        } catch (e) {
            console.error("Error in test case", e);
        }
    }
}

runBatch();
