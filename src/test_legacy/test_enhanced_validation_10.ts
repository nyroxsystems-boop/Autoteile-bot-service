/**
 * 🧪 ENHANCED VALIDATION SYSTEM - 10 VEHICLE TEST
 * 
 * Detaillierter Test mit vollständiger Dokumentation jedes Validierungs-Schritts
 */

import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../env.production.txt') });

import { resolveOEM } from './services/oemResolver/oemResolver';
import { OEMResolverRequest } from './services/oemResolver/types';
import {
    performEnhancedValidation,
    BacksearchResult,
    ValidationLayer
} from './services/oemResolver/enhancedValidation';

// Test Cases - 10 realistische Fahrzeuge
const TEST_CASES = [
    {
        name: "VW Golf 7 - Ölfilter",
        vehicle: {
            make: "Volkswagen",
            model: "Golf 7 1.6 TDI",
            year: 2015,
            kw: 81,
            hsn: "0603",
            tsn: "BGU"
        },
        part: {
            rawText: "Ölfilter",
            normalizedCategory: "oil_filter"
        }
    },
    {
        name: "BMW 3er F30 - Bremsbeläge vorne",
        vehicle: {
            make: "BMW",
            model: "3er F30 320d",
            year: 2014,
            kw: 135,
            hsn: "0005",
            tsn: "BLH"
        },
        part: {
            rawText: "Bremsbeläge vorne",
            normalizedCategory: "brake_pad"
        }
    },
    {
        name: "Mercedes C-Klasse - Luftfilter",
        vehicle: {
            make: "Mercedes-Benz",
            model: "C-Klasse W205 C220d",
            year: 2016,
            kw: 125,
            hsn: "1313",
            tsn: "BXY"
        },
        part: {
            rawText: "Luftfilter",
            normalizedCategory: "air_filter"
        }
    },
    {
        name: "Audi A4 B9 - Innenraumfilter",
        vehicle: {
            make: "Audi",
            model: "A4 B9 2.0 TDI",
            year: 2018,
            kw: 140,
            hsn: "0588",
            tsn: "BFL"
        },
        part: {
            rawText: "Innenraumfilter",
            normalizedCategory: "cabin_filter"
        }
    },
    {
        name: "Skoda Octavia III - Bremsscheiben vorne",
        vehicle: {
            make: "Skoda",
            model: "Octavia III 2.0 TDI",
            year: 2017,
            kw: 110,
            hsn: "8004",
            tsn: "ANJ"
        },
        part: {
            rawText: "Bremsscheiben vorne",
            normalizedCategory: "brake_disc"
        }
    },
    {
        name: "Ford Focus - Zündspule",
        vehicle: {
            make: "Ford",
            model: "Focus MK3 1.6 TDCi",
            year: 2013,
            kw: 85,
            hsn: "8566",
            tsn: "AWJ"
        },
        part: {
            rawText: "Zündspule",
            normalizedCategory: "ignition_coil"
        }
    },
    {
        name: "Toyota Yaris - Kraftstofffilter",
        vehicle: {
            make: "Toyota",
            model: "Yaris XP9 1.33",
            year: 2009,
            kw: 74,
            hsn: "5013",
            tsn: "AAG"
        },
        part: {
            rawText: "Kraftstofffilter",
            normalizedCategory: "fuel_filter"
        }
    },
    {
        name: "Renault Clio - Stoßdämpfer hinten",
        vehicle: {
            make: "Renault",
            model: "Clio IV 0.9 TCe",
            year: 2015,
            kw: 66,
            hsn: "3333",
            tsn: "AZR"
        },
        part: {
            rawText: "Stoßdämpfer hinten",
            normalizedCategory: "shock_absorber"
        }
    },
    {
        name: "Opel Astra - Lambdasonde",
        vehicle: {
            make: "Opel",
            model: "Astra J 1.4 Turbo",
            year: 2012,
            kw: 103,
            hsn: "0035",
            tsn: "AXP"
        },
        part: {
            rawText: "Lambdasonde",
            normalizedCategory: "lambda_sensor"
        }
    },
    {
        name: "Seat Leon - Querlenker",
        vehicle: {
            make: "Seat",
            model: "Leon 5F 1.6 TDI",
            year: 2016,
            kw: 85,
            hsn: "7593",
            tsn: "AYZ"
        },
        part: {
            rawText: "Querlenker vorne links",
            normalizedCategory: "control_arm"
        }
    }
];

