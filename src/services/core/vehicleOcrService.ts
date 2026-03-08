/**
 * Vehicle OCR Service — Image processing for the WhatsApp Bot.
 *
 * Extracted from botLogicService.ts for clean separation of concerns.
 * Handles: image download (Twilio + generic), vehicle document OCR via Gemini Vision,
 * and JSON parsing of OCR results.
 */

import fetch from "node-fetch";
import * as fs from "fs/promises";
import { logger } from "@utils/logger";
import { generateVisionCompletion } from "../intelligence/geminiService";
import { fetchWithTimeoutAndRetry } from "../../utils/httpClient";

// ============================================================================
// Types
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

export interface VehicleInfoPatch {
    make?: string;
    model?: string;
    year?: number;
    vin?: string;
    hsn?: string;
    tsn?: string;
    engineKw?: number;
    fuelType?: string;
}

// ============================================================================
// Image Download
// ============================================================================

export async function downloadImageBuffer(url: string): Promise<Buffer> {
    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(`Failed to download image: ${resp.status} ${resp.statusText}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

export async function downloadFromTwilio(mediaUrl: string): Promise<Buffer> {
    // Allow local dev/test without Twilio by accepting data: and file: URLs
    if (mediaUrl.startsWith("data:")) {
        const base64 = mediaUrl.substring(mediaUrl.indexOf(",") + 1);
        return Buffer.from(base64, "base64");
    }
    if (mediaUrl.startsWith("file:")) {
        const filePath = mediaUrl.replace("file://", "");
        return fs.readFile(filePath);
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        throw new Error("Missing Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
    }
    const authHeader =
        "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

    const res = await fetchWithTimeoutAndRetry(mediaUrl, {
        headers: { Authorization: authHeader },
        timeoutMs: Number(process.env.MEDIA_DOWNLOAD_TIMEOUT_MS || 10000),
        retry: Number(process.env.MEDIA_DOWNLOAD_RETRY_COUNT || 2),
    });

    if (!res.ok) {
        throw new Error(`Failed to download image: ${res.status} ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// ============================================================================
// Vehicle Document OCR
// ============================================================================

export async function extractVehicleDataFromImage(imageBuffer: Buffer): Promise<VehicleOcrResult> {
    const base64 = imageBuffer.toString("base64");

    const systemPrompt =
        "You are an expert OCR and data extractor for German vehicle registration documents (Zulassungsbescheinigung Teil I, old Fahrzeugschein). " +
        "Be robust to rotated, blurred, dark, skewed, partially occluded images. Always return strict JSON for the requested fields.";

    const userPrompt = `
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

    try {
        const fullPrompt = systemPrompt + "\n\n" + userPrompt;
        const content = await generateVisionCompletion({
            prompt: fullPrompt,
            imageBase64: base64,
            mimeType: "image/jpeg",
            temperature: 0,
        });

        return safeParseVehicleJson(content);
    } catch (err: any) {
        logger.error("Gemini Vision OCR failed", { error: err?.message });
        return {
            make: null, model: null, vin: null, hsn: null, tsn: null,
            year: null, engineKw: null, fuelType: null, emissionClass: null, rawText: "",
        };
    }
}

// ============================================================================
// JSON Parsing
// ============================================================================

export function safeParseVehicleJson(text: string): VehicleOcrResult {
    const empty: VehicleOcrResult = {
        make: null, model: null, vin: null, hsn: null, tsn: null,
        year: null, engineKw: null, fuelType: null, emissionClass: null, rawText: "",
    };

    if (!text) return empty;

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonString = start !== -1 && end !== -1 && end > start ? text.slice(start, end + 1) : text;

    try {
        const obj = JSON.parse(jsonString);
        return {
            make: obj.make ?? null,
            model: obj.model ?? null,
            vin: obj.vin ?? null,
            hsn: obj.hsn ?? null,
            tsn: obj.tsn ?? null,
            year: obj.year ?? null,
            engineKw: obj.engineKw ?? null,
            fuelType: obj.fuelType ?? null,
            emissionClass: obj.emissionClass ?? null,
            rawText: obj.rawText ?? "",
        };
    } catch {
        return empty;
    }
}

// ============================================================================
// NLP Understanding (used by state handlers)
// ============================================================================

export type Intent = "ASK_PART" | "GIVE_VEHICLE_DATA" | "SMALLTALK" | "OTHER";

export interface NlpResult {
    intent: Intent;
    requestedPart: string | null;
    vehiclePatch: VehicleInfoPatch;
    clarificationQuestion: string | null;
}

import { generateChatCompletion } from "../intelligence/geminiService";

export async function understandUserText(
    text: string,
    currentVehicle: VehicleOcrResult,
    currentOrder: { requestedPart?: string | null }
): Promise<NlpResult> {
    const system = `
Du bist ein Assistent für einen Autoteile-WhatsApp-Bot.
Aufgaben:
- Intention erkennen: ASK_PART (Nutzer fragt nach Teil), GIVE_VEHICLE_DATA (Nutzer gibt Fahrzeugdaten), SMALLTALK, OTHER.
- Fahrzeugdaten aus dem Text extrahieren (make, model, year, vin, hsn, tsn, engineKw, fuelType). Nur setzen, wenn sicher erkennbar oder explizit korrigiert.
- requestedPart füllen, falls ein Teil erwähnt wird (inkl. Positionshinweisen wie vorne/hinten/links/rechts).
- Falls unklar, clarificationQuestion setzen, sonst null.
Gib NUR eine JSON-Antwort im Format:
{
  "intent": "ASK_PART" | "GIVE_VEHICLE_DATA" | "SMALLTALK" | "OTHER",
  "requestedPart": string | null,
  "vehiclePatch": { "make": string, "model": string, "year": number, "vin": string, "hsn": string, "tsn": string, "engineKw": number, "fuelType": string },
  "clarificationQuestion": string | null
}
Fehlende/unsichere Felder: weglassen oder null. Keine freien Texte außerhalb des JSON.`;

    const user = `
Aktuelle Nachricht: """${text}"""
Bereits bekanntes Fahrzeug: ${JSON.stringify(currentVehicle)}
Bereits angefragtes Teil: ${currentOrder?.requestedPart ?? null}
Extrahiere neue Infos aus der Nachricht. Überschreibe bekannte Felder nur, wenn der Nutzer sie explizit korrigiert.`;

    try {
        const content = await generateChatCompletion({
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            responseFormat: "json_object",
            temperature: 0,
        });
        return safeParseNlpJson(content);
    } catch (err: any) {
        logger.error("Gemini text understanding failed", { error: err?.message });
        return { intent: "OTHER", requestedPart: null, vehiclePatch: {}, clarificationQuestion: null };
    }
}

function safeParseNlpJson(text: string): NlpResult {
    const empty: NlpResult = { intent: "OTHER", requestedPart: null, vehiclePatch: {}, clarificationQuestion: null };
    if (!text) return empty;
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonString = start !== -1 && end !== -1 && end > start ? text.slice(start, end + 1) : text;
    try {
        const obj = JSON.parse(jsonString);
        return {
            intent: obj.intent ?? "OTHER",
            requestedPart: obj.requestedPart ?? null,
            vehiclePatch: obj.vehiclePatch ?? {},
            clarificationQuestion: obj.clarificationQuestion ?? null,
        };
    } catch {
        return empty;
    }
}

export function determineMissingVehicleFields(vehicle: any): string[] {
    const missing: string[] = [];
    if (!vehicle?.make) missing.push("make");
    if (!vehicle?.model) missing.push("model");
    if (!vehicle?.year) missing.push("year");
    const hasVin = !!vehicle?.vin;
    const hasHsnTsn = !!vehicle?.hsn && !!vehicle?.tsn;
    const hasPower = !!vehicle?.engine || !!vehicle?.engineKw;
    if (!hasVin && !hasHsnTsn && !hasPower) {
        missing.push("vin_or_hsn_tsn_or_engine");
    }
    return missing;
}

export function isVehicleSufficientForOem(vehicle: any): boolean {
    if (!vehicle) return false;
    const hasBasics = !!vehicle.make && !!vehicle.model && !!vehicle.year;
    const hasId = !!vehicle.vin || (!!vehicle.hsn && !!vehicle.tsn);
    const hasPower = vehicle.engine || vehicle.engineKw;
    return hasBasics && (hasId || hasPower);
}
