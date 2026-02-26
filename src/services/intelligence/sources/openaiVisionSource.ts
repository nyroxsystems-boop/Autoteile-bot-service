/**
 * 🔬 DOCUMENT & IMAGE OCR SOURCE
 * 
 * Extracts vehicle data and OEM numbers from images sent via WhatsApp:
 * 
 * Mode 1: FAHRZEUGSCHEIN (German Vehicle Registration)
 *   → Extracts: VIN, HSN/TSN, Make, Model, Year, Engine, Power
 *   → German registration fields: 2.1, 2.2, D.2, E, P.1, P.2
 * 
 * Mode 2: PART LABEL (OEM sticker on physical part)
 *   → Extracts: OEM number directly from photo
 * 
 * Mode 3: CATALOG PAGE (Screenshot from online catalog)
 *   → Extracts: Multiple OEM numbers from screenshot
 * 
 * Uses: Gemini Vision API via geminiService.generateVisionCompletion()
 */
import { OEMSource, OEMCandidate } from "./baseSource";
import { normalizeOem } from "../oemScraper";
import { logger } from "@utils/logger";
import { generateVisionCompletion, generateChatCompletion } from "../geminiService";

// ============================================================================
// Types
// ============================================================================

export interface FahrzeugscheinData {
    vin?: string;           // Feld E
    hsnTsn?: string;        // Feld 2.1 + 2.2 / D.2
    make?: string;          // Feld 2.1 (Hersteller)
    model?: string;         // Feld 2.2 (Typ/Variante)
    year?: number;          // Feld B (Datum der Erstzulassung)
    engineCC?: number;      // Feld P.1 (Hubraum in ccm)
    powerKW?: number;       // Feld P.2 (Leistung in kW)
    fuelType?: string;      // Feld P.3 (Kraftstoffart)
    totalWeight?: number;   // Feld F.1 (zul. Gesamtmasse)
    plateNumber?: string;   // Kennzeichen
    confidence: number;     // 0-1 extraction confidence
}

export interface PartLabelData {
    oems: string[];
    brand?: string;
    description?: string;
    confidence: number;
}

// ============================================================================
// Fahrzeugschein-OCR (German Vehicle Registration Document)
// ============================================================================

const FAHRZEUGSCHEIN_PROMPT = `Du analysierst ein Foto eines deutschen Fahrzeugscheins (Zulassungsbescheinigung Teil I).

Extrahiere ALLE folgenden Felder. Die Felder sind auf dem Dokument mit Nummern/Buchstaben gekennzeichnet:

- Feld E: Fahrzeug-Identifizierungsnummer (VIN), 17 Zeichen
- Feld 2.1: Hersteller (z.B. VOLKSWAGEN AG, BMW AG, DAIMLER AG)
- Feld 2.2: Typ, Variante, Version (z.B. GOLF VII 1.4 TSI)
- Feld D.2: HSN/TSN (Schlüsselnummer, z.B. 0603/BNP)
- Feld B: Datum der Erstzulassung (TT.MM.JJJJ)
- Feld P.1: Hubraum in ccm (z.B. 1395)
- Feld P.2: Nennleistung in kW (z.B. 110)
- Feld P.3: Kraftstoffart (z.B. Benzin, Diesel)
- Feld F.1: Zulässige Gesamtmasse in kg
- Kennzeichen (z.B. B-AB 1234)

Antworte NUR mit validem JSON:
{
    "vin": "WVWZZZXXXXXXX",
    "hsn_tsn": "0603/BNP",
    "make": "VOLKSWAGEN",
    "model": "GOLF VII 1.4 TSI",
    "first_registration": "15.03.2019",
    "engine_cc": 1395,
    "power_kw": 110,
    "fuel_type": "Benzin",
    "total_weight_kg": 1830,
    "plate_number": "B-AB 1234",
    "confidence": 0.95
}

Wenn ein Feld nicht lesbar ist, setze es auf null.
Wenn das Bild KEIN Fahrzeugschein ist, antworte: {"error": "not_fahrzeugschein"}`;

// ============================================================================
// Part Label OCR
// ============================================================================

const PART_LABEL_PROMPT = `Du analysierst ein Foto eines Autoteils oder Etiketts.

Extrahiere ALLE sichtbaren OEM-Nummern (Original-Teilenummern des Herstellers).

OEM-Nummern typischerweise:
- 5-18 Zeichen lang
- Enthalten Buchstaben UND Ziffern
- Können Bindestriche oder Punkte enthalten
- BMW: 34 11 6 860 264 (11 Ziffern, Gruppen von 2-3-1-3-3)
- VW/Audi: 1K0 615 301 AA (3-3-3-2 Format)
- Mercedes: A 205 421 10 12 (Buchstabe + 10 Ziffern)

Antworte NUR mit validem JSON:
{
    "oems": ["1K0615301AA", "5Q0615301B"],
    "brand": "VOLKSWAGEN",
    "description": "Bremsscheibe vorne",
    "confidence": 0.90
}

Wenn keine OEM-Nummern erkennbar: {"oems": [], "confidence": 0}`;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Extract vehicle data from a Fahrzeugschein image.
 */
