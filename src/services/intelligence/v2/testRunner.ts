#!/usr/bin/env npx ts-node
/**
 * 🧪 OEM RESOLVER v2 — Live Test Script
 *
 * Tests the v2 OEM engine with REAL queries.
 * Uses ONLY: Gemini AI + local SQLite DB. ZERO external platforms.
 *
 * Usage:
 *   npx ts-node src/services/intelligence/v2/testRunner.ts
 *
 * Requires: GEMINI_API_KEY in .env
 */

// Load .env
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { resolveOemV2 } from './oemEngine';
import type { OEMResolverRequest } from '../types';

// ============================================================================
// Test Cases — 20 reale Anfragen von Autoteile-Händlern
// ============================================================================

interface TestCase {
  name: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    kw?: number;
    motorcode?: string;
  };
  part: string;
  expectedOem?: string; // Known correct answer (if available)
}

const TEST_CASES: TestCase[] = [
  {
    name: 'BMW 3er Bremsscheibe vorne',
    vehicle: { make: 'BMW', model: '3er F30 320i', year: 2015, kw: 135 },
    part: 'Bremsscheibe vorne',
    expectedOem: '34116858652',
  },
  {
    name: 'VW Golf 7 Ölfilter',
    vehicle: { make: 'VW', model: 'Golf 7 1.4 TSI', year: 2017, kw: 110 },
    part: 'Ölfilter',
    expectedOem: '04E115561H',
  },
  {
    name: 'Mercedes C-Klasse Bremsbelag hinten',
    vehicle: { make: 'Mercedes', model: 'C-Klasse W205 C200', year: 2018, kw: 135 },
    part: 'Bremsbelag hinten',
  },
  {
    name: 'Audi A4 B9 Luftfilter',
    vehicle: { make: 'Audi', model: 'A4 B9 2.0 TFSI', year: 2019, kw: 140 },
    part: 'Luftfilter',
  },
  {
    name: 'Opel Astra K Stoßdämpfer vorne',
    vehicle: { make: 'Opel', model: 'Astra K 1.4 Turbo', year: 2016, kw: 110 },
    part: 'Stoßdämpfer vorne links',
  },
  {
    name: 'Ford Focus MK3 Kupplung',
    vehicle: { make: 'Ford', model: 'Focus MK3 1.6 TDCi', year: 2014, kw: 85 },
    part: 'Kupplungssatz',
  },
  {
    name: 'Toyota Yaris Zündkerze',
    vehicle: { make: 'Toyota', model: 'Yaris 1.0 VVT-i', year: 2018, kw: 51 },
    part: 'Zündkerze',
  },
  {
    name: 'Hyundai Tucson Keilrippenriemen',
    vehicle: { make: 'Hyundai', model: 'Tucson 2.0 CRDi', year: 2019, kw: 136 },
    part: 'Keilrippenriemen',
  },
  {
    name: 'Renault Clio Bremsscheibe hinten',
    vehicle: { make: 'Renault', model: 'Clio 4 1.5 dCi', year: 2016, kw: 66 },
    part: 'Bremsscheibe hinten',
  },
  {
    name: 'BMW X3 Querlenker vorne',
    vehicle: { make: 'BMW', model: 'X3 F25 xDrive20d', year: 2016, kw: 140 },
    part: 'Querlenker vorne unten links',
  },
  {
    name: 'VW Passat B8 Wasserpumpe',
    vehicle: { make: 'VW', model: 'Passat B8 2.0 TDI', year: 2018, kw: 110 },
    part: 'Wasserpumpe',
  },
  {
    name: 'Skoda Octavia Scheibenwischer',
    vehicle: { make: 'Skoda', model: 'Octavia 3 1.6 TDI', year: 2017, kw: 81 },
    part: 'Scheibenwischer Set vorne',
  },
  {
    name: 'Peugeot 308 Innenraumfilter',
    vehicle: { make: 'Peugeot', model: '308 1.6 BlueHDi', year: 2017, kw: 88 },
    part: 'Innenraumfilter',
  },
  {
    name: 'Fiat 500 Koppelstange',
    vehicle: { make: 'Fiat', model: '500 1.2', year: 2016, kw: 51 },
    part: 'Koppelstange vorne',
  },
  {
    name: 'Volvo V60 Bremsbelag vorne',
    vehicle: { make: 'Volvo', model: 'V60 D4', year: 2017, kw: 140 },
    part: 'Bremsbelag vorne',
  },
];

