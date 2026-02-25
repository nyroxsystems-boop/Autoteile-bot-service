/**
 * COLLECT PART STATE HANDLER
 * 
 * Handles part description collection from the user.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { updateOrderData } from '../../../adapters/supabaseService';
import { logger } from '../../../../utils/logger';

// ============================================================================
// Part Field Detection  
// ============================================================================

const PART_REQUIRED_POSITIONS = ['brake_caliper', 'brake_disc', 'brake_pad', 'shock_absorber'];

export function determineMissingPartFields(parsed: any, orderData: any): string[] {
    const missing: string[] = [];
    const partCategory = parsed.partCategory || orderData?.partCategory;

    // Position required for brake/suspension parts
    if (PART_REQUIRED_POSITIONS.includes(partCategory)) {
        const pos = parsed.position || orderData?.position;
        if (!pos) missing.push('position');
    }

    // Disc diameter required for brake discs
    if (partCategory === 'brake_disc') {
        const diameter = parsed.discDiameter || orderData?.discDiameter;
        if (!diameter) missing.push('disc_diameter');
    }

    return missing;
}

// ============================================================================
// Prompts
// ============================================================================

const PROMPTS: Record<string, { askPart: string; askPosition: string; askDiameter: string; processing: string }> = {
    de: {
        askPart: "Welches Ersatzteil brauchst du? Beschreibe auch Symptome falls vorhanden.",
        askPosition: "Ist das Teil vorne oder hinten? Links oder rechts?",
        askDiameter: "Welchen Durchmesser haben deine aktuellen Bremsscheiben (in mm)?",
        processing: "Perfekt, ich habe alle Infos. Suche jetzt die OEM-Nummer..."
    },
    en: {
        askPart: "Which replacement part do you need? Describe symptoms if any.",
        askPosition: "Is the part front or rear? Left or right?",
        askDiameter: "What diameter are your current brake discs (in mm)?",
        processing: "Perfect, I have all the info. Looking up the OEM number now..."
    },
    tr: {
        askPart: "Hangi yedek parçaya ihtiyacınız var? Belirtileri de açıklayın.",
        askPosition: "Parça ön mü arka mı? Sol mu sağ mı?",
        askDiameter: "Mevcut fren disklerinizin çapı kaç mm?",
        processing: "Mükemmel, tüm bilgilere sahibim. OEM numarasını arıyorum..."
    },
    ku: {
        askPart: "Kîjan parçeya yedek hewce ye? Nîşanên wê jî binivîsin.",
        askPosition: "Parçe pêş e an paş? Çep an rast?",
        askDiameter: "Diametera dîskên frena we çend mm e?",
        processing: "Temam, hemû agahî hene. Niha jimareya OEM-ê lê digerim..."
    },
    pl: {
        askPart: "Jakiej części zamiennej potrzebujesz? Opisz objawy jeśli są.",
        askPosition: "Część jest z przodu czy z tyłu? Lewa czy prawa?",
        askDiameter: "Jaka jest średnica obecnych tarcz hamulcowych (w mm)?",
        processing: "Świetnie, mam wszystkie informacje. Szukam numeru OEM..."
    }
};

// ============================================================================
// Handler
// ============================================================================

export const collectPartHandler = createHandler(
    'CollectPartHandler',
    ['collect_part'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order, orderData, language, parsed } = ctx;
        const lang = (['de', 'en', 'tr', 'ku', 'pl'].includes(language) ? language : 'de') as keyof typeof PROMPTS;

        // Merge part info from parsed message
        const partUpdate: Record<string, any> = {};
        if (parsed.part) partUpdate.requestedPart = parsed.part;
        if (parsed.normalizedPartName) partUpdate.partText = parsed.normalizedPartName;
        if (parsed.position) partUpdate.position = parsed.position;
        if (parsed.quantity) partUpdate.quantity = parsed.quantity;
        if (parsed.symptoms) partUpdate.symptoms = parsed.symptoms;
        if (parsed.partCategory) partUpdate.partCategory = parsed.partCategory;

        // Persist updates
        if (Object.keys(partUpdate).length > 0) {
            try {
                await updateOrderData(order.id, partUpdate);
                logger.info('Part data updated', { orderId: order.id, fields: Object.keys(partUpdate) });
            } catch (err: any) {
                logger.error('Failed to update part data', { error: err?.message, orderId: order.id });
            }
        }

        // Merge with existing orderData for completeness check
        const mergedData = { ...orderData, ...partUpdate };

        // Check if we have the part name
        const partText = mergedData.requestedPart || mergedData.partText || parsed.part;

        if (!partText) {
            return {
                reply: PROMPTS[lang].askPart,
                nextStatus: 'collect_part',
                shouldPersistStatus: false
            };
        }

        // Check for required fields based on part category
        const missing = determineMissingPartFields(parsed, mergedData);

        if (missing.includes('position')) {
            return {
                reply: PROMPTS[lang].askPosition,
                nextStatus: 'collect_part',
                shouldPersistStatus: false
            };
        }

        if (missing.includes('disc_diameter')) {
            return {
                reply: PROMPTS[lang].askDiameter,
                nextStatus: 'collect_part',
                shouldPersistStatus: false
            };
        }

        // All part info complete → OEM lookup
        logger.info('Part collection complete, transitioning to OEM lookup', {
            orderId: order.id,
            part: partText
        });

        return {
            reply: PROMPTS[lang].processing,
            nextStatus: 'oem_lookup',
            shouldPersistStatus: true,
            updatedOrderData: { _partComplete: true }
        };
    }
);
