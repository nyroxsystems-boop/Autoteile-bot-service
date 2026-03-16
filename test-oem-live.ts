#!/usr/bin/env npx tsx
/**
 * 🧪 STANDALONE OEM v2 Live Test
 * 
 * Tests OEM resolution using ONLY Gemini AI — zero external platforms.
 * This script is self-contained: no project imports needed.
 * 
 * Usage:
 *   GEMINI_API_KEY=xxx npx tsx test-oem-live.ts
 *   
 *   Or create a .env file with GEMINI_API_KEY=xxx and run:
 *   npx tsx test-oem-live.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env if exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY || API_KEY === 'your-gemini-api-key') {
  console.error('\n❌ GEMINI_API_KEY nicht gesetzt!');
  console.error('   Option 1: GEMINI_API_KEY=dein-key npx tsx test-oem-live.ts');
  console.error('   Option 2: echo "GEMINI_API_KEY=dein-key" > .env && npx tsx test-oem-live.ts\n');
  process.exit(1);
}

// ============================================================================
// Gemini API Client (minimal, no SDK needed)
// ============================================================================

async function callGemini(prompt: string, systemInstruction: string): Promise<{ text: string; groundingChunks: any[]; isGrounded: boolean }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
  
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    tools: [{ googleSearchRetrieval: {} }],
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${errText.substring(0, 200)}`);
  }

  const data = await resp.json() as any;
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text || '';
  const groundingMeta = candidate?.groundingMetadata;
  
  const groundingChunks: any[] = [];
  if (groundingMeta?.groundingChunks) {
    for (const chunk of groundingMeta.groundingChunks) {
      if (chunk.web) groundingChunks.push(chunk.web);
    }
  }

  return { text, groundingChunks, isGrounded: groundingChunks.length > 0 };
}

// ============================================================================
// Brand Configs
// ============================================================================

const BRAND_CONFIGS: Record<string, { formatHint: string; examples: string[]; domains: string[] }> = {
  BMW: {
    formatHint: 'BMW OEM-Nummern sind IMMER exakt 11 Ziffern, z.B. 34116792219',
    examples: ['34116858652', '11428507683', '64119237555'],
    domains: ['realoem.com', 'autodoc.de', 'daparto.de'],
  },
  VW: {
    formatHint: 'VW OEM-Nummern: 2-3 Zeichen + 3 Ziffern + 3 Ziffern + 0-2 Buchstaben',
    examples: ['5Q0615301F', '1K0698151A'],
    domains: ['7zap.com', 'autodoc.de', 'daparto.de'],
  },
  VOLKSWAGEN: {
    formatHint: 'VW OEM-Nummern: 2-3 Zeichen + 3 Ziffern + 3 Ziffern + 0-2 Buchstaben',
    examples: ['5Q0615301F', '1K0698151A'],
    domains: ['7zap.com', 'autodoc.de', 'daparto.de'],
  },
  MERCEDES: {
    formatHint: 'Mercedes OEM-Nummern: "A" + 10 Ziffern, z.B. A2054211012',
    examples: ['A2054211012', 'A0004206400'],
    domains: ['catcar.info', 'autodoc.de', 'daparto.de'],
  },
  AUDI: {
    formatHint: 'Audi OEM-Nummern: VAG-Format, z.B. 8K0615301B',
    examples: ['8K0615301B', '4G0698151C'],
    domains: ['7zap.com', 'autodoc.de'],
  },
  OPEL: {
    formatHint: 'Opel OEM-Nummern: 7-10 Ziffern, z.B. 13502050',
    examples: ['13502050', '55594651'],
    domains: ['autodoc.de', 'daparto.de'],
  },
  FORD: {
    formatHint: 'Ford OEM: 7-stellig FINIS oder Engineering-Format',
    examples: ['1738818', '2275819'],
    domains: ['autodoc.de', 'daparto.de'],
  },
  TOYOTA: {
    formatHint: 'Toyota OEM-Nummern: 10 Ziffern, z.B. 4351202380',
    examples: ['4351202380', '0446502390'],
    domains: ['amayama.com', 'autodoc.de'],
  },
  HYUNDAI: {
    formatHint: 'Hyundai OEM: 10-stellig alphanumerisch',
    examples: ['51712D7500'],
    domains: ['autodoc.de', 'daparto.de'],
  },
  RENAULT: {
    formatHint: 'Renault OEM: 10-stellig, z.B. 402068532R',
    examples: ['402068532R'],
    domains: ['autodoc.de', 'oscaro.de'],
  },
  SKODA: {
    formatHint: 'Skoda OEM: VAG-Format',
    examples: ['5E0615301A'],
    domains: ['7zap.com', 'autodoc.de'],
  },
  PEUGEOT: {
    formatHint: 'Peugeot OEM: PSA-Format, 10-stellig',
    examples: ['1612293880'],
    domains: ['autodoc.de', 'oscaro.de'],
  },
  FIAT: {
    formatHint: 'Fiat OEM: 8 Ziffern',
    examples: ['51935455'],
    domains: ['autodoc.de', 'daparto.de'],
  },
  VOLVO: {
    formatHint: 'Volvo OEM: 7-8 oder 10 Ziffern',
    examples: ['31423554'],
    domains: ['autodoc.de', 'daparto.de'],
  },
};

// ============================================================================
// Aftermarket Filter
// ============================================================================

const AFTERMARKET_BRANDS = new Set([
  'TRW', 'ATE', 'BREMBO', 'EBC', 'ZIMMERMANN', 'TEXTAR', 'BOSCH', 'FEBI',
  'LEMFORDER', 'MEYLE', 'MAPCO', 'MOOG', 'SACHS', 'LUK', 'VALEO', 'FAG',
  'INA', 'SNR', 'NGK', 'DENSO', 'BERU', 'CHAMPION', 'MANN', 'HENGST',
  'MAHLE', 'KNECHT', 'PURFLUX', 'FILTRON', 'BILSTEIN', 'KAYABA', 'KYB',
  'MONROE', 'BEHR', 'HELLA', 'NISSENS', 'NRF', 'SWAG', 'TOPRAN', 'OPTIMAL',
  'DAYCO', 'GATES', 'CONTITECH', 'DELPHI', 'DORMAN', 'SKF', 'ELRING',
  'WVA', 'GDB', 'DF',
]);

function isAftermarket(oem: string): boolean {
  const upper = oem.toUpperCase();
  for (const brand of AFTERMARKET_BRANDS) {
    if (upper.startsWith(brand) || upper.includes(brand)) return true;
  }
  return /^WVA\s?\d{4,5}$/i.test(oem) || /^GDB\d{3,5}$/i.test(oem) || /^DF\d{4,6}$/i.test(oem);
}

// ============================================================================
// Test Cases
// ============================================================================

interface TestCase {
  name: string;
  brand: string;
  vehicle: string;
  part: string;
  expectedOem?: string;
}

const TEST_CASES: TestCase[] = [
  { name: 'BMW 3er Bremsscheibe', brand: 'BMW', vehicle: 'BMW 3er F30 320i 2015', part: 'Bremsscheibe vorne', expectedOem: '34116858652' },
  { name: 'VW Golf 7 Ölfilter', brand: 'VW', vehicle: 'VW Golf 7 1.4 TSI 2017', part: 'Ölfilter', expectedOem: '04E115561H' },
  { name: 'Mercedes C200 Bremsbelag', brand: 'MERCEDES', vehicle: 'Mercedes C-Klasse W205 C200 2018', part: 'Bremsbelag hinten' },
  { name: 'Audi A4 B9 Luftfilter', brand: 'AUDI', vehicle: 'Audi A4 B9 2.0 TFSI 2019', part: 'Luftfilter' },
  { name: 'Opel Astra K Stoßdämpfer', brand: 'OPEL', vehicle: 'Opel Astra K 1.4 Turbo 2016', part: 'Stoßdämpfer vorne' },
  { name: 'Ford Focus Kupplungssatz', brand: 'FORD', vehicle: 'Ford Focus MK3 1.6 TDCi 2014', part: 'Kupplungssatz' },
  { name: 'Toyota Yaris Zündkerze', brand: 'TOYOTA', vehicle: 'Toyota Yaris 1.0 VVT-i 2018', part: 'Zündkerze' },
  { name: 'Hyundai Tucson Riemen', brand: 'HYUNDAI', vehicle: 'Hyundai Tucson 2.0 CRDi 2019', part: 'Keilrippenriemen' },
  { name: 'Renault Clio Bremsscheibe', brand: 'RENAULT', vehicle: 'Renault Clio 4 1.5 dCi 2016', part: 'Bremsscheibe hinten' },
  { name: 'BMW X3 Querlenker', brand: 'BMW', vehicle: 'BMW X3 F25 xDrive20d 2016', part: 'Querlenker vorne unten links' },
  { name: 'VW Passat Wasserpumpe', brand: 'VW', vehicle: 'VW Passat B8 2.0 TDI 2018', part: 'Wasserpumpe' },
  { name: 'Skoda Octavia Wischer', brand: 'SKODA', vehicle: 'Skoda Octavia 3 1.6 TDI 2017', part: 'Scheibenwischer vorne' },
  { name: 'Peugeot 308 Pollenfilter', brand: 'PEUGEOT', vehicle: 'Peugeot 308 1.6 BlueHDi 2017', part: 'Innenraumfilter' },
  { name: 'Fiat 500 Koppelstange', brand: 'FIAT', vehicle: 'Fiat 500 1.2 2016', part: 'Koppelstange vorne' },
  { name: 'Volvo V60 Bremsbelag', brand: 'VOLVO', vehicle: 'Volvo V60 D4 2017', part: 'Bremsbelag vorne' },
];

// ============================================================================
// OEM Search
// ============================================================================

function buildPrompt(tc: TestCase): string {
  const config = BRAND_CONFIGS[tc.brand] || {};
  const domains = (config as any).domains?.join(', ') || 'autodoc.de, daparto.de';
  const formatHint = (config as any).formatHint || '';
  const examples = (config as any).examples?.join(', ') || '';

  return `Du bist ein Automobil-Ersatzteil-Experte. Finde die ECHTE OEM-Teilenummer.

FAHRZEUG: ${tc.vehicle}
TEIL: ${tc.part}

SUCHSTRATEGIE:
1. Suche auf Herstellerkatalogen und Teileshops: ${domains}
2. Suche nach "${tc.part} ${tc.vehicle} OEM Teilenummer"
3. Prüfe ob die gefundene Nummer zum Hersteller ${tc.brand} passt

${formatHint ? `NUMMERNFORMAT: ${formatHint}` : ''}
${examples ? `BEISPIELE für korrekte ${tc.brand}-Nummern: ${examples}` : ''}

REGELN:
- NUR Original-OE/OEM-Nummern vom Hersteller ${tc.brand}
- KEINE Aftermarket-Nummern (Brembo, TRW, ATE, Bosch, Febi, Meyle = FALSCH)
- Wenn du KEINE sichere Nummer findest: "oem_numbers": []
- ERFINDE NIEMALS eine Nummer. Leere Antwort > falsche Nummer
- Gib IMMER die source_url an wo du die Nummer gefunden hast

Antworte NUR als JSON:
{"oem_numbers":[{"number":"OEM-NUMMER","source_url":"URL","description":"Teilbeschreibung","confidence":"high/medium/low"}],"notes":""}`;
}

function parseResponse(text: string): Array<{ number: string; sourceUrl?: string; confidence?: string; description?: string }> {
  const results: Array<{ number: string; sourceUrl?: string; confidence?: string; description?: string }> = [];
  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*"oem_numbers"[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
    const data = JSON.parse(jsonStr);
    if (data.oem_numbers && Array.isArray(data.oem_numbers)) {
      for (const item of data.oem_numbers) {
        if (item.number && typeof item.number === 'string') {
          const normalized = item.number.replace(/[\s-]/g, '').toUpperCase();
          if (normalized.length >= 5 && normalized.length <= 18) {
            results.push({
              number: normalized,
              sourceUrl: item.source_url,
              confidence: item.confidence,
              description: item.description,
            });
          }
        }
      }
    }
  } catch {
    // Regex fallback
    for (const m of text.matchAll(/\b(\d{11})\b/g)) results.push({ number: m[1] });
    for (const m of text.matchAll(/\b([A-Z]\d{10,12})\b/g)) results.push({ number: m[1] });
    for (const m of text.matchAll(/\b([A-Z0-9]{2,3}\d{6}[A-Z]{0,2})\b/gi)) {
      const n = m[1].toUpperCase();
      if (n.length >= 9 && n.length <= 12) results.push({ number: n });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return results.filter(r => {
    const key = r.number.replace(/[-\s.]/g, '').toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================================
// Main Runner
// ============================================================================

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  🧪 OEM RESOLVER v2 — LIVE TEST');
  console.log('  Externe Plattformen: KEINE (nur Gemini AI)');
  console.log('  API: Gemini 2.0 Flash mit Google Search Grounding');
  console.log('═'.repeat(70));
  console.log(`\n📋 ${TEST_CASES.length} Test-Cases\n`);

  let found = 0;
  let matched = 0;
  let noResult = 0;
  let wrong = 0;
  let totalTime = 0;
  const results: Array<{ name: string; oem: string | null; expected?: string; match: string; time: number; sources: number; conf?: string }> = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${TEST_CASES.length}] ${tc.name.padEnd(32)}`);
    
    const start = Date.now();
    try {
      const prompt = buildPrompt(tc);
      const result = await callGemini(prompt, 'Du bist ein Automobil-Teilenummer-Experte. Suche im Internet und finde die korrekte OEM-Teilenummer. Antworte NUR im JSON-Format. ERFINDE NIEMALS eine Nummer.');
      const elapsed = Date.now() - start;
      totalTime += elapsed;

      const parsed = parseResponse(result.text).filter(r => !isAftermarket(r.number));
      const topOem = parsed[0];

      if (topOem) {
        let matchStatus: string;
        if (tc.expectedOem) {
          const norm1 = topOem.number.replace(/[-\s]/g, '').toUpperCase();
          const norm2 = tc.expectedOem.replace(/[-\s]/g, '').toUpperCase();
          if (norm1 === norm2) {
            matchStatus = '✅ MATCH';
            matched++;
            found++;
          } else {
            matchStatus = `⚠️  erwartet: ${tc.expectedOem}`;
            wrong++;
            found++;
          }
        } else {
          matchStatus = '✅';
          found++;
        }
        console.log(`→ ${topOem.number} (${topOem.confidence || '?'}, ${elapsed}ms, ${result.groundingChunks.length} Quellen) ${matchStatus}`);
        results.push({ name: tc.name, oem: topOem.number, expected: tc.expectedOem, match: matchStatus, time: elapsed, sources: result.groundingChunks.length, conf: topOem.confidence });
      } else {
        console.log(`→ ❌ keine OEM (${elapsed}ms)`);
        noResult++;
        results.push({ name: tc.name, oem: null, match: '❌', time: elapsed, sources: result.groundingChunks.length });
      }
    } catch (err: any) {
      const elapsed = Date.now() - start;
      totalTime += elapsed;
      console.log(`→ 💥 ${err?.message?.substring(0, 60)} (${elapsed}ms)`);
      noResult++;
      results.push({ name: tc.name, oem: null, match: '💥', time: elapsed, sources: 0 });
    }

    // Rate limit: 1.5s between calls
    if (i < TEST_CASES.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // ============ Summary ============
  const accuracy = ((found / TEST_CASES.length) * 100).toFixed(0);
  const avgTime = (totalTime / TEST_CASES.length / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(70));
  console.log('  📊 ERGEBNIS');
  console.log('═'.repeat(70));
  console.log(`  ✅ OEM gefunden:      ${found}/${TEST_CASES.length} (${accuracy}%)`);
  if (matched > 0) console.log(`  🎯 Exakt gematcht:    ${matched}/${TEST_CASES.length}`);
  if (wrong > 0) console.log(`  ⚠️  Andere OEM:        ${wrong}/${TEST_CASES.length}`);
  console.log(`  ❌ Nicht gefunden:     ${noResult}/${TEST_CASES.length}`);
  console.log(`  ⏱  Ø Suchzeit:        ${avgTime}s`);
  console.log(`  💰 Kosten pro Suche:  ~$0.001`);
  console.log(`  🌐 Externe APIs:      0 (nur Gemini)`);
  console.log('═'.repeat(70));

  // Target assessment
  console.log('\n  🎯 Ziel 90% Trefferquote:');
  if (parseInt(accuracy) >= 90) {
    console.log(`     ✅ ERREICHT! (${accuracy}%)`);
  } else if (parseInt(accuracy) >= 70) {
    console.log(`     ⚠️  Nah dran (${accuracy}%). Multi-Query-Retry und DB-Learning werden helfen.`);
  } else {
    console.log(`     ❌ Noch Arbeit nötig (${accuracy}%). Prompts und Validierung verbessern.`);
  }
  console.log('');
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
