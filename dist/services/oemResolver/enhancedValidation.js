"use strict";
/**
 * 🎯 ENHANCED MULTI-LAYER OEM VALIDATION SYSTEM
 *
 * 5-Layer Validation Approach für 95%+ Sicherheit:
 *
 * Layer 1: Multi-Source Consensus (Basis-Confidence)
 * Layer 2: Brand Pattern Validation (Schema-Check)
 * Layer 3: Enhanced Backsearch (Multi-Platform)
 * Layer 4: Cross-Reference Validation (OEM ↔ Part Match)
 * Layer 5: AI-Powered Final Verification (GPT-4 Double-Check)
 *
 * Jede Layer erhöht die Confidence schrittweise bis 95%+
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLayer1_Consensus = validateLayer1_Consensus;
exports.validateLayer2_BrandPattern = validateLayer2_BrandPattern;
exports.validateLayer3_Backsearch = validateLayer3_Backsearch;
exports.validateLayer5_AIVerification = validateLayer5_AIVerification;
exports.performEnhancedValidation = performEnhancedValidation;
const logger_1 = require("../../utils/logger");
const fetch = require('node-fetch');
// ============================================================================
// LAYER 1: MULTI-SOURCE CONSENSUS
// ============================================================================
/**
 * Layer 1: Multi-Source Consensus (Strict)
 */
function validateLayer1_Consensus(candidates, primaryOEM) {
    const matchingCandidates = candidates.filter(c => c.oem === primaryOEM);
    const uniqueSources = new Set(matchingCandidates.map(c => c.source.split('+')[0]));
    const sourceCount = uniqueSources.size;
    let confidence = 0;
    let passed = false;
    let details = '';
    if (sourceCount >= 4) {
        confidence = 0.25;
        passed = true;
        details = `${sourceCount} unabhängige Quellen (Maximum Consensus)`;
    }
    else if (sourceCount >= 2) {
        confidence = 0.15;
        passed = true;
        details = `${sourceCount} Quellen bestätigen OEM (High Consensus)`;
    }
    else {
        confidence = -0.20; // HEAVY PENALTY for single source in bombproof mode
        passed = false;
        details = `CRITICAL: Nur ${sourceCount} Quelle gefunden. Unzureichend für bombensichere Validierung.`;
    }
    return {
        name: 'Layer 1: Source Consensus',
        passed,
        confidence,
        details
    };
}
// ============================================================================
// LAYER 2: BRAND PATTERN VALIDATION
// ============================================================================
const BRAND_PATTERNS = {
    'BMW': {
        patterns: [/^[0-9]{11}$/, /^[0-9]{7}$/],
        description: '11 or 7 digit numeric'
    },
    'MERCEDES': {
        patterns: [/^[A-Z][0-9]{9,12}$/, /^[0-9]{10,13}$/],
        description: 'A-prefix or 10-13 digits'
    },
    'MERCEDES-BENZ': {
        patterns: [/^[A-Z][0-9]{9,12}$/, /^[0-9]{10,13}$/],
        description: 'A-prefix or 10-13 digits'
    },
    'AUDI': {
        patterns: [/^[0-9][A-Z0-9]{8,11}$/],
        description: 'VAG pattern (digit + 8-11 alphanumeric)'
    },
    'VW': {
        patterns: [/^[0-9][A-Z0-9]{8,11}$/],
        description: 'VAG pattern (digit + 8-11 alphanumeric)'
    },
    'VOLKSWAGEN': {
        patterns: [/^[0-9][A-Z0-9]{8,11}$/],
        description: 'VAG pattern (digit + 8-11 alphanumeric)'
    },
    'SKODA': {
        patterns: [/^[0-9][A-Z0-9]{8,11}$/],
        description: 'VAG pattern (digit + 8-11 alphanumeric)'
    },
    'SEAT': {
        patterns: [/^[0-9][A-Z0-9]{8,11}$/],
        description: 'VAG pattern (digit + 8-11 alphanumeric)'
    },
    'PORSCHE': {
        patterns: [/^[0-9]{3}[A-Z0-9]{6,9}$/],
        description: '3 digits + 6-9 alphanumeric'
    },
    'TOYOTA': {
        patterns: [/^[0-9]{5}-[0-9]{5}$/, /^[0-9]{10}$/],
        description: 'XXXXX-XXXXX or 10 digits'
    },
    'HONDA': {
        patterns: [/^[0-9]{5}-[A-Z0-9]{3}-[0-9]{3}$/],
        description: 'XXXXX-XXX-XXX'
    },
    'NISSAN': {
        patterns: [/^[0-9]{5}-[0-9A-Z]{5}$/],
        description: 'XXXXX-XXXXX'
    },
    'FORD': {
        patterns: [/^[0-9A-Z]{7,15}$/],
        description: '7-15 alphanumeric'
    },
    'OPEL': {
        patterns: [/^[0-9]{8,10}$/],
        description: '8-10 digits'
    },
    'RENAULT': {
        patterns: [/^[0-9]{10,12}$/],
        description: '10-12 digits'
    },
    'PEUGEOT': {
        patterns: [/^[0-9]{10}$/],
        description: '10 digits'
    },
    'CITROEN': {
        patterns: [/^[0-9]{10}$/],
        description: '10 digits'
    }
};
/**
 * Layer 2: Brand Pattern Validation (Strict)
 */