// ============================================================================
// Runner
// ============================================================================

async function runTests(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('  🧪 OEM RESOLVER v2 — LIVE TEST');
  console.log('  Externe Plattformen: KEINE (nur Gemini AI + lokale DB)');
  console.log('='.repeat(70));

  if (!process.env.GEMINI_API_KEY) {
    console.error('\n❌ GEMINI_API_KEY nicht gesetzt. Bitte in .env eintragen.');
    process.exit(1);
  }

  console.log(`\n📋 ${TEST_CASES.length} Test-Cases geladen\n`);

  let passed = 0;
  let failed = 0;
  let noResult = 0;
  const results: Array<{ name: string; oem: string | null; conf: number; time: number; match: boolean | null }> = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const req: OEMResolverRequest = {
      orderId: `test-${i + 1}`,
      vehicle: tc.vehicle,
      partQuery: { rawText: tc.part, suspectedNumber: null },
    };

    process.stdout.write(`  [${i + 1}/${TEST_CASES.length}] ${tc.name}...`);
    const start = Date.now();

    try {
      const result = await resolveOemV2(req);
      const elapsed = Date.now() - start;
      const oem = result.primaryOEM || null;
      const conf = result.overallConfidence;

      let match: boolean | null = null;
      if (tc.expectedOem && oem) {
        match = oem.replace(/[-\s]/g, '').toUpperCase() === tc.expectedOem.replace(/[-\s]/g, '').toUpperCase();
      }

      if (oem) {
        if (match === true) {
          console.log(` ✅ ${oem} (${(conf * 100).toFixed(0)}%, ${elapsed}ms) — MATCH!`);
          passed++;
        } else if (match === false) {
          console.log(` ⚠️  ${oem} (${(conf * 100).toFixed(0)}%, ${elapsed}ms) — erwartet: ${tc.expectedOem}`);
          failed++;
        } else {
          console.log(` ✅ ${oem} (${(conf * 100).toFixed(0)}%, ${elapsed}ms)`);
          passed++;
        }
      } else {
        console.log(` ❌ keine OEM gefunden (${elapsed}ms)`);
        noResult++;
      }

      results.push({ name: tc.name, oem, conf, time: elapsed, match });

      // Rate limit: wait between tests
      if (i < TEST_CASES.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (err: any) {
      const elapsed = Date.now() - start;
      console.log(` 💥 ERROR: ${err?.message} (${elapsed}ms)`);
      results.push({ name: tc.name, oem: null, conf: 0, time: elapsed, match: null });
      noResult++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('  📊 ERGEBNIS');
  console.log('='.repeat(70));
  console.log(`  ✅ OEM gefunden:     ${passed}/${TEST_CASES.length}`);
  console.log(`  ❌ Keine OEM:        ${noResult}/${TEST_CASES.length}`);
  console.log(`  ⚠️  Falsche OEM:     ${failed}/${TEST_CASES.length}`);
  console.log(`  🎯 Trefferquote:     ${((passed / TEST_CASES.length) * 100).toFixed(0)}%`);

  const avgTime = results.reduce((s, r) => s + r.time, 0) / results.length;
  console.log(`  ⏱  Ø Suchzeit:       ${(avgTime / 1000).toFixed(1)}s`);
  console.log(`  💰 Externe APIs:     0 (nur Gemini AI)`);
  console.log('='.repeat(70));

  // Detailed table
  console.log('\n📋 Detail-Ergebnisse:\n');
  console.log('  ' + '-'.repeat(90));
  console.log('  | # | Fahrzeug + Teil                       | OEM           | Conf  | Zeit  |');
  console.log('  ' + '-'.repeat(90));
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const icon = r.match === true ? '✅' : r.match === false ? '⚠️ ' : r.oem ? '✅' : '❌';
    const name = r.name.padEnd(38).substring(0, 38);
    const oem = (r.oem || '-').padEnd(13).substring(0, 13);
    const conf = `${(r.conf * 100).toFixed(0)}%`.padStart(4);
    const time = `${(r.time / 1000).toFixed(1)}s`.padStart(5);
    console.log(`  | ${icon} | ${name} | ${oem} | ${conf} | ${time} |`);
  }
  console.log('  ' + '-'.repeat(90));
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
