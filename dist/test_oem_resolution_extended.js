"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Extended OEM resolution test – 100 brand‑/part‑combinations distinct from the original suite
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
const oemResolver_1 = require("./services/oemResolver/oemResolver");
const logger_1 = require("./utils/logger");
// Load environment variables
dotenv.config({ path: path_1.default.join(__dirname, '../env.production.txt') });
// Helper to build a test case
function makeCase(idx, make, model, year, part) {
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
const TEST_CASES = [];
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
        const req = {
            orderId: `EXT-${t.name.replace(/\s+/g, '-')}`,
            vehicle: { ...t.vehicle, vin: '' },
            partQuery: t.part
        };
        try {
            const result = await (0, oemResolver_1.resolveOEM)(req);
            const primary = result.primaryOEM || 'NONE';
            console.log(`>> Primary OEM: ${primary}`);
            console.log(`>> Confidence: ${(result.overallConfidence * 100).toFixed(1)}%`);
            console.log(`>> Note: ${result.notes}`);
            if (result.primaryOEM)
                console.log('✅ PASSED');
            else
                console.log('⚠️ FAILED');
        }
        catch (e) {
            logger_1.logger.error('Error in extended test case', { error: e, case: t.name });
        }
    }
}
runBatch();