function validateLayer2_BrandPattern(oem, brand) {
    const normalizedOEM = oem.replace(/[\s\-\.]/g, '').toUpperCase();
    const normalizedBrand = brand.toUpperCase().replace(/[\s\-]/g, '');
    let brandConfig = BRAND_PATTERNS[normalizedBrand];
    if (!brandConfig) {
        for (const [key, config] of Object.entries(BRAND_PATTERNS)) {
            if (normalizedBrand.includes(key) || key.includes(normalizedBrand)) {
                brandConfig = config;
                break;
            }
        }
    }
    if (!brandConfig) {
        return {
            name: 'Layer 2: Pattern Check',
            passed: false,
            confidence: 0,
            details: `Keine Pattern-Regeln für ${brand}`
        };
    }
    for (const pattern of brandConfig.patterns) {
        if (pattern.test(normalizedOEM)) {
            return {
                name: 'Layer 2: Pattern Check',
                passed: true,
                confidence: 0.20,
                details: `OEM folgt exakt dem ${brand} Standard (${brandConfig.description})`
            };
        }
    }
    return {
        name: 'Layer 2: Pattern Check',
        passed: false,
        confidence: -0.50, // LETHAL PENALTY for pattern mismatch (Junk detection)
        details: `FEHLER: OEM passt NICHT zum ${brand} Format!`
    };
}
// ============================================================================
// LAYER 3: ENHANCED BACKSEARCH VALIDATION
// ============================================================================
/**
 * Layer 3: Deep Backsearch (Mandatory Context)
 */
function validateLayer3_Backsearch(backsearchResult) {
    const hits = backsearchResult.totalHits || 0;
    if (hits >= 2) {
        return {
            name: 'Layer 3: Deep Backsearch',
            passed: true,
            confidence: 0.35, // HIGH WEIGHT for external confirmation with vehicle context
            details: `${hits} externe Plattformen bestätigen OEM + Fahrzeug-Kompatibilität`
        };
    }
    else if (hits === 1) {
        return {
            name: 'Layer 3: Deep Backsearch',
            passed: true,
            confidence: 0.20, // Reduced but significant confidence for single hit
            details: `1 externe Plattform bestätigt OEM + Fahrzeug-Kompatibilität`
        };
    }
    return {
        name: 'Layer 3: Deep Backsearch',
        passed: false,
        confidence: -0.40, // HEAVY PENALTY for 0 hits
        details: `KEINE externe Bestätigung mit Fahrzeug-Kontext gefunden!`
    };
}
// ============================================================================
// LAYER 4: AI TRIPLE-LOCK VERIFICATION (Mandatory & Strict)
// ============================================================================
/**
 * Layer 4: AI Triple-Lock Verification (Mandatory & Strict)
 */
