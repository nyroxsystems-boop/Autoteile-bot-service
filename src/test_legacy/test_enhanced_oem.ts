/**
 * Test Script for Enhanced OEM Resolution System
 * Tests multi-source scraping with consensus engine
 */

import { resolveOEM } from "./services/oemResolver/oemResolver";
import { calculateConsensus, applyBrandPatternBoost } from "./services/oemResolver/consensusEngine";

// Test cases covering different brands and scenarios
const testCases = [
    {
        name: "BMW 316ti - Bremsscheiben vorne",
        request: {
            orderId: "test-001",
            vehicle: {
                make: "BMW",
                model: "316ti",
                year: 2003,
                vin: "WBAXXXXXXXXXXXXXX"
            },
            partQuery: {
                rawText: "Bremsscheiben vorne",
                normalizedCategory: "brake_disc"
            }
        },
        expectedPattern: /^[0-9]{11}$|^[0-9]{7}$/
    },
    {
        name: "VW Golf 7 - Bremsbeläge hinten",
        request: {
            orderId: "test-002",
            vehicle: {
                make: "VW",
                model: "Golf 7",
                year: 2015
            },
            partQuery: {
                rawText: "Bremsbeläge hinten",
                normalizedCategory: "brake_pad"
            }
        },
        expectedPattern: /^[0-9][A-Z0-9]{8,11}$/
    },
    {
        name: "Mercedes C-Klasse - Luftfilter",
        request: {
            orderId: "test-003",
            vehicle: {
                make: "Mercedes",
                model: "C-Klasse W205",
                year: 2018
            },
            partQuery: {
                rawText: "Luftfilter",
                normalizedCategory: "air_filter"
            }
        },
        expectedPattern: /^[A-Z][0-9]{9,12}$|^[0-9]{10,13}$/
    },
    {
        name: "Audi A3 8V - Ölfilter",
        request: {
            orderId: "test-004",
            vehicle: {
                make: "Audi",
                model: "A3 8V",
                year: 2016
            },
            partQuery: {
                rawText: "Ölfilter",
                normalizedCategory: "oil_filter"
            }
        },
        expectedPattern: /^[0-9][A-Z0-9]{8,11}$/
    }
];

async function runTests() {
    console.log("🚀 Starting Enhanced OEM Resolution Tests\n");
    console.log("=".repeat(80));

    const results = {
        total: testCases.length,
        passed: 0,
        failed: 0,
        highConfidence: 0, // >= 96%
        mediumConfidence: 0, // >= 85%
        lowConfidence: 0 // < 85%
    };

    for (const testCase of testCases) {
        console.log(`\n📋 Test: ${testCase.name}`);
        console.log("-".repeat(80));

        try {
            const startTime = Date.now();
            const result = await resolveOEM(testCase.request);
            const duration = Date.now() - startTime;

            console.log(`⏱️  Duration: ${duration}ms`);
            console.log(`🎯 Primary OEM: ${result.primaryOEM || "NOT FOUND"}`);
            console.log(`📊 Confidence: ${(result.overallConfidence * 100).toFixed(1)}%`);
            console.log(`📚 Candidates: ${result.candidates.length}`);
            console.log(`📝 Notes: ${result.notes || "N/A"}`);

            // Show top 5 candidates
            if (result.candidates.length > 0) {
                console.log(`\n🏆 Top Candidates:`);
                const topCandidates = result.candidates
                    .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
                    .slice(0, 5);

                topCandidates.forEach((c: any, i: number) => {
                    console.log(`   ${i + 1}. ${c.oem} (${(c.confidence * 100).toFixed(0)}%) - ${c.source}`);
                });
            }

            // Validate pattern match
            let patternMatch = false;
            if (result.primaryOEM) {
                patternMatch = testCase.expectedPattern.test(result.primaryOEM);
                console.log(`\n✅ Pattern Match: ${patternMatch ? "YES" : "NO"}`);
            }

            // Categorize confidence
            if (result.overallConfidence >= 0.96) {
                results.highConfidence++;
                console.log(`✅ HIGH CONFIDENCE (96%+)`);
            } else if (result.overallConfidence >= 0.85) {
                results.mediumConfidence++;
                console.log(`⚠️  MEDIUM CONFIDENCE (85-96%)`);
            } else {
                results.lowConfidence++;
                console.log(`❌ LOW CONFIDENCE (<85%)`);
            }

            // Overall test result
            if (result.primaryOEM && result.overallConfidence >= 0.85 && patternMatch) {
                results.passed++;
                console.log(`\n✅ TEST PASSED`);
            } else {
                results.failed++;
                console.log(`\n❌ TEST FAILED`);
                if (!result.primaryOEM) console.log(`   Reason: No OEM found`);
                if (result.overallConfidence < 0.85) console.log(`   Reason: Low confidence`);
                if (!patternMatch) console.log(`   Reason: Pattern mismatch`);
            }

        } catch (error: any) {
            console.log(`❌ ERROR: ${error.message}`);
            results.failed++;
        }
    }

    // Final Summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total Tests: ${results.total}`);
    console.log(`✅ Passed: ${results.passed} (${(results.passed / results.total * 100).toFixed(0)}%)`);
    console.log(`❌ Failed: ${results.failed} (${(results.failed / results.total * 100).toFixed(0)}%)`);
    console.log(`\nConfidence Distribution:`);
    console.log(`  🟢 High (96%+): ${results.highConfidence}`);
    console.log(`  🟡 Medium (85-96%): ${results.mediumConfidence}`);
    console.log(`  🔴 Low (<85%): ${results.lowConfidence}`);

    const successRate = (results.passed / results.total * 100).toFixed(1);
    console.log(`\n🎯 Success Rate: ${successRate}%`);

    if (parseFloat(successRate) >= 96) {
        console.log(`\n🎉 EXCELLENT! Target of 96% achieved!`);
    } else if (parseFloat(successRate) >= 85) {
        console.log(`\n👍 GOOD! Close to target.`);
    } else {
        console.log(`\n⚠️  NEEDS IMPROVEMENT. Target: 96%`);
    }
}

