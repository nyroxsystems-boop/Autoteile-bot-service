/**
 * FINAL OEM VALIDATION TEST SUITE
 * Comprehensive testing with realistic scenarios and strict validation
 * Target: 96%+ accuracy with multi-source validation
 */
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../env.production.txt') });

import { resolveOEM } from './services/oemResolver/oemResolver';
import { OEMResolverRequest } from './services/oemResolver/types';

// Normalize OEM for pattern matching (remove spaces, hyphens, dots)
function normalizeOEM(oem: string): string {
    return oem.replace(/[\s\-\.]/g, '').toUpperCase();
}

// Extended test cases with various difficulty levels
const TEST_CASES = [
    // === EASY: Common parts with high availability ===
    {
        name: "EASY-1: VW Golf 7 - Ölfilter",
        difficulty: "EASY",
        vehicle: {
            hsn: "0603",
            tsn: "BGU",
            make: "Volkswagen",
            model: "Golf 7 1.6 TDI",
            year: 2015,
            kw: 81
        },
        part: {
            rawText: "Ölfilter",
            normalizedCategory: "oil_filter"
        },
        expectedPattern: /^[0-9][A-Z0-9]{8,11}$/,
        description: "VW VAG pattern"
    },
    {
        name: "EASY-2: BMW 3er F30 - Bremsbeläge vorne",
        difficulty: "EASY",
        vehicle: {
            hsn: "0005",
            tsn: "BLH",
            make: "BMW",
            model: "3er F30 320d",
            year: 2014,
            kw: 135
        },
        part: {
            rawText: "Bremsbeläge vorne",
            normalizedCategory: "brake_pad"
        },
        expectedPattern: /^[0-9]{11}$|^[0-9]{7}$/,
        description: "BMW numeric pattern"
    },
    {
        name: "EASY-3: Mercedes C-Klasse - Luftfilter",
        difficulty: "EASY",
        vehicle: {
            hsn: "1313",
            tsn: "BXY",
            make: "Mercedes-Benz",
            model: "C-Klasse W205 C220d",
            year: 2016,
            kw: 125
        },
        part: {
            rawText: "Luftfilter",
            normalizedCategory: "air_filter"
        },
        expectedPattern: /^[A-Z][0-9]{9,12}$|^[0-9]{10,13}$/,
        description: "Mercedes pattern"
    },

    // === MEDIUM: Less common parts ===
    {
        name: "MEDIUM-1: Audi A4 B9 - Innenraumfilter",
        difficulty: "MEDIUM",
        vehicle: {
            hsn: "0588",
            tsn: "BFL",
            make: "Audi",
            model: "A4 B9 2.0 TDI",
            year: 2018,
            kw: 140
        },
        part: {
            rawText: "Innenraumfilter",
            normalizedCategory: "cabin_filter"
        },
        expectedPattern: /^[0-9][A-Z0-9]{8,11}$/,
        description: "Audi VAG pattern"
    },
    {
        name: "MEDIUM-2: Skoda Octavia III - Stoßdämpfer hinten",
        difficulty: "MEDIUM",
        vehicle: {
            hsn: "8004",
            tsn: "ANJ",
            make: "Skoda",
            model: "Octavia III 2.0 TDI",
            year: 2017,
            kw: 110
        },
        part: {
            rawText: "Stoßdämpfer hinten",
            normalizedCategory: "shock_absorber"
        },
        expectedPattern: /^[0-9][A-Z0-9]{8,11}$/,
        description: "Skoda VAG pattern"
    },
    {
        name: "MEDIUM-3: Ford Focus - Zündspule",
        difficulty: "MEDIUM",
        vehicle: {
            hsn: "8566",
            tsn: "AWJ",
            make: "Ford",
            model: "Focus MK3 1.6 TDCi",
            year: 2013,
            kw: 85
        },
        part: {
            rawText: "Zündspule",
            normalizedCategory: "ignition_coil"
        },
        expectedPattern: /^[0-9A-Z]{7,15}$/,
        description: "Ford pattern"
    },

    // === HARD: Specific/rare parts ===
    {
        name: "HARD-1: VW Passat B8 - Kraftstofffilter",
        difficulty: "HARD",
        vehicle: {
            hsn: "0603",
            tsn: "BPX",
            make: "Volkswagen",
            model: "Passat B8 2.0 TDI",
            year: 2016,
            kw: 110
        },
        part: {
            rawText: "Kraftstofffilter",
            normalizedCategory: "fuel_filter"
        },
        expectedPattern: /^[0-9][A-Z0-9]{8,11}$/,
        description: "VW VAG pattern"
    },
    {
        name: "HARD-2: BMW 5er F10 - Turbolader Dichtung",
        difficulty: "HARD",
        vehicle: {
            hsn: "0005",
            tsn: "BNT",
            make: "BMW",
            model: "5er F10 520d",
            year: 2012,
            kw: 135
        },
        part: {
            rawText: "Turbolader Dichtungssatz",
            normalizedCategory: "turbo_gasket"
        },
        expectedPattern: /^[0-9]{11}$|^[0-9]{7}$/,
        description: "BMW numeric pattern"
    },
    {
        name: "HARD-3: Mercedes E-Klasse - AGR Ventil",
        difficulty: "HARD",
        vehicle: {
            hsn: "1313",
            tsn: "BGU",
            make: "Mercedes-Benz",
            model: "E-Klasse W212 E220 CDI",
            year: 2013,
            kw: 125
        },
        part: {
            rawText: "AGR Ventil",
            normalizedCategory: "egr_valve"
        },
        expectedPattern: /^[A-Z][0-9]{9,12}$|^[0-9]{10,13}$/,
        description: "Mercedes pattern"
    },
    {
        name: "HARD-4: Audi Q5 - Differential Öl",
        difficulty: "HARD",
        vehicle: {
            hsn: "0588",
            tsn: "AYP",
            make: "Audi",
            model: "Q5 2.0 TDI quattro",
            year: 2015,
            kw: 140
        },
        part: {
            rawText: "Differential Öl",
            normalizedCategory: "differential_oil"
        },
        expectedPattern: /^[0-9][A-Z0-9]{8,11}$/,
        description: "Audi VAG pattern"
    }
];

