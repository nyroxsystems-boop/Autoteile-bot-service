/**
 * OEM Benchmark Runner
 *
 * Runs the APEX pipeline against verified test cases and produces
 * an accuracy report broken down by brand and pipeline phase.
 *
 * Usage: npm run benchmark:oem
 *   or:  ts-node src/services/intelligence/__benchmarks__/oemBenchmark.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import { logger } from '@utils/logger';

interface TestCase {
  id: string;
  make: string;
  model: string;
  year: string;
  part: string;
  expectedOem: string;
  notes?: string;
}

interface BenchmarkResult {
  testId: string;
  make: string;
  expectedOem: string;
  resolvedOem: string | null;
  match: boolean;
  confidence: number;
  pipelinePhase: string;
  latencyMs: number;
  error?: string;
}

interface BenchmarkReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  accuracy: number;
  averageLatencyMs: number;
  byBrand: Record<string, { total: number; passed: number; accuracy: number }>;
  byPhase: Record<string, { total: number; passed: number; accuracy: number }>;
  results: BenchmarkResult[];
}

function normalizeOem(oem: string): string {
  return oem.replace(/[\s\-\.]/g, '').toUpperCase();
}

export async function runOemBenchmark(): Promise<BenchmarkReport> {
  // Load test cases
  const testCasesPath = path.join(__dirname, 'testCases.json');
  const testCases: TestCase[] = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));

  logger.info(`[Benchmark] Starting OEM benchmark with ${testCases.length} test cases`);

  const results: BenchmarkResult[] = [];
  const byBrand: Record<string, { total: number; passed: number; accuracy: number }> = {};
  const byPhase: Record<string, { total: number; passed: number; accuracy: number }> = {};

  for (const tc of testCases) {
    const start = Date.now();
    let result: BenchmarkResult;

    try {
      // Dynamic import to avoid circular deps during module init
      const { runApexPipeline } = await import('../apexPipeline');

      const pipelineResult = await runApexPipeline({
        vehicle: {
          make: tc.make,
          model: tc.model,
          year: tc.year,
        },
        partQuery: {
          rawText: tc.part,
          normalizedName: tc.part,
        },
      } as any);

      const resolvedOem = pipelineResult?.primaryOEM || pipelineResult?.oemNumber || null;
      const match = resolvedOem
        ? normalizeOem(resolvedOem) === normalizeOem(tc.expectedOem)
        : false;

      result = {
        testId: tc.id,
        make: tc.make,
        expectedOem: tc.expectedOem,
        resolvedOem,
        match,
        confidence: pipelineResult?.overallConfidence || 0,
        pipelinePhase: pipelineResult?.winningPhase || 'unknown',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      result = {
        testId: tc.id,
        make: tc.make,
        expectedOem: tc.expectedOem,
        resolvedOem: null,
        match: false,
        confidence: 0,
        pipelinePhase: 'error',
        latencyMs: Date.now() - start,
        error: err?.message,
      };
    }

    results.push(result);

    // Track by brand
    if (!byBrand[tc.make]) byBrand[tc.make] = { total: 0, passed: 0, accuracy: 0 };
    byBrand[tc.make].total++;
    if (result.match) byBrand[tc.make].passed++;

    // Track by phase
    const phase = result.pipelinePhase;
    if (!byPhase[phase]) byPhase[phase] = { total: 0, passed: 0, accuracy: 0 };
    byPhase[phase].total++;
    if (result.match) byPhase[phase].passed++;

    // Progress log
    const icon = result.match ? '✅' : result.error ? '❌' : '⚠️';
    logger.info(`${icon} [${tc.id}] ${tc.make} ${tc.model} — ${tc.part} → ${result.resolvedOem || 'NONE'} (expected: ${tc.expectedOem})`);
  }

  // Calculate accuracies
  for (const brand of Object.values(byBrand)) {
    brand.accuracy = brand.total > 0 ? Math.round((brand.passed / brand.total) * 100) : 0;
  }
  for (const phase of Object.values(byPhase)) {
    phase.accuracy = phase.total > 0 ? Math.round((phase.passed / phase.total) * 100) : 0;
  }

  const passed = results.filter(r => r.match).length;
  const errors = results.filter(r => r.error).length;
  const totalLatency = results.reduce((sum, r) => sum + r.latencyMs, 0);

  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    totalTests: testCases.length,
    passed,
    failed: testCases.length - passed - errors,
    errors,
    accuracy: Math.round((passed / testCases.length) * 100),
    averageLatencyMs: Math.round(totalLatency / testCases.length),
    byBrand,
    byPhase,
    results,
  };

  // Summary
  logger.info('\n' + '═'.repeat(60));
  logger.info(`OEM Benchmark Report — ${report.timestamp}`);
  logger.info('═'.repeat(60));
  logger.info(`Total: ${report.totalTests} | ✅ ${report.passed} | ⚠️ ${report.failed} | ❌ ${report.errors}`);
  logger.info(`Accuracy: ${report.accuracy}% | Avg Latency: ${report.averageLatencyMs}ms`);
  logger.info('─'.repeat(60));
  logger.info('By Brand:');
  for (const [brand, stats] of Object.entries(byBrand)) {
    logger.info(`  ${brand}: ${stats.accuracy}% (${stats.passed}/${stats.total})`);
  }
  logger.info('─'.repeat(60));
  logger.info('By Phase:');
  for (const [phase, stats] of Object.entries(byPhase)) {
    logger.info(`  ${phase}: ${stats.accuracy}% (${stats.passed}/${stats.total})`);
  }
  logger.info('═'.repeat(60));

  // Save report to file
  const reportPath = path.join(__dirname, `report_${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  logger.info(`Report saved to: ${reportPath}`);

  return report;
}

// Run if called directly
if (require.main === module) {
  // Load env for direct execution
  require('dotenv').config();
  runOemBenchmark()
    .then(report => {
      process.exit(report.accuracy >= 70 ? 0 : 1);
    })
    .catch(err => {
      console.error('Benchmark failed:', err);
      process.exit(1);
    });
}