// Test Consensus Engine separately
async function testConsensusEngine() {
    console.log("\n" + "=".repeat(80));
    console.log("🧪 Testing Consensus Engine");
    console.log("=".repeat(80));

    const mockCandidates = [
        { oem: "1K0615301AA", source: "Kfzteile24", confidence: 0.85, meta: {} },
        { oem: "1K0615301AA", source: "Oscaro", confidence: 0.83, meta: {} },
        { oem: "1K0615301AA", source: "Autodoc", confidence: 0.87, meta: {} },
        { oem: "1K0615301AB", source: "eBay", confidence: 0.70, meta: {} }
    ];

    console.log(`\n📥 Input: ${mockCandidates.length} candidates`);
    mockCandidates.forEach(c => {
        console.log(`   - ${c.oem} from ${c.source} (${(c.confidence * 100).toFixed(0)}%)`);
    });

    let result = calculateConsensus(mockCandidates);

    console.log(`\n📤 Consensus Result:`);
    console.log(`   Primary OEM: ${result.primaryOEM}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Source Count: ${result.sourceCount}`);
    console.log(`   Agreement: ${(result.agreementScore * 100).toFixed(0)}%`);

    // Apply brand pattern boost
    result = applyBrandPatternBoost(result, "VW");

    console.log(`\n🚀 After Brand Pattern Boost:`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);

    if (result.confidence >= 0.96) {
        console.log(`\n✅ Consensus Engine: PASSED (96%+ confidence achieved)`);
    } else {
        console.log(`\n⚠️  Consensus Engine: Needs tuning (${(result.confidence * 100).toFixed(1)}%)`);
    }
}

// Main execution
async function main() {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         🚗 Enhanced OEM Resolution System - Test Suite 🔧                 ║
║                                                                            ║
║  Multi-Source Scraping + AI Validation + Consensus Engine                 ║
║  Target: 96% Accuracy                                                      ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
  `);

    // Check environment
    if (!process.env.OPENAI_API_KEY) {
        console.log("⚠️  WARNING: OPENAI_API_KEY not set. AI features will be disabled.");
        console.log("   Set it with: export OPENAI_API_KEY=sk-proj-...\n");
    } else {
        console.log("✅ OpenAI API Key: Configured\n");
    }

    // Run tests
    await testConsensusEngine();
    await runTests();

    console.log("\n" + "=".repeat(80));
    console.log("✅ All tests completed!");
    console.log("=".repeat(80) + "\n");
}

// Execute
main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
