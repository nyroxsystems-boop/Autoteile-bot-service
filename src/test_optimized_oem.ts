/**
 * Optimized OEM Resolution Test
 * Tests the enhanced multi-source system with realistic scenarios
 */
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../env.production.txt') });

import { resolveOEM } from './services/oemResolver/oemResolver';
import { OEMResolverRequest } from './services/oemResolver/types';

// Realistic test cases with known OEM numbers for validation
const VALIDATION_CASES = [
    {
        name: "BMW 3er F30 320d - Bremsbeläge hinten",
        vehicle: {
            hsn: "0005",
            tsn: "BLH",
            make: "BMW",
            model: "3er F30 320d",
            year: 2014,
            kw: 135
        },
        part: {
            rawText: "Bremsbeläge hinten",
            normalizedCategory: "brake_pad"
        },
        expectedPattern: /^[0-9]{11}$|^[0-9]{7}$/,
        description: "BMW uses 11 or 7 digit numeric codes"
    },
    {
        name: "VW Passat B8 2.0 TDI - Ölfilter",
        vehicle: {
            hsn: "0603",
            tsn: "BPX",
            make: "Volkswagen",
            model: "Passat B8 2.0 TDI",
            year: 2016,
            kw: 110
        },
        part: {
            rawText: "Ölfilter",
            normalizedCategory: "oil_filter"
        },
        expectedPattern: /^[0-9][A-Z0-9]{8,11}$/,
        description: "VW uses alphanumeric codes starting with digit"
    },
    {
        name: "Audi A4 B9 2.0 TDI - Innenraumfilter",
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
        description: "Audi uses VAG pattern like VW"
    },
    {
        name: "Mercedes E-Klasse W212 E220 CDI - Kraftstofffilter",
        vehicle: {
            hsn: "1313",
            tsn: "BGU",
            make: "Mercedes-Benz",
            model: "E-Klasse W212 E220 CDI",
            year: 2013,
            kw: 125
        },
        part: {
            rawText: "Kraftstofffilter",
            normalizedCategory: "fuel_filter"
        },
        expectedPattern: /^[A-Z][0-9]{9,12}$|^[0-9]{10,13}$/,
        description: "Mercedes uses A-prefix or numeric codes"
    },
    {
        name: "Skoda Octavia III 2.0 TDI - Stoßdämpfer hinten",
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
        description: "Skoda uses VAG pattern"
    }
];

interface TestResult {
    name: string;
    success: boolean;
    confidence: number;
    primaryOEM: string | null;
    candidateCount: number;
    sourceCount: number;
    patternMatch: boolean;
    notes: string;
    duration: number;
}