interface DetailedTestResult {
    name: string;
    difficulty: string;
    success: boolean;
    confidence: number;
    primaryOEM: string | null;
    normalizedOEM: string | null;
    candidateCount: number;
    sourceCount: number;
    patternMatch: boolean;
    notes: string;
    duration: number;
    topSources: string[];
}

async function runFinalValidation() {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         🎯 FINAL OEM VALIDATION TEST SUITE 🎯                             ║
║                                                                            ║
║  Enhanced Multi-Source System with AI Validation                          ║
║  Target: 96%+ Accuracy | Pattern Validation | Multi-Source Consensus      ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
    `);

    const results: DetailedTestResult[] = [];
    let totalDuration = 0;

    console.log(`\n📋 Running ${TEST_CASES.length} test cases...\n`);

    for (let i = 0; i < TEST_CASES.length; i++) {
        const testCase = TEST_CASES[i];

        console.log(`${"=".repeat(80)}`);
        console.log(`TEST ${i + 1}/${TEST_CASES.length}: ${testCase.name}`);
        console.log(`Difficulty: ${testCase.difficulty} | Vehicle: ${testCase.vehicle.make} ${testCase.vehicle.model}`);
        console.log(`Part: ${testCase.part.rawText}`);
        console.log(`${"-".repeat(80)}`);

        const req: OEMResolverRequest = {
            orderId: `FINAL-TEST-${i + 1}`,
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
            const topSources = Array.from(uniqueSources).slice(0, 5);

            // Normalize OEM for pattern matching
            const normalizedOEM = result.primaryOEM ? normalizeOEM(result.primaryOEM) : null;

            // Check pattern match with normalized OEM
            const patternMatch = normalizedOEM
                ? testCase.expectedPattern.test(normalizedOEM)
                : false;

            const success = !!(
                result.primaryOEM &&
                result.overallConfidence >= 0.85 &&
                patternMatch
            );

            // Store result
            results.push({
                name: testCase.name,
                difficulty: testCase.difficulty,
                success,
                confidence: result.overallConfidence,
                primaryOEM: result.primaryOEM || null,
                normalizedOEM,
                candidateCount: result.candidates.length,
                sourceCount,
                patternMatch,
                notes: result.notes || "",
                duration,
                topSources
            });

            // Display results
            const statusIcon = success ? "✅" : "❌";
            const confIcon = result.overallConfidence >= 0.96 ? "🟢" :
                result.overallConfidence >= 0.85 ? "🟡" : "🔴";

            console.log(`${statusIcon} ${confIcon} Confidence: ${(result.overallConfidence * 100).toFixed(1)}% | Duration: ${duration}ms`);
            console.log(`   OEM: ${result.primaryOEM || "NOT FOUND"} ${normalizedOEM ? `(normalized: ${normalizedOEM})` : ""}`);
            console.log(`   Pattern: ${patternMatch ? "✅" : "❌"} | Sources: ${sourceCount} | Candidates: ${result.candidates.length}`);

            if (!success) {
                if (!result.primaryOEM) console.log(`   ⚠️  No OEM found`);
                if (result.overallConfidence < 0.85) console.log(`   ⚠️  Low confidence`);
                if (!patternMatch) console.log(`   ⚠️  Pattern mismatch (expected: ${testCase.description})`);
            }

        } catch (error: any) {
            const duration = Date.now() - startTime;
            totalDuration += duration;

            console.log(`❌ ERROR: ${error.message}`);

            results.push({
                name: testCase.name,
                difficulty: testCase.difficulty,
                success: false,
                confidence: 0,
                primaryOEM: null,
                normalizedOEM: null,
                candidateCount: 0,
                sourceCount: 0,
                patternMatch: false,
                notes: `Error: ${error.message}`,
                duration,
                topSources: []
            });
        }
    }

    // === FINAL ANALYSIS ===
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📊 FINAL ANALYSIS`);
    console.log(`${"=".repeat(80)}`);

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const successRate = (passed / results.length * 100);

    // By difficulty
    const easyTests = results.filter(r => r.difficulty === "EASY");
    const mediumTests = results.filter(r => r.difficulty === "MEDIUM");
    const hardTests = results.filter(r => r.difficulty === "HARD");

    const easyPass = easyTests.filter(r => r.success).length;
    const mediumPass = mediumTests.filter(r => r.success).length;
    const hardPass = hardTests.filter(r => r.success).length;

    // Confidence distribution
    const highConf = results.filter(r => r.confidence >= 0.96).length;
    const medConf = results.filter(r => r.confidence >= 0.85 && r.confidence < 0.96).length;
    const lowConf = results.filter(r => r.confidence < 0.85).length;

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const avgDuration = totalDuration / results.length;

    console.log(`\n📈 OVERALL RESULTS:`);
    console.log(`   Total Tests: ${results.length}`);
    console.log(`   ✅ Passed: ${passed} (${successRate.toFixed(1)}%)`);
    console.log(`   ❌ Failed: ${failed} (${(failed / results.length * 100).toFixed(1)}%)`);

    console.log(`\n🎯 BY DIFFICULTY:`);
    console.log(`   EASY:   ${easyPass}/${easyTests.length} passed (${(easyPass / easyTests.length * 100).toFixed(0)}%)`);
    console.log(`   MEDIUM: ${mediumPass}/${mediumTests.length} passed (${(mediumPass / mediumTests.length * 100).toFixed(0)}%)`);
    console.log(`   HARD:   ${hardPass}/${hardTests.length} passed (${(hardPass / hardTests.length * 100).toFixed(0)}%)`);

    console.log(`\n📊 CONFIDENCE DISTRIBUTION:`);
    console.log(`   🟢 High (≥96%):     ${highConf} tests (${(highConf / results.length * 100).toFixed(0)}%)`);
    console.log(`   🟡 Medium (85-96%): ${medConf} tests (${(medConf / results.length * 100).toFixed(0)}%)`);
    console.log(`   🔴 Low (<85%):      ${lowConf} tests (${(lowConf / results.length * 100).toFixed(0)}%)`);

    console.log(`\n⚡ PERFORMANCE:`);
    console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`   Average Duration:   ${avgDuration.toFixed(0)}ms`);
    console.log(`   Total Duration:     ${(totalDuration / 1000).toFixed(1)}s`);

    // Detailed breakdown
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📋 DETAILED BREAKDOWN`);
    console.log(`${"=".repeat(80)}`);

    results.forEach((r, i) => {
        const status = r.success ? "✅" : "❌";
        const conf = (r.confidence * 100).toFixed(0).padStart(3);
        const pattern = r.patternMatch ? "✓" : "✗";
        const oem = r.primaryOEM || "NO_OEM";
        console.log(`${status} [${r.difficulty}] ${conf}% ${pattern} | ${r.sourceCount}src | ${oem.padEnd(15)} | ${r.name}`);
    });

    // Final verdict
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🎯 FINAL VERDICT: ${successRate.toFixed(1)}% SUCCESS RATE`);
    console.log(`${"=".repeat(80)}`);

    if (successRate >= 96) {
        console.log(`\n🎉 EXCELLENT! Target achieved!`);
        console.log(`✅ The enhanced multi-source system meets the 96% accuracy target.`);
        console.log(`✅ All confidence levels are optimal.`);
        console.log(`✅ Pattern validation is working correctly.`);
    } else if (successRate >= 90) {
        console.log(`\n👍 VERY GOOD! Close to target.`);
        console.log(`Current: ${successRate.toFixed(1)}% | Target: 96%`);
        console.log(`\nRecommendations:`);
        console.log(`  • Review failed cases for pattern improvements`);
        console.log(`  • Consider adding more data sources for edge cases`);
    } else if (successRate >= 80) {
        console.log(`\n⚠️  GOOD but needs improvement.`);
        console.log(`Current: ${successRate.toFixed(1)}% | Target: 96%`);
        console.log(`\nAction items:`);
        console.log(`  • Analyze failed cases (especially HARD difficulty)`);
        console.log(`  • Improve confidence calculation for edge cases`);
        console.log(`  • Add more reliable data sources`);
    } else {
        console.log(`\n❌ NEEDS SIGNIFICANT IMPROVEMENT`);
        console.log(`Current: ${successRate.toFixed(1)}% | Target: 96%`);
        console.log(`\nCritical actions:`);
        console.log(`  • Review system architecture`);
        console.log(`  • Add more high-quality data sources`);
        console.log(`  • Improve pattern validation logic`);
        console.log(`  • Consider fallback mechanisms`);
    }

    console.log(`\n`);
}

// Execute
runFinalValidation().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