export async function extractFahrzeugschein(imageBase64: string, mimeType = 'image/jpeg'): Promise<FahrzeugscheinData | null> {
    try {
        const response = await generateVisionCompletion({
            prompt: FAHRZEUGSCHEIN_PROMPT,
            imageBase64,
            mimeType,
            temperature: 0,
        });

        if (!response) return null;

        const parsed = JSON.parse(response);
        if (parsed.error) {
            logger.info('[Document OCR] Image is not a Fahrzeugschein', { error: parsed.error });
            return null;
        }

        const result: FahrzeugscheinData = {
            vin: parsed.vin || undefined,
            hsnTsn: parsed.hsn_tsn || undefined,
            make: parsed.make || undefined,
            model: parsed.model || undefined,
            year: parsed.first_registration ? parseInt(parsed.first_registration.split('.').pop() || '', 10) || undefined : undefined,
            engineCC: parsed.engine_cc || undefined,
            powerKW: parsed.power_kw || undefined,
            fuelType: parsed.fuel_type || undefined,
            totalWeight: parsed.total_weight_kg || undefined,
            plateNumber: parsed.plate_number || undefined,
            confidence: parsed.confidence || 0.50,
        };

        logger.info('[Document OCR] 📋 Fahrzeugschein extracted', {
            vin: result.vin ? `${result.vin.substring(0, 5)}...` : 'n/a',
            make: result.make,
            model: result.model,
            year: result.year,
            hsnTsn: result.hsnTsn,
            confidence: result.confidence,
        });

        return result;

    } catch (error: any) {
        logger.error('[Document OCR] Fahrzeugschein extraction failed', { error: error.message });
        return null;
    }
}

/**
 * Extract OEM numbers from a part label image.
 */
export async function extractPartLabel(imageBase64: string, mimeType = 'image/jpeg'): Promise<PartLabelData | null> {
    try {
        const response = await generateVisionCompletion({
            prompt: PART_LABEL_PROMPT,
            imageBase64,
            mimeType,
            temperature: 0,
        });

        if (!response) return null;

        const parsed = JSON.parse(response);
        if (!parsed.oems || !Array.isArray(parsed.oems)) return null;

        const normalizedOems = parsed.oems
            .map((oem: string) => normalizeOem(String(oem)))
            .filter((oem: string | null): oem is string => oem !== null);

        const result: PartLabelData = {
            oems: normalizedOems,
            brand: parsed.brand || undefined,
            description: parsed.description || undefined,
            confidence: parsed.confidence || 0.50,
        };

        logger.info('[Document OCR] 🏷️ Part label extracted', {
            oemCount: result.oems.length,
            oems: result.oems.slice(0, 3),
            brand: result.brand,
            confidence: result.confidence,
        });

        return result;

    } catch (error: any) {
        logger.error('[Document OCR] Part label extraction failed', { error: error.message });
        return null;
    }
}

// ============================================================================
// OEM Source Interface
// ============================================================================

export const openaiVisionSource: OEMSource = {
    name: "Document-OCR",

    async resolveCandidates(req: any): Promise<OEMCandidate[]> {
        // Only run if the request has image data attached
        const imageData = req.imageData?.base64 || req.imageBase64;
        if (!imageData) {
            // No image data — this source only works with images
            return [];
        }

        const mimeType = req.imageData?.mimeType || 'image/jpeg';
        const candidates: OEMCandidate[] = [];

        // Strategy: Try part label extraction first (direct OEM extraction)
        const partLabel = await extractPartLabel(imageData, mimeType);
        if (partLabel && partLabel.oems.length > 0) {
            for (const oem of partLabel.oems) {
                candidates.push({
                    oem,
                    source: 'Document-OCR',
                    confidence: Math.min(partLabel.confidence, 0.80), // Cap OCR confidence
                    meta: {
                        priority: 7, // High — direct visual extraction
                        note: `Part label OCR: ${partLabel.description || 'unknown'}`,
                        extractionMethod: 'part_label',
                        ocrBrand: partLabel.brand,
                    },
                });
            }
            return candidates;
        }

        // If no OEMs found on label, try Fahrzeugschein extraction
        // (This enriches the vehicle data rather than finding OEMs directly)
        const fahrzeugschein = await extractFahrzeugschein(imageData, mimeType);
        if (fahrzeugschein) {
            // Enrich the request with Fahrzeugschein data for other sources to use
            if (fahrzeugschein.vin && !req.vehicle?.vin) {
                req.vehicle = { ...req.vehicle, vin: fahrzeugschein.vin };
            }
            if (fahrzeugschein.make && !req.vehicle?.make) {
                req.vehicle = { ...req.vehicle, make: fahrzeugschein.make };
            }
            if (fahrzeugschein.model && !req.vehicle?.model) {
                req.vehicle = { ...req.vehicle, model: fahrzeugschein.model };
            }
            if (fahrzeugschein.year && !req.vehicle?.year) {
                req.vehicle = { ...req.vehicle, year: fahrzeugschein.year };
            }
            if (fahrzeugschein.powerKW && !req.vehicle?.kw) {
                req.vehicle = { ...req.vehicle, kw: fahrzeugschein.powerKW };
            }

            logger.info('[Document OCR] 📋 Fahrzeugschein data enriched request', {
                enrichedFields: Object.keys(fahrzeugschein).filter(k => (fahrzeugschein as any)[k] !== undefined),
            });

            // No direct OEM candidates from Fahrzeugschein, but request is now enriched
            // Other sources (databaseSource, vagEtkaSource, etc.) will benefit
        }

        return candidates;
    }
};
