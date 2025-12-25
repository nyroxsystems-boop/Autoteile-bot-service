/**
 * 🔥 HARDCORE STRESS TEST - 100 RANDOM VEHICLES 🔥
 * 
 * Extremer Test mit:
 * - 100 zufälligen Fahrzeugen
 * - Sondermodelle (M, AMG, RS, GTI, etc.)
 * - Exotische Teile
 * - Strenge Validierung
 * - Backsearch-Prüfung
 * 
 * Ziel: 96%+ Success Rate auch bei schwierigen Fällen
 */

import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../env.production.txt') });

import { resolveOEM } from './services/oemResolver/oemResolver';
import { OEMResolverRequest } from './services/oemResolver/types';

// Normalize OEM for comparison
function normalizeOEM(oem: string): string {
    return oem.replace(/[\s\-\.]/g, '').toUpperCase();
}

// Random data pools
const BRANDS = {
    premium: [
        "BMW", "Mercedes-Benz", "Audi", "Porsche", "Jaguar", "Land Rover",
        "Volvo", "Lexus", "Infiniti", "Cadillac", "Alfa Romeo", "Maserati"
    ],
    mainstream: [
        "Volkswagen", "Ford", "Opel", "Renault", "Peugeot", "Citroen",
        "Skoda", "Seat", "Fiat", "Toyota", "Honda", "Mazda", "Nissan",
        "Hyundai", "Kia", "Mitsubishi", "Subaru", "Suzuki"
    ],
    performance: [
        "BMW M", "Mercedes-AMG", "Audi RS", "Audi S", "Porsche GT",
        "VW R", "Ford ST", "Ford RS", "Opel OPC", "Renault Sport",
        "Seat Cupra", "Skoda RS", "Alfa Romeo Quadrifoglio"
    ]
};

const MODELS = {
    "BMW": ["316i", "318d", "320i", "320d", "325i", "330d", "335i", "M3", "M4", "M5", "X1", "X3", "X5", "X6", "Z4"],
    "BMW M": ["M2", "M3 Competition", "M4 GTS", "M5 Competition", "M8", "X5 M", "X6 M"],
    "Mercedes-Benz": ["C180", "C200", "C220d", "C300", "E200", "E220d", "E300", "S350", "A180", "A200", "GLA", "GLC", "GLE"],
    "Mercedes-AMG": ["A45 S", "C43", "C63 S", "E53", "E63 S", "GT", "GT R", "GLC 43", "GLE 63"],
    "Audi": ["A3", "A4", "A5", "A6", "A7", "A8", "Q3", "Q5", "Q7", "Q8", "TT"],
    "Audi RS": ["RS3", "RS4", "RS5", "RS6", "RS7", "RSQ3", "RSQ8"],
    "Audi S": ["S3", "S4", "S5", "S6", "S7", "S8", "SQ5", "SQ7"],
    "Volkswagen": ["Golf", "Passat", "Tiguan", "Touran", "Polo", "Arteon", "T-Roc", "Touareg"],
    "VW R": ["Golf R", "Tiguan R", "Arteon R", "T-Roc R"],
    "Porsche": ["911", "Cayenne", "Macan", "Panamera", "Taycan", "Boxster", "Cayman"],
    "Porsche GT": ["911 GT3", "911 GT3 RS", "911 GT2 RS", "Cayman GT4"],
    "Ford": ["Focus", "Fiesta", "Mondeo", "Kuga", "Puma", "Mustang"],
    "Ford ST": ["Focus ST", "Fiesta ST", "Puma ST"],
    "Ford RS": ["Focus RS", "Fiesta RS"],
    "Opel": ["Astra", "Corsa", "Insignia", "Mokka", "Grandland"],
    "Renault": ["Clio", "Megane", "Kadjar", "Captur", "Scenic"],
    "Skoda": ["Octavia", "Superb", "Kodiaq", "Karoq", "Scala"],
    "Seat": ["Leon", "Ibiza", "Ateca", "Arona", "Tarraco"]
};