interface DetailedTestResult {
    testName: string;
    vehicle: string;
    part: string;

    // OEM Resolution
    primaryOEM: string | null;
    candidatesFound: number;
    sourcesUsed: number;

    // Enhanced Validation
    validationPassed: boolean;
    finalConfidence: number;
    layers: ValidationLayer[];

    // Timing
    duration: number;

    // Documentation
    stepByStepLog: string[];
}

function formatLayer(layer: ValidationLayer): string {
    const icon = layer.passed ? '✅' : '❌';
    const conf = (layer.confidence * 100).toFixed(0);
    const sign = layer.confidence >= 0 ? '+' : '';
    return `${icon} ${layer.name}: ${sign}${conf}% - ${layer.details}`;
}

async function runEnhancedValidationTest() {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         🧪 ENHANCED VALIDATION SYSTEM - 10 VEHICLE TEST 🧪                ║
║                                                                            ║
║  Detaillierte Dokumentation jedes Validierungs-Schritts                   ║
║  Target: 95%+ Confidence mit 5-Layer Validation                           ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
    `);

    const results: DetailedTestResult[] = [];
    let totalDuration = 0;

    for (let i = 0; i < TEST_CASES.length; i++) {
        const testCase = TEST_CASES[i];
        const stepLog: string[] = [];

        console.log(`\n${"=".repeat(80)}`);
        console.log(`TEST ${i + 1}/${TEST_CASES.length}: ${testCase.name}`);
        console.log(`${"=".repeat(80)}`);
        console.log(`Fahrzeug: ${testCase.vehicle.make} ${testCase.vehicle.model} (${testCase.vehicle.year})`);
        console.log(`Teil: ${testCase.part.rawText}`);
        console.log(`${"-".repeat(80)}\n`);

        stepLog.push(`=== TEST ${i + 1}: ${testCase.name} ===`);
        stepLog.push(`Fahrzeug: ${testCase.vehicle.make} ${testCase.vehicle.model} (${testCase.vehicle.year})`);
        stepLog.push(`Teil: ${testCase.part.rawText}`);
        stepLog.push('');

        const req: OEMResolverRequest = {
            orderId: `ENHANCED-TEST-${i + 1}`,
            vehicle: { ...testCase.vehicle, vin: "" },
            partQuery: { ...testCase.part, suspectedNumber: null }
        };

        const startTime = Date.now();

        try {
            // STEP 1: OEM Resolution
            console.log(`📋 STEP 1: OEM Resolution (Multi-Source Scraping)`);
            stepLog.push('STEP 1: OEM RESOLUTION');
            stepLog.push('------------------------');

            const oemResult = await resolveOEM(req);
            const duration = Date.now() - startTime;
            totalDuration += duration;

            console.log(`   ⏱️  Duration: ${duration}ms`);
            console.log(`   🎯 Primary OEM: ${oemResult.primaryOEM || "NOT FOUND"}`);
            console.log(`   📚 Candidates: ${oemResult.candidates.length}`);

            stepLog.push(`Duration: ${duration}ms`);
            stepLog.push(`Primary OEM: ${oemResult.primaryOEM || "NOT FOUND"}`);
            stepLog.push(`Candidates found: ${oemResult.candidates.length}`);

            if (oemResult.candidates.length > 0) {
                const uniqueSources = new Set(
                    oemResult.candidates.map((c: any) => c.source.split('+')[0])
                );
                console.log(`   🔗 Unique Sources: ${uniqueSources.size}`);
                stepLog.push(`Unique Sources: ${uniqueSources.size}`);
                stepLog.push(`Sources: ${Array.from(uniqueSources).join(', ')}`);

                // Show top 3 candidates
                const topCandidates = oemResult.candidates
                    .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
                    .slice(0, 3);

                console.log(`\n   🏆 Top 3 Candidates:`);
                stepLog.push('\nTop 3 Candidates:');
                topCandidates.forEach((c: any, idx: number) => {
                    const line = `      ${idx + 1}. ${c.oem} - ${(c.confidence * 100).toFixed(0)}% (${c.source})`;
                    console.log(line);
                    stepLog.push(line);
                });
            }

            if (!oemResult.primaryOEM) {
                console.log(`\n❌ NO OEM FOUND - Skipping validation\n`);
                stepLog.push('\n❌ NO OEM FOUND - Test failed');

                results.push({
                    testName: testCase.name,
                    vehicle: `${testCase.vehicle.make} ${testCase.vehicle.model}`,
                    part: testCase.part.rawText,
                    primaryOEM: null,
                    candidatesFound: oemResult.candidates.length,
                    sourcesUsed: 0,
                    validationPassed: false,
                    finalConfidence: 0,
                    layers: [],
                    duration,
                    stepByStepLog: stepLog
                });
                continue;
            }

            // STEP 2: Enhanced Validation
            console.log(`\n🔍 STEP 2: Enhanced 5-Layer Validation`);
            stepLog.push('\n\nSTEP 2: ENHANCED 5-LAYER VALIDATION');
            stepLog.push('------------------------------------');

            // Mock backsearch result (in real scenario, this comes from backsearch.ts)
            const backsearchResult: BacksearchResult = {
                tecdocHit: false,
                autodocHit: false,
                dapartoHit: false,
                ebayHit: true,
                webHit: true,
                totalHits: 2
            };

            const validation = await performEnhancedValidation(
                oemResult.primaryOEM,
                oemResult.candidates,
                testCase.vehicle.make,
                testCase.vehicle.model,
                testCase.part.rawText,
                backsearchResult,
                {
                    enableAIVerification: false, // Disable for faster testing
                    minConfidence: 0.95
                }
            );

            // Display each layer
            console.log(`\n   📊 Validation Layers:`);
            stepLog.push('\nValidation Layers:');
            validation.layers.forEach((layer, idx) => {
                const layerStr = formatLayer(layer);
                console.log(`      ${layerStr}`);
                stepLog.push(`   ${layerStr}`);
            });

            console.log(`\n   🎯 Final Confidence: ${(validation.finalConfidence * 100).toFixed(1)}%`);
            console.log(`   ✓  Validated: ${validation.validated ? '✅ YES' : '❌ NO'} (Threshold: 95%)`);
            console.log(`   📝 Reasoning: ${validation.reasoning}`);

            stepLog.push('');
            stepLog.push(`Final Confidence: ${(validation.finalConfidence * 100).toFixed(1)}%`);
            stepLog.push(`Validated: ${validation.validated ? 'YES' : 'NO'} (Threshold: 95%)`);
            stepLog.push(`Reasoning: ${validation.reasoning}`);

            // Count unique sources
            const uniqueSources = new Set(
                oemResult.candidates.map((c: any) => c.source.split('+')[0])
            );

            // Final verdict
            if (validation.validated) {
                console.log(`\n✅ TEST PASSED - OEM validated with ${(validation.finalConfidence * 100).toFixed(1)}% confidence`);
                stepLog.push('\n✅ TEST PASSED');
            } else {
                console.log(`\n⚠️  TEST WARNING - OEM found but confidence below 95% (${(validation.finalConfidence * 100).toFixed(1)}%)`);
                stepLog.push('\n⚠️ TEST WARNING - Confidence below threshold');
            }

            results.push({
                testName: testCase.name,
                vehicle: `${testCase.vehicle.make} ${testCase.vehicle.model}`,
                part: testCase.part.rawText,
                primaryOEM: oemResult.primaryOEM,
                candidatesFound: oemResult.candidates.length,
                sourcesUsed: uniqueSources.size,
                validationPassed: validation.validated,
                finalConfidence: validation.finalConfidence,
                layers: validation.layers,
                duration,
                stepByStepLog: stepLog
            });

        } catch (error: any) {
            const duration = Date.now() - startTime;
            totalDuration += duration;

            console.log(`\n❌ ERROR: ${error.message}`);
            stepLog.push(`\n❌ ERROR: ${error.message}`);

            results.push({
                testName: testCase.name,
                vehicle: `${testCase.vehicle.make} ${testCase.vehicle.model}`,
                part: testCase.part.rawText,
                primaryOEM: null,
                candidatesFound: 0,
                sourcesUsed: 0,
                validationPassed: false,
                finalConfidence: 0,
                layers: [],
                duration,
                stepByStepLog: stepLog
            });
        }
    }

    // === FINAL SUMMARY ===
    console.log(`\n\n${"=".repeat(80)}`);
    console.log(`📊 FINAL TEST SUMMARY`);
    console.log(`${"=".repeat(80)}`);

    const validated = results.filter(r => r.validationPassed).length;
    const oemFound = results.filter(r => r.primaryOEM !== null).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.finalConfidence, 0) / results.length;
    const avgDuration = totalDuration / results.length;

    console.log(`\n📈 OVERALL RESULTS:`);
    console.log(`   Total Tests: ${results.length}`);
    console.log(`   ✅ Validated (≥95%): ${validated} (${(validated / results.length * 100).toFixed(0)}%)`);
    console.log(`   🎯 OEM Found: ${oemFound} (${(oemFound / results.length * 100).toFixed(0)}%)`);
    console.log(`   📊 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`   ⏱️  Average Duration: ${avgDuration.toFixed(0)}ms`);

    // Layer statistics
    console.log(`\n📊 LAYER STATISTICS:`);
    const layerStats = new Map<string, { passed: number, total: number }>();

    results.forEach(r => {
        r.layers.forEach(layer => {
            const stats = layerStats.get(layer.name) || { passed: 0, total: 0 };
            stats.total++;
            if (layer.passed) stats.passed++;
            layerStats.set(layer.name, stats);
        });
    });

    layerStats.forEach((stats, name) => {
        const passRate = (stats.passed / stats.total * 100).toFixed(0);
        console.log(`   ${name}: ${stats.passed}/${stats.total} passed (${passRate}%)`);
    });

    // Detailed results table
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📋 DETAILED RESULTS`);
    console.log(`${"=".repeat(80)}`);

    results.forEach((r, i) => {
        const status = r.validationPassed ? "✅" : r.primaryOEM ? "⚠️ " : "❌";
        const conf = (r.finalConfidence * 100).toFixed(0).padStart(3);
        const oem = r.primaryOEM || "NO_OEM";
        console.log(`${status} Test ${i + 1}: ${conf}% | ${r.sourcesUsed}src | ${oem.padEnd(15)} | ${r.testName}`);
    });

    // Export detailed logs
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📄 EXPORTING DETAILED LOGS`);
    console.log(`${"=".repeat(80)}`);

    const detailedLog = results.map(r => r.stepByStepLog.join('\n')).join('\n\n' + '='.repeat(80) + '\n\n');

    // Write to file
    const fs = require('fs');
    const logPath = path.join(__dirname, `enhanced_validation_test_${Date.now()}.log`);
    fs.writeFileSync(logPath, detailedLog);

    console.log(`\n✅ Detailed logs exported to: ${logPath}`);

    // Final verdict
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🎯 FINAL VERDICT`);
    console.log(`${"=".repeat(80)}`);

    const validationRate = (validated / results.length * 100);

    if (validationRate >= 95) {
        console.log(`\n🎉 EXCELLENT! ${validationRate.toFixed(0)}% validation rate achieved!`);
        console.log(`✅ Enhanced Validation System is working as expected.`);
    } else if (validationRate >= 80) {
        console.log(`\n👍 GOOD! ${validationRate.toFixed(0)}% validation rate.`);
        console.log(`⚠️  Close to target. Review failed cases for improvements.`);
    } else {
        console.log(`\n⚠️  NEEDS IMPROVEMENT. ${validationRate.toFixed(0)}% validation rate.`);
        console.log(`Target: 95% | Current: ${validationRate.toFixed(0)}%`);
    }

    console.log(`\n`);
}

// Execute
runEnhancedValidationTest().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
