/**
 * 📷 OCR Service
 * 
 * Handles vehicle document OCR extraction using OpenAI Vision.
 * Extracted from botLogicService.ts for modularity.
 */
import OpenAI from "openai";
import { logger } from "@utils/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface VehicleOcrResult {
    make: string | null;
    model: string | null;
    vin: string | null;
    hsn: string | null;
    tsn: string | null;
    year: number | null;
    engineKw: number | null;
    fuelType: string | null;
    emissionClass: string | null;
    rawText: string;
}

// ============================================================================
// OCR CLIENT
// ============================================================================

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ""
});

// ============================================================================
// OCR PROMPTS
// ============================================================================

const OCR_SYSTEM_PROMPT =
    "You are an expert OCR and data extractor for German vehicle registration documents " +
    "(Zulassungsbescheinigung Teil I, old Fahrzeugschein). " +
    "Be robust to rotated, blurred, dark, skewed, partially occluded images. " +
    "Always return strict JSON for the requested fields.";

const OCR_USER_PROMPT = `
Lies dieses Bild (deutscher Fahrzeugschein, Zulassungsbescheinigung Teil I oder altes Fahrzeugschein-Formular).
Berücksichtige:
- Bild kann gedreht (90/180°), perspektivisch verzerrt, unscharf, dunkel oder teilweise verdeckt sein.
- Erkenne Ausrichtung selbst, lies so viel Text wie möglich.
Felder, die du extrahieren sollst (wenn unsicher → null):
- make (Hersteller, Feld D.1 oder Klartext, z.B. "BMW" / "BAYER. MOT. WERKE")
- model (Typ/Handelsbezeichnung, Feld D.2/D.3, z.B. "316ti")
- vin (Fahrgestellnummer, Feld E)
- hsn (Herstellerschlüsselnummer, Feld "zu 2.1")
- tsn (Typschlüsselnummer, Feld "zu 2.2")
- year (Erstzulassung/Herstellungsjahr, Feld B, als Zahl, z.B. 2002)
- engineKw (Leistung in kW, Feld P.2)
- fuelType (Kraftstoff, Feld P.3, z.B. "Benzin", "Diesel")
- emissionClass (z.B. "EURO 4")
Gib als Ergebnis NUR folgendes JSON (ohne zusätzlichen Text) zurück:
{
  "make": "...",
  "model": "...",
  "vin": "...",
  "hsn": "...",
  "tsn": "...",
  "year": 2002,
  "engineKw": 85,
  "fuelType": "...",
  "emissionClass": "...",
  "rawText": "Vollständiger erkannter Text"
}
Fülle unbekannte Felder mit null. rawText soll den gesamten erkannten Text enthalten (oder "" falls nichts erkannt).
`;

// ============================================================================
// OCR EXTRACTION
// ============================================================================

/**
 * Extract vehicle data from a document image using OpenAI Vision
 */
export async function extractVehicleDataFromImage(imageBuffer: Buffer): Promise<VehicleOcrResult> {
    const base64 = imageBuffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    try {
        const resp = await client.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                { role: "system", content: OCR_SYSTEM_PROMPT },
                {
                    role: "user",
                    content: [
                        { type: "text", text: OCR_USER_PROMPT },
                        { type: "image_url", image_url: { url: imageUrl } }
                    ]
                }
            ],
            temperature: 0
        });

        const content = resp.choices[0]?.message?.content ?? "";
        return safeParseVehicleJson(content);
    } catch (err: any) {
        logger.error("[OCR] Vision extraction failed", { error: err?.message });
        return createEmptyResult();
    }
}

// ============================================================================
// JSON PARSING
// ============================================================================

/**
 * Parse OCR JSON response robustly
 */
export function safeParseVehicleJson(text: string): VehicleOcrResult {
    const empty = createEmptyResult();

    try {
        // Extract JSON from potential markdown code blocks
        let jsonStr = text;
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        }

        // Try to find JSON object in text
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return empty;

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            make: typeof parsed.make === "string" ? parsed.make : null,
            model: typeof parsed.model === "string" ? parsed.model : null,
            vin: typeof parsed.vin === "string" ? parsed.vin.toUpperCase() : null,
            hsn: typeof parsed.hsn === "string" ? parsed.hsn : null,
            tsn: typeof parsed.tsn === "string" ? parsed.tsn : null,
            year: typeof parsed.year === "number" ? parsed.year : null,
            engineKw: typeof parsed.engineKw === "number" ? parsed.engineKw : null,
            fuelType: typeof parsed.fuelType === "string" ? parsed.fuelType : null,
            emissionClass: typeof parsed.emissionClass === "string" ? parsed.emissionClass : null,
            rawText: typeof parsed.rawText === "string" ? parsed.rawText : ""
        };
    } catch {
        return empty;
    }
}

/**
 * Create empty OCR result
 */
function createEmptyResult(): VehicleOcrResult {
    return {
        make: null,
        model: null,
        vin: null,
        hsn: null,
        tsn: null,
        year: null,
        engineKw: null,
        fuelType: null,
        emissionClass: null,
        rawText: ""
    };
}

// ============================================================================
// VEHICLE VALIDATION
// ============================================================================

const REQUIRED_FIELDS = ["make", "model"];
const OPTIONAL_BUT_USEFUL = ["year", "vin", "hsn", "tsn"];

/**
 * Determine which vehicle fields are missing
 */
export function determineMissingVehicleFields(vehicle: Partial<VehicleOcrResult>): string[] {
    const missing: string[] = [];

    for (const field of REQUIRED_FIELDS) {
        if (!vehicle[field as keyof VehicleOcrResult]) {
            missing.push(field);
        }
    }

    // If no primary identifiers, suggest VIN or HSN/TSN
    if (!vehicle.vin && !vehicle.hsn && !vehicle.tsn) {
        if (!missing.includes("vin")) {
            missing.push("vin_or_hsn_tsn");
        }
    }

    return missing;
}

/**
 * Check if vehicle data is sufficient for OEM lookup
 */
export function isVehicleSufficientForOem(vehicle: Partial<VehicleOcrResult>): boolean {
    // Need at least make + model OR VIN OR HSN+TSN
    const hasMakeModel = Boolean(vehicle.make && vehicle.model);
    const hasVin = Boolean(vehicle.vin && vehicle.vin.length >= 11);
    const hasHsnTsn = Boolean(vehicle.hsn && vehicle.tsn);

    return hasMakeModel || hasVin || hasHsnTsn;
}
