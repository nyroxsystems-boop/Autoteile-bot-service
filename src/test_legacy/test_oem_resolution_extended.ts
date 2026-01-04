// Extended OEM resolution test – 100 brand‑/part‑combinations distinct from the original suite
import * as dotenv from 'dotenv';
import path from 'path';
import { resolveOEM } from './services/oemResolver/oemResolver';
import { OEMResolverRequest } from './services/oemResolver/types';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../env.production.txt') });

// Helper to build a test case
function makeCase(idx: number, make: string, model: string, year: number, part: string) {
    return {
        name: `Case ${idx}: ${make} ${model} (${year}) – ${part}`,
        vehicle: { hsn: 'XXXX', tsn: 'YYYY', make, model, year, kw: 0 },
        part: { rawText: part, normalizedCategory: 'generic', suspectedNumber: '' }
    };
}

// Distinct brand and part pools (different from the original test)
const brands = [
    'Honda', 'Mazda', 'Infiniti', 'Acura', 'Volvo', 'Jaguar', 'Land Rover', 'Mini', 'Alfa Romeo', 'Genesis'
];
const parts = [
    'Sport‑Bremsbeläge', 'Leistungs‑Bremsscheibe', 'Turbo‑Lader‑Dichtung', 'Auspuff‑Halter', 'Kühlerschlauch',
    'Stoßdämpfer vorne', 'Stabilisator hinten', 'Kupplungs‑Scheibe', 'Getriebe‑Dichtung', 'Zündkerzen‑Set'
];

const TEST_CASES: any[] = [];
for (let i = 1; i <= 100; i++) {
    const make = brands[i % brands.length];
    const model = `${make} Modell ${i}`;
    const year = 2005 + (i % 15);
    const part = parts[i % parts.length];
    TEST_CASES.push(makeCase(i, make, model, year, part));
}

async function runBatch() {
    for (const t of TEST_CASES) {
        console.log('\n=============================================');
        console.log(`RUNNING TEST: ${t.name}`);
        console.log(`Vehicle: ${t.vehicle.make} ${t.vehicle.model}`);
        console.log(`Part: ${t.part.rawText}`);
        console.log('=============================================');

        const req: OEMResolverRequest = {
            orderId: `EXT-${t.name.replace(/\s+/g, '-')}`,
            vehicle: { ...t.vehicle, vin: '' },
            partQuery: t.part
        };

        try {
            const result = await resolveOEM(req);
            const primary = result.primaryOEM || 'NONE';
            console.log(`>> Primary OEM: ${primary}`);
            console.log(`>> Confidence: ${(result.overallConfidence * 100).toFixed(1)}%`);
            console.log(`>> Note: ${result.notes}`);
            if (result.primaryOEM) console.log('✅ PASSED');
            else console.log('⚠️ FAILED');
        } catch (e) {
            logger.error('Error in extended test case', { error: e, case: t.name });
        }
    }
}

runBatch();
