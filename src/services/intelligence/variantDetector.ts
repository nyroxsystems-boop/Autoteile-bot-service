/**
 * 🔀 VARIANT DETECTION ENGINE
 * 
 * Detects when multiple OEM variants exist for the same vehicle+part
 * and generates a structured question for the customer.
 * 
 * Example: Golf 7 GTI Bremsscheibe vorne →
 *   1️⃣ 312mm Standard (OEM: 5Q0615301F)
 *   2️⃣ 340mm belüftet Sport (OEM: 5Q0615301G)
 *   3️⃣ 345mm R/Cupra (OEM: 5Q0615301K)
 * 
 * The system ASKS instead of GUESSING.
 */

import { OEMCandidate, OEMResolverRequest } from './types';
import { logger } from '@utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface VariantOption {
    oem: string;
    description: string;      // "Bremsscheibe vorne 340mm gelocht Performance"
    differentiator: string;   // "340mm gelocht" — the key distinguishing feature
    confidence: number;
    sources: string[];
}

export interface VariantDetectionResult {
    hasVariants: boolean;
    variants: VariantOption[];
    question?: string;        // WhatsApp-ready question text
    primaryOem?: string;      // If exactly 1 match → direct answer
    category?: string;        // brake, suspension, exhaust, etc.
}

// ============================================================================
// Categories Known to Have Variants
// ============================================================================

interface VariantCategory {
    /** Regex patterns to match this category in part descriptions */
    patterns: RegExp[];
    /** Key dimension that differs between variants (e.g., diameter for brakes) */
    differentiatorExtractor: (desc: string) => string | null;
    /** Hint text for the customer */
    hint: string;
}

