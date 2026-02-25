/**
 * COLLECT VEHICLE STATE HANDLER
 * 
 * Handles text-based vehicle data collection.
 * OCR processing remains in botLogicService.ts until fully migrated.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import {
    updateOrderData,
    getVehicleForOrder,
    upsertVehicleForOrderFromPartial
} from '../../../adapters/supabaseService';
import { logger } from '../../../../utils/logger';

// ============================================================================
// Vehicle Field Detection
// ============================================================================

export function determineMissingVehicleFields(vehicle: any): string[] {
    if (!vehicle) return ['make', 'model', 'year'];

    const missing: string[] = [];

    // VIN or HSN/TSN required for precise OEM lookup
    const hasVin = !!vehicle.vin && vehicle.vin.length >= 10;
    const hasHsnTsn = !!vehicle.hsn && !!vehicle.tsn;

    if (!hasVin && !hasHsnTsn) {
        // Need at least make + model + year
        if (!vehicle.make) missing.push('make');
        if (!vehicle.model) missing.push('model');
        if (!vehicle.year) missing.push('year');
    }

    return missing;
}

// ============================================================================
// Prompts
// ============================================================================

const PROMPTS: Record<string, { askMake: string; askModel: string; askVin: string; complete: string }> = {
    de: {
        askMake: "Welche Automarke ist es?",
        askModel: "Welches Modell genau?",
        askVin: "Bitte nenne mir VIN oder HSN/TSN oder mindestens Marke/Modell/Baujahr.",
        complete: "Fahrzeugdaten gespeichert. Welches Teil brauchst du? Bitte Position (vorne/hinten, links/rechts) und Symptome nennen."
    },
    en: {
        askMake: "Which car brand is it?",
        askModel: "Which exact model is it?",
        askVin: "Please share VIN or HSN/TSN, or at least make/model/year.",
        complete: "Vehicle data saved. Which part do you need? Please include position (front/rear, left/right) and any symptoms."
    },
    tr: {
        askMake: "Araç markası nedir?",
        askModel: "Tam model nedir?",
        askVin: "Lütfen VIN, HSN/TSN veya en azından marka/model/yıl bilgisini gönderin.",
        complete: "Araç bilgileri kaydedildi. Hangi parçaya ihtiyacınız var? Lütfen konumu (ön/arka, sol/sağ) belirtin."
    },
    ku: {
        askMake: "Marka wesayîtê çi ye?",
        askModel: "Modela tam çi ye?",
        askVin: "Ji kerema xwe VIN, HSN/TSN an jî herî kêm marka/model/sal bişînin.",
        complete: "Daneyên wesayîtê hatine tomarkirin. Kîjan parçe hewce ye? Ji kerema xwe cih (pêş/paş, çep/rast) binivisin."
    },
    pl: {
        askMake: "Jaka marka samochodu?",
        askModel: "Jaki dokładnie model?",
        askVin: "Proszę podać VIN, HSN/TSN lub przynajmniej markę/model/rok.",
        complete: "Dane pojazdu zapisane. Jakiej części potrzebujesz? Podaj pozycję (przód/tył, lewo/prawo) i objawy."
    }
};

// ============================================================================
// Handler
// ============================================================================

export const collectVehicleHandler = createHandler(
    'CollectVehicleHandler',
    ['collect_vehicle'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order, orderData, language, parsed } = ctx;
        const lang = (['de', 'en', 'tr', 'ku', 'pl'].includes(language) ? language : 'de') as keyof typeof PROMPTS;

        // If image present, delegate to legacy handler (OCR complex)
        if (ctx.mediaUrls && ctx.mediaUrls.length > 0) {
            logger.info('CollectVehicle: has media, delegating to legacy OCR', { orderId: order.id });
            return {
                reply: '',  // Empty signals to botLogicService to use legacy
                nextStatus: 'collect_vehicle',
                shouldPersistStatus: false,
                updatedOrderData: { _useLegacyHandler: true }
            };
        }

        // Extract vehicle data from parsed message
        const vehicleUpdate: Record<string, any> = {};
        if (parsed.make) vehicleUpdate.make = parsed.make;
        if (parsed.model) vehicleUpdate.model = parsed.model;
        if (parsed.year) vehicleUpdate.year = parsed.year;
        if (parsed.vin) vehicleUpdate.vin = parsed.vin;
        if (parsed.hsn) vehicleUpdate.hsn = parsed.hsn;
        if (parsed.tsn) vehicleUpdate.tsn = parsed.tsn;
        if (parsed.engine) vehicleUpdate.engineCode = parsed.engine;

        // Only upsert if we have new data
        if (Object.keys(vehicleUpdate).length > 0) {
            try {
                await upsertVehicleForOrderFromPartial(order.id, vehicleUpdate);
                logger.info('Vehicle data upserted', { orderId: order.id, fields: Object.keys(vehicleUpdate) });
            } catch (err: any) {
                logger.error('Failed to upsert vehicle', { error: err?.message, orderId: order.id });
            }
        }

        // Check completeness
        const vehicle = await getVehicleForOrder(order.id);
        const missing = determineMissingVehicleFields(vehicle);

        if (missing.length === 0) {
            // Vehicle complete, move to part collection
            // Check if part already known
            const partText = orderData?.requestedPart || parsed.part;

            if (partText) {
                // Have vehicle AND part → signal for OEM lookup
                logger.info('CollectVehicle: complete with part, ready for OEM', { orderId: order.id });
                return {
                    reply: '',  // Signal for OEM flow in legacy
                    nextStatus: 'oem_lookup',
                    shouldPersistStatus: true,
                    updatedOrderData: { _vehicleComplete: true, _partKnown: true }
                };
            }

            return {
                reply: PROMPTS[lang].complete,
                nextStatus: 'collect_part',
                shouldPersistStatus: true
            };
        }

        // Ask for first missing field
        const field = missing[0];
        let reply: string;

        if (field === 'make') {
            reply = PROMPTS[lang].askMake;
        } else if (field === 'model') {
            reply = PROMPTS[lang].askModel;
        } else {
            reply = PROMPTS[lang].askVin;
        }

        return {
            reply,
            nextStatus: 'collect_vehicle',
            shouldPersistStatus: false
        };
    }
);