async function validateLayer5_AIVerification(oem, brand, model, partDescription, openaiApiKey) {
    if (!openaiApiKey)
        return { name: 'Layer 4: AI Triple-Lock', passed: false, confidence: 0, details: 'AI-Check deaktiviert' };
    try {
        const prompt = `HANDEL ALS STRENGER AUTOMOBIL-PRÜFER. 
Ist OEM "${oem}" ZWEIFELSFREI (100%) richtig für ${brand} ${model} (${partDescription})?

Wenn du dir nicht 100% sicher bist (z.B. wegen Facelift, Motorcodes, PR-Nummern), antworte mit plausible: false.

JSON:
{
  "plausible": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "Warum (nicht)? Erwähne Risiken wie Fahrgestellnummer-Einschränkungen."
}`;
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0, // Strict, no creativity
                max_tokens: 200
            })
        });
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }
        const data = await response.json();
        let content = data.choices[0]?.message?.content || '{}';
        // Sanitize: Remove markdown code blocks if present
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(content);
        if (result.plausible && result.confidence >= 0.95) {
            return {
                name: 'Layer 4: AI Triple-Lock',
                passed: true,
                confidence: 0.20,
                details: `Experten-AI bestätigt: ${result.reasoning}`
            };
        }
        else {
            return {
                name: 'Layer 4: AI Triple-Lock',
                passed: false,
                confidence: -0.60, // LETHAL PENALTY if AI has doubts
                details: `WARNUNG: AI sieht Risiko! ${result.reasoning}`
            };
        }
    }
    catch (e) {
        logger_1.logger.warn('[AI Verification] Error:', e.message);
        return { name: 'Layer 4: AI Triple-Lock', passed: false, confidence: 0, details: `Check fehlgeschlagen: ${e.message}` };
    }
}
// ============================================================================
// MASTER VALIDATION FUNCTION
// ============================================================================
/**
 * Master Validation for BOMBPROOF mode
 */
async function performEnhancedValidation(primaryOEM, candidates, brand, model, partDescription, backsearchResult, options = {}) {
    const layers = [];
    let totalConfidence = 0.20; // Base baseline 20%
    // 1. Consensus
    const l1 = validateLayer1_Consensus(candidates, primaryOEM);
    layers.push(l1);
    totalConfidence += l1.confidence;
    // 2. Pattern
    const l2 = validateLayer2_BrandPattern(primaryOEM, brand);
    layers.push(l2);
    totalConfidence += l2.confidence;
    // 3. Deep Backsearch is now MANDATORY for high confidence
    const l3 = validateLayer3_Backsearch(backsearchResult);
    layers.push(l3);
    totalConfidence += l3.confidence;
    // 4. AI Triple-Lock (Mandatory if key present)
    if (options.openaiApiKey) {
        const l4 = await validateLayer5_AIVerification(primaryOEM, brand, model, partDescription, options.openaiApiKey);
        layers.push(l4);
        totalConfidence += l4.confidence;
    }
    totalConfidence = Math.max(0, Math.min(1, totalConfidence));
    // BOMBPROOF Threshold: 97%
    const minThreshold = options.minConfidence || 0.97;
    const validated = totalConfidence >= minThreshold;
    const reasoning = `${layers.filter(l => l.passed).length}/${layers.length} Layer bestanden. ` +
        layers.map(l => `${l.name}: ${l.passed ? '✓' : '✗'}`).join(', ');
    logger_1.logger.info('[Bombproof Validation]', {
        oem: primaryOEM,
        confidence: totalConfidence,
        validated,
        threshold: minThreshold
    });
    return {
        finalConfidence: totalConfidence,
        validated,
        layers,
        primaryOEM,
        reasoning
    };
}
// ============================================================================
// EXPORT
// ============================================================================
exports.default = {
    performEnhancedValidation,
    validateLayer1_Consensus,
    validateLayer2_BrandPattern,
    validateLayer3_Backsearch,
    validateLayer5_AIVerification
};