const VARIANT_CATEGORIES: Record<string, VariantCategory> = {
    brake_disc: {
        patterns: [
            /bremsscheibe|brake.*disc/i,
        ],
        differentiatorExtractor: (desc: string) => {
            // Extract diameter: "340mm", "312x25mm", "345x30mm"
            const diamMatch = desc.match(/(\d{3})(?:\s*[x×]\s*\d+)?\s*mm/i);
            if (diamMatch) return `${diamMatch[1]}mm`;
            // Extract type keywords
            if (/keramik|ceramic/i.test(desc)) return 'Keramik';
            if (/carbon/i.test(desc)) return 'Carbon';
            if (/gelocht|drilled/i.test(desc)) return 'gelocht';
            if (/geschlitzt|slotted/i.test(desc)) return 'geschlitzt';
            if (/sport|performance/i.test(desc)) return 'Sport';
            if (/standard|basis/i.test(desc)) return 'Standard';
            return null;
        },
        hint: '💡 Tipp: Schauen Sie auf die Innenseite der Scheibe — dort steht die Größe (z.B. 312mm, 340mm). Oder messen Sie den Durchmesser.',
    },
    brake_pad: {
        patterns: [
            /bremsbelag|bremsbeläge|brake.*pad/i,
        ],
        differentiatorExtractor: (desc: string) => {
            if (/keramik|ceramic/i.test(desc)) return 'Keramik';
            if (/sport|performance/i.test(desc)) return 'Sport';
            if (/standard|basis/i.test(desc)) return 'Standard';
            if (/verstärkt|heavy.*duty/i.test(desc)) return 'verstärkt';
            // Try to match to brake disc size
            const diamMatch = desc.match(/(\d{3})\s*mm/i);
            if (diamMatch) return `für ${diamMatch[1]}mm Scheibe`;
            return null;
        },
        hint: '💡 Tipp: Die Beläge müssen zur Bremsscheibe passen. Welche Scheibengröße haben Sie?',
    },
    brake_caliper: {
        patterns: [
            /bremssattel|brake.*caliper/i,
        ],
        differentiatorExtractor: (desc: string) => {
            const posMatch = desc.match(/(vorne|hinten|links|rechts|front|rear|left|right)/gi);
            if (posMatch) return posMatch.join(' ');
            return null;
        },
        hint: '💡 Bitte die genaue Position angeben: vorne links/rechts oder hinten links/rechts.',
    },
    suspension: {
        patterns: [
            /stoßdämpfer|federbein|shock|strut|fahrwerk/i,
        ],
        differentiatorExtractor: (desc: string) => {
            if (/adaptiv|dcc|edc|cdc/i.test(desc)) return 'Adaptiv (DCC/EDC)';
            if (/sport/i.test(desc)) return 'Sport';
            if (/standard|komfort|comfort/i.test(desc)) return 'Standard';
            if (/luft|air/i.test(desc)) return 'Luftfederung';
            if (/tiefergelegt|lowered/i.test(desc)) return 'Tiefergelegt';
            return null;
        },
        hint: '💡 Haben Sie ein sportliches oder Standard-Fahrwerk? Adaptivfahrwerk (DCC)?',
    },
    control_arm: {
        patterns: [
            /querlenker|control.*arm|wishbone|traggelenk/i,
        ],
        differentiatorExtractor: (desc: string) => {
            const parts: string[] = [];
            if (/vorne|front/i.test(desc)) parts.push('vorne');
            if (/hinten|rear/i.test(desc)) parts.push('hinten');
            if (/links|left/i.test(desc)) parts.push('links');
            if (/rechts|right/i.test(desc)) parts.push('rechts');
            if (/oben|upper/i.test(desc)) parts.push('oben');
            if (/unten|lower/i.test(desc)) parts.push('unten');
            return parts.length > 0 ? parts.join(' ') : null;
        },
        hint: '💡 Welche Seite? Vorne links/rechts? Oberer/unterer Querlenker?',
    },
    exhaust: {
        patterns: [
            /auspuff|exhaust|katalysator|kat|dpf|partikelfilter|opf/i,
        ],
        differentiatorExtractor: (desc: string) => {
            if (/sport/i.test(desc)) return 'Sport';
            if (/standard|serie/i.test(desc)) return 'Standard';
            if (/dpf|partikelfilter/i.test(desc)) return 'mit DPF';
            if (/opf|ottopartikelfilter/i.test(desc)) return 'mit OPF';
            return null;
        },
        hint: '💡 Standard- oder Sportauspuff? Diesel mit DPF oder Benzin mit OPF?',
    },
    water_pump: {
        patterns: [
            /wasserpumpe|water.*pump|kühlmittelpumpe/i,
        ],
        differentiatorExtractor: (desc: string) => {
            if (/elektrisch|electric/i.test(desc)) return 'elektrisch';
            if (/mechanisch|mechanical/i.test(desc)) return 'mechanisch';
            if (/zahnriemen|belt/i.test(desc)) return 'mit Zahnriemen';
            if (/kette|chain/i.test(desc)) return 'mit Kette';
            return null;
        },
        hint: '💡 Welchen Motor haben Sie? (z.B. 1.4 TSI, 2.0 TDI) — davon hängt die Pumpe ab.',
    },
};

// ============================================================================
// Main Detection
// ============================================================================

/**
 * Detect if there are multiple OEM variants for the same vehicle+part.
 * Returns structured variant options with a question for the customer.
 */
