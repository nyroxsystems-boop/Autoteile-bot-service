/**
 * 🧪 OEM RESOLVER v2 — LIVE TEST (Plain Node.js, zero dependencies)
 * 
 * Usage:
 *   GEMINI_API_KEY=xxx node test-oem-live.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env if exists
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY || API_KEY === 'your-gemini-api-key') {
  console.error('\n❌ GEMINI_API_KEY nicht gesetzt!');
  console.error('   GEMINI_API_KEY=dein-key node test-oem-live.mjs\n');
  process.exit(1);
}

// ── Gemini API ──
async function callGemini(prompt, systemInstruction) {
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
  if (!resp.ok) throw new Error(`Gemini API ${resp.status}: ${(await resp.text()).substring(0, 200)}`);
  const data = await resp.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text || '';
  const chunks = [];
  for (const c of candidate?.groundingMetadata?.groundingChunks || []) {
    if (c.web) chunks.push(c.web);
  }
  return { text, groundingChunks: chunks, isGrounded: chunks.length > 0 };
}

// ── Brand configs ──
const BRANDS = {
  BMW: { hint: 'BMW OEM: exakt 11 Ziffern', ex: '34116858652, 11428507683', dom: 'realoem.com, autodoc.de' },
  VW: { hint: 'VW OEM: 2-3 Zeichen + 6-7 Ziffern + 0-2 Buchstaben', ex: '5Q0615301F, 1K0698151A', dom: '7zap.com, autodoc.de' },
  MERCEDES: { hint: 'Mercedes OEM: A + 10 Ziffern', ex: 'A2054211012, A0004206400', dom: 'catcar.info, autodoc.de' },
  AUDI: { hint: 'Audi OEM: VAG-Format', ex: '8K0615301B, 4G0698151C', dom: '7zap.com, autodoc.de' },
  OPEL: { hint: 'Opel OEM: 7-10 Ziffern', ex: '13502050', dom: 'autodoc.de, daparto.de' },
  FORD: { hint: 'Ford OEM: 7‑stellig FINIS', ex: '1738818', dom: 'autodoc.de, daparto.de' },
  TOYOTA: { hint: 'Toyota OEM: 10 Ziffern', ex: '4351202380', dom: 'amayama.com, autodoc.de' },
  HYUNDAI: { hint: 'Hyundai OEM: 10‑stellig alphanum.', ex: '51712D7500', dom: 'autodoc.de' },
  RENAULT: { hint: 'Renault OEM: 10‑stellig', ex: '402068532R', dom: 'autodoc.de, oscaro.de' },
  SKODA: { hint: 'Skoda OEM: VAG-Format', ex: '5E0615301A', dom: '7zap.com, autodoc.de' },
  PEUGEOT: { hint: 'Peugeot OEM: PSA 10‑stellig', ex: '1612293880', dom: 'autodoc.de, oscaro.de' },
  FIAT: { hint: 'Fiat OEM: 8 Ziffern', ex: '51935455', dom: 'autodoc.de' },
  VOLVO: { hint: 'Volvo OEM: 7‑8 Ziffern', ex: '31423554', dom: 'autodoc.de' },
};

// ── Aftermarket filter ──
const AM = 'TRW ATE BREMBO EBC ZIMMERMANN TEXTAR BOSCH FEBI LEMFORDER MEYLE MAPCO MOOG SACHS LUK VALEO NGK DENSO BERU MANN HENGST MAHLE KNECHT FILTRON BILSTEIN KYB MONROE BEHR HELLA NISSENS SWAG TOPRAN OPTIMAL DAYCO GATES CONTITECH DELPHI DORMAN SKF ELRING'.split(' ');
function isAM(oem) {
  const u = oem.toUpperCase();
  return AM.some(b => u.startsWith(b) || u.includes(b));
}

// ── Test cases ──
const TESTS = [
  { n: 'BMW 3er Bremsscheibe', b: 'BMW', v: 'BMW 3er F30 320i 2015', p: 'Bremsscheibe vorne', x: '34116858652' },
  { n: 'VW Golf 7 Ölfilter', b: 'VW', v: 'VW Golf 7 1.4 TSI 2017', p: 'Ölfilter', x: '04E115561H' },
  { n: 'Mercedes C200 Bremsbelag', b: 'MERCEDES', v: 'Mercedes C‑Klasse W205 C200 2018', p: 'Bremsbelag hinten' },
  { n: 'Audi A4 B9 Luftfilter', b: 'AUDI', v: 'Audi A4 B9 2.0 TFSI 2019', p: 'Luftfilter' },
  { n: 'Opel Astra K Stoßdämpfer', b: 'OPEL', v: 'Opel Astra K 1.4 Turbo 2016', p: 'Stoßdämpfer vorne' },
  { n: 'Ford Focus Kupplung', b: 'FORD', v: 'Ford Focus MK3 1.6 TDCi 2014', p: 'Kupplungssatz' },
  { n: 'Toyota Yaris Zündkerze', b: 'TOYOTA', v: 'Toyota Yaris 1.0 VVT‑i 2018', p: 'Zündkerze' },
  { n: 'Hyundai Tucson Riemen', b: 'HYUNDAI', v: 'Hyundai Tucson 2.0 CRDi 2019', p: 'Keilrippenriemen' },
  { n: 'Renault Clio Bremssch.', b: 'RENAULT', v: 'Renault Clio 4 1.5 dCi 2016', p: 'Bremsscheibe hinten' },
  { n: 'BMW X3 Querlenker', b: 'BMW', v: 'BMW X3 F25 xDrive20d 2016', p: 'Querlenker vorne unten links' },
  { n: 'VW Passat Wasserpumpe', b: 'VW', v: 'VW Passat B8 2.0 TDI 2018', p: 'Wasserpumpe' },
  { n: 'Skoda Octavia Wischer', b: 'SKODA', v: 'Skoda Octavia 3 1.6 TDI 2017', p: 'Scheibenwischer vorne' },
  { n: 'Peugeot 308 Pollenfilter', b: 'PEUGEOT', v: 'Peugeot 308 1.6 BlueHDi 2017', p: 'Innenraumfilter' },
  { n: 'Fiat 500 Koppelstange', b: 'FIAT', v: 'Fiat 500 1.2 2016', p: 'Koppelstange vorne' },
  { n: 'Volvo V60 Bremsbelag', b: 'VOLVO', v: 'Volvo V60 D4 2017', p: 'Bremsbelag vorne' },
];

// ── Build prompt ──
function prompt(tc) {
  const cfg = BRANDS[tc.b] || {};
  return `Du bist ein Automobil-Ersatzteil-Experte. Finde die ECHTE OEM-Teilenummer.

FAHRZEUG: ${tc.v}
TEIL: ${tc.p}

SUCHSTRATEGIE:
1. Suche auf: ${cfg.dom || 'autodoc.de, daparto.de'}
2. Suche nach "${tc.p} ${tc.v} OEM Teilenummer"

${cfg.hint ? `NUMMERNFORMAT: ${cfg.hint}` : ''}
${cfg.ex ? `BEISPIELE für korrekte ${tc.b}-Nummern: ${cfg.ex}` : ''}

REGELN:
- NUR Original-OE/OEM-Nummern vom Hersteller ${tc.b}
- KEINE Aftermarket-Nummern (Brembo, TRW, ATE, Bosch, Febi, Meyle = FALSCH)
- Wenn du KEINE sichere Nummer findest: "oem_numbers": []
- ERFINDE NIEMALS eine Nummer

Antworte NUR als JSON:
{"oem_numbers":[{"number":"OEM-NUMMER","source_url":"URL","confidence":"high/medium/low"}],"notes":""}`;
}

// ── Parse ──
function parse(text) {
  try {
    const c = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const m = c.match(/\{[\s\S]*"oem_numbers"[\s\S]*\}/);
    const d = JSON.parse(m ? m[0] : c);
    return (d.oem_numbers || []).filter(i => i.number).map(i => ({
      number: i.number.replace(/[\s-]/g, '').toUpperCase(),
      conf: i.confidence,
      url: i.source_url,
    })).filter(i => i.number.length >= 5 && i.number.length <= 18);
  } catch { return []; }
}

// ── Main ──
console.log('\n' + '═'.repeat(72));
console.log('  🧪 OEM RESOLVER v2 — LIVE TEST');
console.log('  Externe Plattformen: KEINE (nur Gemini 2.0 Flash + Google Search)');
console.log('═'.repeat(72));
console.log(`  📋 ${TESTS.length} Test-Cases\n`);

let found = 0, matched = 0, noResult = 0, wrong = 0, totalMs = 0;
const rows = [];

for (let i = 0; i < TESTS.length; i++) {
  const tc = TESTS[i];
  process.stdout.write(`  [${String(i+1).padStart(2)}/${TESTS.length}] ${tc.n.padEnd(30)}`);
  const t0 = Date.now();
  try {
    const res = await callGemini(prompt(tc), 'Du bist ein Automobil-Teilenummer-Experte. Suche im Internet und finde die korrekte OEM-Teilenummer. Antworte NUR im JSON-Format. ERFINDE NIEMALS eine Nummer.');
    const ms = Date.now() - t0; totalMs += ms;
    const oems = parse(res.text).filter(o => !isAM(o.number));
    const top = oems[0];
    if (top) {
      let st;
      if (tc.x) {
        const eq = top.number.replace(/[-\s]/g,'') === tc.x.replace(/[-\s]/g,'');
        if (eq) { st = '✅ MATCH'; matched++; found++; }
        else { st = `⚠️  erw: ${tc.x}`; wrong++; found++; }
      } else { st = '✅'; found++; }
      console.log(`→ ${top.number} (${top.conf||'?'}, ${ms}ms, ${res.groundingChunks.length}src) ${st}`);
      rows.push({ n: tc.n, oem: top.number, ms, src: res.groundingChunks.length, st });
    } else {
      console.log(`→ ❌ keine OEM (${ms}ms)`);
      noResult++;
      rows.push({ n: tc.n, oem: '-', ms, src: res.groundingChunks.length, st: '❌' });
    }
  } catch (e) {
    const ms = Date.now() - t0; totalMs += ms;
    console.log(`→ 💥 ${e.message?.substring(0,50)} (${ms}ms)`);
    noResult++;
    rows.push({ n: tc.n, oem: '-', ms, src: 0, st: '💥' });
  }
  if (i < TESTS.length - 1) await new Promise(r => setTimeout(r, 1500));
}

const pct = ((found / TESTS.length) * 100).toFixed(0);
const avg = (totalMs / TESTS.length / 1000).toFixed(1);

console.log('\n' + '═'.repeat(72));
console.log('  📊 ERGEBNIS');
console.log('═'.repeat(72));
console.log(`  ✅ OEM gefunden:      ${found}/${TESTS.length} (${pct}%)`);
if (matched) console.log(`  🎯 Exakt gematcht:    ${matched}`);
if (wrong) console.log(`  ⚠️  Andere OEM:        ${wrong}`);
console.log(`  ❌ Nicht gefunden:     ${noResult}/${TESTS.length}`);
console.log(`  ⏱  Ø Suchzeit:        ${avg}s`);
console.log(`  💰 Kosten:            ~$${(TESTS.length * 0.001).toFixed(3)}`);
console.log(`  🌐 Externe APIs:      0`);
console.log('═'.repeat(72));
if (parseInt(pct) >= 90) console.log('\n  🎯 90%-Ziel: ✅ ERREICHT!');
else if (parseInt(pct) >= 70) console.log(`\n  🎯 90%-Ziel: ⚠️ ${pct}% — nah dran, Multi-Query-Retry bringt den Rest`);
else console.log(`\n  🎯 90%-Ziel: ❌ ${pct}% — Prompts verbessern`);
console.log('');