async function runOptimizedTests() {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         🚗 OPTIMIZED OEM RESOLUTION TEST SUITE 🔧                         ║
║                                                                            ║
║  Testing Enhanced Multi-Source System                                     ║
║  Target: 96% Confidence with Pattern Validation                           ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
    `);

    const results: TestResult[] = [];
    let totalDuration = 0;

    for (let i = 0; i < VALIDATION_CASES.length; i++) {
        const testCase = VALIDATION_CASES[i];

        console.log(`\n${"=".repeat(80)}`);
        console.log(`TEST ${i + 1}/${VALIDATION_CASES.length}: ${testCase.name}`);
        console.log(`${"=".repeat(80)}`);
        console.log(`Vehicle: ${testCase.vehicle.make} ${testCase.vehicle.model} (${testCase.vehicle.year})`);
        console.log(`Part: ${testCase.part.rawText}`);
        console.log(`Expected Pattern: ${testCase.description}`);
        console.log(`${"-".repeat(80)}`);

        const req: OEMResolverRequest = {
            orderId: `OPT-TEST-${i + 1}`,
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
            ).size;

            // Check pattern match
            const patternMatch = result.primaryOEM
                ? testCase.expectedPattern.test(result.primaryOEM)
                : false;

            const success = !!(
                result.primaryOEM &&
                result.overallConfidence >= 0.85 &&
                patternMatch
            );

            // Store result
            results.push({
                name: testCase.name,
                success,
                confidence: result.overallConfidence,
                primaryOEM: result.primaryOEM || null,
                candidateCount: result.candidates.length,
                sourceCount: uniqueSources,
                patternMatch,
                notes: result.notes || "",
                duration
            });

            // Display results
            console.log(`\n📊 RESULTS:`);
            console.log(`   ⏱️  Duration: ${duration}ms`);
            console.log(`   🎯 Primary OEM: ${result.primaryOEM || "❌ NOT FOUND"}`);
            console.log(`   📈 Confidence: ${(result.overallConfidence * 100).toFixed(1)}%`);
            console.log(`   📚 Candidates: ${result.candidates.length}`);
            console.log(`   🔗 Unique Sources: ${uniqueSources}`);
            console.log(`   ✓  Pattern Match: ${patternMatch ? "✅ YES" : "❌ NO"}`);
            console.log(`   📝 Notes: ${result.notes || "N/A"}`);

            // Show top 3 candidates
            if (result.candidates.length > 0) {
                console.log(`\n   🏆 Top Candidates:`);
                const topCandidates = result.candidates
                    .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
                    .slice(0, 3);

                topCandidates.forEach((c: any, idx: number) => {
                    const sourceCount = c.source.split('+').length;
                    console.log(`      ${idx + 1}. ${c.oem} - ${(c.confidence * 100).toFixed(0)}% (${sourceCount} sources: ${c.source})`);
                });
            }

            // Verdict
            if (success) {
                console.log(`\n✅ TEST PASSED`);
            } else {
                console.log(`\n❌ TEST FAILED`);
                if (!result.primaryOEM) console.log(`   ❌ No OEM found`);
                if (result.overallConfidence < 0.85) console.log(`   ⚠️  Confidence too low: ${(result.overallConfidence * 100).toFixed(1)}%`);
                if (!patternMatch) console.log(`   ⚠️  Pattern mismatch`);
            }

        } catch (error: any) {
            const duration = Date.now() - startTime;
            totalDuration += duration;

            console.log(`\n❌ ERROR: ${error.message}`);
            console.log(`Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}`);

            results.push({
                name: testCase.name,
                success: false,
                confidence: 0,
                primaryOEM: null,
                candidateCount: 0,
                sourceCount: 0,
                patternMatch: false,
                notes: `Error: ${error.message}`,
                duration
            });
        }
    }

    // Final Summary
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📊 FINAL SUMMARY`);
    console.log(`${"=".repeat(80)}`);

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const avgDuration = totalDuration / results.length;

    const highConf = results.filter(r => r.confidence >= 0.96).length;
    const medConf = results.filter(r => r.confidence >= 0.85 && r.confidence < 0.96).length;
    const lowConf = results.filter(r => r.confidence < 0.85).length;

    console.log(`\nTotal Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed} (${(passed / results.length * 100).toFixed(0)}%)`);
    console.log(`❌ Failed: ${failed} (${(failed / results.length * 100).toFixed(0)}%)`);
    console.log(`\nConfidence Distribution:`);
    console.log(`  🟢 High (≥96%): ${highConf} tests`);
    console.log(`  🟡 Medium (85-96%): ${medConf} tests`);
    console.log(`  🔴 Low (<85%): ${lowConf} tests`);
    console.log(`\nPerformance:`);
    console.log(`  📊 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`  ⏱️  Average Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`  ⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);

    // Detailed breakdown
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📋 DETAILED RESULTS`);
    console.log(`${"=".repeat(80)}`);

    results.forEach((r, i) => {
        const status = r.success ? "✅" : "❌";
        const conf = (r.confidence * 100).toFixed(0);
        console.log(`${status} Test ${i + 1}: ${conf}% - ${r.primaryOEM || "NO OEM"} - ${r.sourceCount} sources - ${r.name}`);
    });

    // Final verdict
    const successRate = (passed / results.length * 100);
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🎯 SUCCESS RATE: ${successRate.toFixed(1)}%`);
    console.log(`${"=".repeat(80)}`);

    if (successRate >= 96) {
        console.log(`\n🎉 EXCELLENT! Target of 96% achieved!`);
        console.log(`The enhanced multi-source system is working as expected.`);
    } else if (successRate >= 80) {
        console.log(`\n👍 GOOD! System is performing well.`);
        console.log(`Consider fine-tuning confidence thresholds or adding more sources.`);
    } else {
        console.log(`\n⚠️  NEEDS IMPROVEMENT`);
        console.log(`Current success rate (${successRate.toFixed(1)}%) is below target (96%).`);
        console.log(`Review failed cases and consider:`);
        console.log(`  - Adding more reliable data sources`);
        console.log(`  - Improving pattern validation`);
        console.log(`  - Adjusting confidence calculation`);
    }

    console.log(`\n`);
}

// Run tests
runOptimizedTests().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