export function detectVariants(
    candidates: OEMCandidate[],
    req: OEMResolverRequest
): VariantDetectionResult {
    const partText = req.partQuery.rawText;

    // Find which variant category this part belongs to
    const matchedCategory = findVariantCategory(partText);

    // If not a known variant category, return single result
    if (!matchedCategory) {
        return {
            hasVariants: false,
            variants: [],
            primaryOem: candidates[0]?.oem,
        };
    }

    const { key, category } = matchedCategory;

    // Group candidates by their differentiator
    const variantMap = new Map<string, VariantOption>();

    for (const candidate of candidates) {
        // BUG 2 FIX: Search ALL meta fields for differentiator info, not just description
        const allText = [
            candidate.meta?.description,
            candidate.meta?.partDescription,
            candidate.meta?.note,
            candidate.meta?.context,
            candidate.meta?.reason,
            candidate.meta?.reasoning,
        ].filter(Boolean).join(' ');

        let differentiator = category.differentiatorExtractor(allText) || null;

        // BUG 2 FIX: If no differentiator from text, try to extract from OEM number itself
        // VAG OEMs encode variant info in suffix: 5Q0615301F vs 5Q0615301G vs 5Q0615301K
        if (!differentiator && candidate.oem.length >= 8) {
            const suffix = candidate.oem.slice(-1);
            // Only use OEM suffix as differentiator if we have multiple different OEMs
            // with the same prefix (same part number, different variant)
            differentiator = `Variante ${suffix}`;
        }

        if (!differentiator) differentiator = 'Unbekannt';

        const existingKey = `${candidate.oem}`;

        if (!variantMap.has(existingKey)) {
            variantMap.set(existingKey, {
                oem: candidate.oem,
                description: allText || `${partText}`,
                differentiator,
                confidence: candidate.confidence,
                sources: [candidate.source],
            });
        } else {
            const existing = variantMap.get(existingKey)!;
            existing.confidence = Math.max(existing.confidence, candidate.confidence);
            existing.sources.push(candidate.source);
            // Update differentiator if the new one is more specific than "Variante X"
            if (existing.differentiator.startsWith('Variante ') && !differentiator.startsWith('Variante ')) {
                existing.differentiator = differentiator;
                existing.description = allText || existing.description;
            }
        }
    }

    const variants = Array.from(variantMap.values())
        .filter(v => v.confidence >= 0.50) // Only show reasonably confident variants
        .sort((a, b) => b.confidence - a.confidence);

    // Check if variants actually differ (different differentiators)
    const uniqueDifferentiators = new Set(variants.map(v => v.differentiator));

    // If all variants have the same differentiator or there's only 1 → no real variant choice
    if (uniqueDifferentiators.size <= 1 || variants.length <= 1) {
        return {
            hasVariants: false,
            variants: [],
            primaryOem: variants[0]?.oem || candidates[0]?.oem,
        };
    }

    // Multiple variants exist → build question
    const question = buildVariantQuestion(variants, partText, req, category);

    logger.info('[VariantDetector] 🔀 Multiple variants detected', {
        part: partText,
        variantCount: variants.length,
        differentiators: [...uniqueDifferentiators],
        category: key,
    });

    return {
        hasVariants: true,
        variants,
        question,
        category: key,
    };
}

// ============================================================================
// Helpers
// ============================================================================

function findVariantCategory(partText: string): { key: string; category: VariantCategory } | null {
    const normalized = partText.toLowerCase();

    for (const [key, category] of Object.entries(VARIANT_CATEGORIES)) {
        if (category.patterns.some(p => p.test(normalized))) {
            return { key, category };
        }
    }
    return null;
}

function buildVariantQuestion(
    variants: VariantOption[],
    partText: string,
    req: OEMResolverRequest,
    category: VariantCategory
): string {
    const vehicle = `${req.vehicle.make || ''} ${req.vehicle.model || ''}`.trim();
    const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

    let question = `🔀 Für den *${vehicle}* gibt es verschiedene Varianten für *${partText}*:\n\n`;

    variants.slice(0, 6).forEach((v, i) => {
        const oemDisplay = v.oem.length > 5 ? v.oem : '';
        const diffDisplay = v.differentiator !== 'Unbekannt' ? ` — ${v.differentiator}` : '';
        const descShort = v.description.length > 60 ? v.description.substring(0, 60) + '…' : v.description;

        question += `${emoji[i] || `${i + 1}.`} *${v.differentiator}*`;
        if (oemDisplay) question += ` (${oemDisplay})`;
        if (descShort && descShort !== v.differentiator) question += `\n   ${descShort}`;
        question += '\n\n';
    });

    question += category.hint;
    question += '\n\n_Bitte antworten Sie mit der Nummer (1, 2, 3...) oder beschreiben Sie Ihre Variante._';

    return question;
}

export default { detectVariants };