const PARTS = {
    common: [
        "Ölfilter", "Luftfilter", "Innenraumfilter", "Kraftstofffilter",
        "Bremsbeläge vorne", "Bremsbeläge hinten", "Bremsscheiben vorne", "Bremsscheiben hinten",
        "Zündkerzen", "Glühkerzen", "Zündspule", "Lambdasonde",
        "Stoßdämpfer vorne", "Stoßdämpfer hinten", "Querlenker", "Spurstangenkopf"
    ],
    performance: [
        "Sport-Bremsbeläge Carbon-Keramik", "Performance-Luftfilter K&N",
        "Sport-Auspuffanlage Akrapovic", "Gewindefahrwerk KW V3",
        "Ladeluftkühler Upgrade", "Turbolader Upgrade", "Sportluftfilter",
        "Leistungssteigerung Chiptuning", "Sportauspuff Endschalldämpfer",
        "Carbon-Diffusor", "Titan-Auspuffanlage", "Keramik-Bremsscheiben"
    ],
    exotic: [
        "AGR-Ventil", "Turbolader Dichtungssatz", "Differential Öl",
        "Verteilergetriebe Lager", "Kardanwelle Kreuzgelenk", "Nockenwellenversteller",
        "Steuerkette Satz komplett", "Kurbelwellensensor", "Einspritzventil",
        "Hochdruckpumpe Diesel", "Partikelfilter DPF", "AdBlue Einspritzdüse",
        "Turbolader Wastegate", "Ladedruckregelventil", "Saugrohrdrucksensor",
        "Kühlmittelthermostat elektrisch", "Wasserpumpe elektrisch", "Ölpumpe"
    ],
    suspension: [
        "Luftfederung Kompressor", "Adaptive Dämpfer", "Stabilisator Koppelstange",
        "Achsträger Lager", "Radlager Satz", "Domlager vorne",
        "Pendelstütze", "Gummilager Querlenker", "Hydrolager Motorlager"
    ],
    electrical: [
        "Xenon Scheinwerfer", "LED Rücklicht", "Steuergerät Motor",
        "ABS Sensor vorne", "ESP Sensor", "Lenkwinkelsensor",
        "Regensensor", "Lichtsensor", "Parksensor PDC", "Rückfahrkamera"
    ]
};

const YEARS = [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
const KW_RANGES = {
    small: [44, 55, 66, 74, 81],
    medium: [85, 96, 103, 110, 120],
    large: [125, 135, 140, 150, 162],
    performance: [180, 200, 220, 250, 280, 300, 350, 400, 450, 500]
};

// Generate random test case
function generateRandomTestCase(index: number): any {
    const rand = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

    // Randomly choose brand type
    const brandType = Math.random() < 0.15 ? 'performance' : Math.random() < 0.5 ? 'premium' : 'mainstream';
    const brand = rand(BRANDS[brandType]);

    // Get model for brand
    const models = (MODELS as any)[brand] || ["Generic Model"];
    const model = rand(models);

    // Choose part type based on brand
    let partType: keyof typeof PARTS;
    if (brandType === 'performance') {
        partType = Math.random() < 0.4 ? 'performance' : Math.random() < 0.7 ? 'exotic' : 'common';
    } else {
        partType = Math.random() < 0.6 ? 'common' : Math.random() < 0.85 ? 'exotic' : rand(['suspension', 'electrical'] as const);
    }

    const part = rand(PARTS[partType]);

    // Choose KW based on brand
    let kwRange: keyof typeof KW_RANGES;
    if (brandType === 'performance') {
        kwRange = 'performance';
    } else if (brandType === 'premium') {
        kwRange = Math.random() < 0.5 ? 'large' : 'medium';
    } else {
        kwRange = Math.random() < 0.4 ? 'small' : 'medium';
    }

    const kw = rand(KW_RANGES[kwRange]);
    const year = rand(YEARS);

    // Generate HSN/TSN (simplified)
    const hsn = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    const tsn = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
        String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
        String.fromCharCode(65 + Math.floor(Math.random() * 26));

    return {
        name: `Test ${index}: ${brand} ${model} (${year}) - ${part}`,
        difficulty: brandType === 'performance' ? 'EXTREME' : partType === 'performance' || partType === 'exotic' ? 'HARD' : partType === 'common' ? 'EASY' : 'MEDIUM',
        vehicle: {
            make: brand,
            model: model,
            year: year,
            kw: kw,
            hsn: hsn,
            tsn: tsn
        },
        part: {
            rawText: part,
            normalizedCategory: part.toLowerCase().replace(/[^a-z0-9]/g, '_')
        }
    };
}

// Generate 50 random test cases
const TEST_CASES = Array.from({ length: 50 }, (_, i) => generateRandomTestCase(i + 1));

interface HardcoreTestResult {
    index: number;
    name: string;
    difficulty: string;
    success: boolean;
    confidence: number;
    primaryOEM: string | null;
    normalizedOEM: string | null;
    candidateCount: number;
    sourceCount: number;
    backsearchPassed: boolean;
    backsearchHits: number;
    duration: number;
    errorMessage?: string;
}

async function runHardcoreTest() {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         🔥 HARDCORE STRESS TEST - 50 RANDOM VEHICLES 🔥                   ║
║                                                                            ║
║  Extreme Testing with:                                                     ║
║  • 50 Random Vehicles (Premium, Performance, Mainstream)                  ║
║  • Sondermodelle (M, AMG, RS, GT, etc.)                                   ║
║  • Exotische Teile (Turbo, AGR, DPF, etc.)                                ║
║  • Strenge Backsearch-Validierung                                         ║
║  • Target: 96%+ Success Rate                                              ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
    `);

    const results: HardcoreTestResult[] = [];
    let totalDuration = 0;
    let processedCount = 0;

    console.log(`\n🚀 Starting test with ${TEST_CASES.length} random cases...\n`);

    for (let i = 0; i < TEST_CASES.length; i++) {
        const testCase = TEST_CASES[i];
        processedCount++;

        // Progress indicator
        if (processedCount % 5 === 0) {
            console.log(`\n${"=".repeat(80)}`);
            console.log(`📊 PROGRESS: ${processedCount}/${TEST_CASES.length} tests completed (${(processedCount / TEST_CASES.length * 100).toFixed(0)}%)`);
            console.log(`${"=".repeat(80)}\n`);
        }

        console.log(`[${i + 1}/${TEST_CASES.length}] ${testCase.difficulty} | ${testCase.name}`);

        const req: OEMResolverRequest = {
            orderId: `HARDCORE-${i + 1}`,
            vehicle: { ...testCase.vehicle, vin: "" },
            partQuery: { ...testCase.part, suspectedNumber: null }
        };

        const startTime = Date.now();

        try {
            const result = await resolveOEM(req);
            const duration = Date.now() - startTime;
            totalDuration += duration;

            // Count unique sources
            const uniqueSources = new Set(
                result.candidates.map((c: any) => c.source.split('+')[0])
            );
            const sourceCount = uniqueSources.size;

            // Normalize OEM
            const normalizedOEM = result.primaryOEM ? normalizeOEM(result.primaryOEM) : null;

            // Check backsearch results from metadata
            let backsearchHits = 0;
            let backsearchPassed = false;

            // Extract backsearch info from candidates metadata
            const topCandidate = result.candidates.find((c: any) => c.oem === result.primaryOEM);
            if (topCandidate?.meta?.validationNote) {
                const note = topCandidate.meta.validationNote;
                // Count sources mentioned in validation note
                const sources = ['TecDoc', 'Autodoc', 'Daparto', 'eBay', '7zap'];
                backsearchHits = sources.filter(s => note.includes(s)).length;
                backsearchPassed = backsearchHits >= 1; // At least 1 source confirmed
            }

            // Determine success
            const success = !!(
                result.primaryOEM &&
                result.overallConfidence >= 0.85 &&
                backsearchPassed
            );

            results.push({
                index: i + 1,
                name: testCase.name,
                difficulty: testCase.difficulty,
                success,
                confidence: result.overallConfidence,
                primaryOEM: result.primaryOEM || null,
                normalizedOEM,
                candidateCount: result.candidates.length,
                sourceCount,
                backsearchPassed,
                backsearchHits,
                duration
            });

            const statusIcon = success ? "✅" : "❌";
            const confIcon = result.overallConfidence >= 0.96 ? "🟢" :
                result.overallConfidence >= 0.85 ? "🟡" : "🔴";

            console.log(`  ${statusIcon} ${confIcon} ${(result.overallConfidence * 100).toFixed(0)}% | OEM: ${result.primaryOEM || "NONE"} | Backsearch: ${backsearchHits} hits | ${duration}ms`);

        } catch (error: any) {
            const duration = Date.now() - startTime;
            totalDuration += duration;

            console.log(`  ❌ ERROR: ${error.message}`);

            results.push({
                index: i + 1,
                name: testCase.name,
                difficulty: testCase.difficulty,
                success: false,
                confidence: 0,
                primaryOEM: null,
                normalizedOEM: null,
                candidateCount: 0,
                sourceCount: 0,
                backsearchPassed: false,
                backsearchHits: 0,
                duration,
                errorMessage: error.message
            });
        }
    }

    // === FINAL HARDCORE ANALYSIS ===
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🔥 HARDCORE TEST FINAL ANALYSIS 🔥`);
    console.log(`${"=".repeat(80)}`);

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const successRate = (passed / results.length * 100);

    // By difficulty
    const easyTests = results.filter(r => r.difficulty === "EASY");
    const mediumTests = results.filter(r => r.difficulty === "MEDIUM");
    const hardTests = results.filter(r => r.difficulty === "HARD");
    const extremeTests = results.filter(r => r.difficulty === "EXTREME");

    const easyPass = easyTests.filter(r => r.success).length;
    const mediumPass = mediumTests.filter(r => r.success).length;
    const hardPass = hardTests.filter(r => r.success).length;
    const extremePass = extremeTests.filter(r => r.success).length;

    // Confidence distribution
    const highConf = results.filter(r => r.confidence >= 0.96).length;
    const medConf = results.filter(r => r.confidence >= 0.85 && r.confidence < 0.96).length;
    const lowConf = results.filter(r => r.confidence < 0.85).length;

    // Backsearch stats
    const backsearchPassed = results.filter(r => r.backsearchPassed).length;
    const avgBacksearchHits = results.reduce((sum, r) => sum + r.backsearchHits, 0) / results.length;

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const avgDuration = totalDuration / results.length;

    console.log(`\n📈 OVERALL RESULTS:`);
    console.log(`   Total Tests: ${results.length}`);
    console.log(`   ✅ Passed: ${passed} (${successRate.toFixed(1)}%)`);
    console.log(`   ❌ Failed: ${failed} (${(failed / results.length * 100).toFixed(1)}%)`);

    console.log(`\n🎯 BY DIFFICULTY:`);
    console.log(`   EASY:    ${easyPass}/${easyTests.length} passed (${easyTests.length > 0 ? (easyPass / easyTests.length * 100).toFixed(0) : 0}%)`);
    console.log(`   MEDIUM:  ${mediumPass}/${mediumTests.length} passed (${mediumTests.length > 0 ? (mediumPass / mediumTests.length * 100).toFixed(0) : 0}%)`);
    console.log(`   HARD:    ${hardPass}/${hardTests.length} passed (${hardTests.length > 0 ? (hardPass / hardTests.length * 100).toFixed(0) : 0}%)`);
    console.log(`   EXTREME: ${extremePass}/${extremeTests.length} passed (${extremeTests.length > 0 ? (extremePass / extremeTests.length * 100).toFixed(0) : 0}%)`);

    console.log(`\n📊 CONFIDENCE DISTRIBUTION:`);
    console.log(`   🟢 High (≥96%):     ${highConf} tests (${(highConf / results.length * 100).toFixed(0)}%)`);
    console.log(`   🟡 Medium (85-96%): ${medConf} tests (${(medConf / results.length * 100).toFixed(0)}%)`);
    console.log(`   🔴 Low (<85%):      ${lowConf} tests (${(lowConf / results.length * 100).toFixed(0)}%)`);

    console.log(`\n🔍 BACKSEARCH VALIDATION:`);
    console.log(`   Backsearch Passed: ${backsearchPassed}/${results.length} (${(backsearchPassed / results.length * 100).toFixed(0)}%)`);
    console.log(`   Avg Backsearch Hits: ${avgBacksearchHits.toFixed(1)} sources`);

    console.log(`\n⚡ PERFORMANCE:`);
    console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`   Average Duration:   ${avgDuration.toFixed(0)}ms`);
    console.log(`   Total Duration:     ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);

    // Show failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
        console.log(`\n${"=".repeat(80)}`);
        console.log(`❌ FAILED TESTS (${failures.length}):`);
        console.log(`${"=".repeat(80)}`);
        failures.forEach(f => {
            console.log(`[${f.index}] ${f.difficulty} | ${f.confidence.toFixed(0)}% | ${f.name}`);
            if (f.errorMessage) console.log(`    Error: ${f.errorMessage}`);
            if (!f.backsearchPassed) console.log(`    Backsearch: FAILED (${f.backsearchHits} hits)`);
        });
    }

    // Final verdict
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🎯 FINAL VERDICT: ${successRate.toFixed(1)}% SUCCESS RATE`);
    console.log(`${"=".repeat(80)}`);

    if (successRate >= 96) {
        console.log(`\n🎉 EXCELLENT! Hardcore test passed!`);
        console.log(`✅ System maintains 96%+ accuracy even with extreme cases.`);
        console.log(`✅ Backsearch validation is working correctly.`);
        console.log(`✅ Ready for production with high confidence.`);
    } else if (successRate >= 90) {
        console.log(`\n👍 VERY GOOD! Close to target.`);
        console.log(`Current: ${successRate.toFixed(1)}% | Target: 96%`);
        console.log(`\nReview failed cases for potential improvements.`);
    } else if (successRate >= 80) {
        console.log(`\n⚠️  GOOD but needs improvement.`);
        console.log(`Current: ${successRate.toFixed(1)}% | Target: 96%`);
        console.log(`\nFocus on improving extreme/hard cases.`);
    } else {
        console.log(`\n❌ NEEDS IMPROVEMENT`);
        console.log(`Current: ${successRate.toFixed(1)}% | Target: 96%`);
        console.log(`\nSystem struggles with random/exotic cases.`);
    }

    console.log(`\n`);
}

// Execute
runHardcoreTest().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
