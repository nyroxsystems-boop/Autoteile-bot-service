/**
 * 🖼️ IMAGE PRE-CLASSIFIER
 *
 * Determines whether an incoming WhatsApp image is:
 * - A vehicle document (registration, Fahrzeugschein, license plate)
 * - A part photo (user showing the part they need)
 * - Neither (random photo, screenshot, etc.)
 *
 * This avoids sending every image through expensive OCR,
 * and routes part photos to direct OEM extraction.
 *
 * Uses Gemini Vision (generateVisionCompletion) — the model MUST SEE the image.
 * Previous bug: used generateChatCompletion (text-only) which couldn't see the image.
 */

import { logger } from '@utils/logger';
import { generateVisionCompletion } from '../intelligence/geminiService';

// ============================================================================
// Types
// ============================================================================

export type ImageClassification = 'vehicle_document' | 'part_photo' | 'unknown';

export interface ImageClassificationResult {
    classification: ImageClassification;
    confidence: number;
    reason: string;
    shouldRunOCR: boolean;
}

// ============================================================================
// Classification Prompt
// ============================================================================

const CLASSIFICATION_PROMPT = `Du bist ein Bild-Klassifizierer für einen Autoteile-Bot.

Klassifiziere das Bild in eine der drei Kategorien:

1. "vehicle_document" — Fahrzeugschein, Zulassungsbescheinigung, Fahrzeugbrief, KFZ-Registrierung, Steuerkarte
   - Enthält typische Felder: HSN/TSN, VIN, Erstzulassung, Marke/Modell
   - Offizielles Dokument mit Datenfeldern

2. "part_photo" — Foto eines Autoteils oder einer Teileverpackung
   - Bremsscheibe, Filter, Zündkerze, Stoßdämpfer etc.
   - Teile-Verpackung mit OEM-Nummer oder Aufkleber
   - Metallteile mit Stanzungen/Gravuren

3. "unknown" — Keines der obigen
   - Screenshot, Selfie, Landschaft, Text-Chat etc.

Antworte NUR mit JSON:
{
  "classification": "vehicle_document" | "part_photo" | "unknown",
  "confidence": 0.0-1.0,
  "reason": "Kurze Erklärung"
}`;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Classify an image before sending it to expensive OCR.
 * 
 * CRITICAL FIX: Uses generateVisionCompletion (can SEE the image)
 * instead of generateChatCompletion (text-only, could NOT see image).
 * 
 * Accepts either a Twilio media URL or a base64 string.
 * Downloads from URL first, then sends base64 to Gemini Vision.
 */
export async function classifyImage(imageUrlOrBase64: string): Promise<ImageClassificationResult> {
    try {
        let imageBase64: string;

        // If it's a URL, download the image first
        if (imageUrlOrBase64.startsWith('http')) {
            const fetch = (await import('node-fetch')).default;

            // Twilio media URLs require auth
            const twilioSid = process.env.TWILIO_ACCOUNT_SID;
            const twilioToken = process.env.TWILIO_AUTH_TOKEN;
            const headers: Record<string, string> = {};
            if (twilioSid && twilioToken && imageUrlOrBase64.includes('twilio.com')) {
                headers['Authorization'] = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
            }

            const response = await fetch(imageUrlOrBase64, {
                headers,
                signal: AbortSignal.timeout(8000),
            });

            if (!response.ok) {
                throw new Error(`Image download failed: HTTP ${response.status}`);
            }

            const buffer = await response.buffer();
            imageBase64 = buffer.toString('base64');
        } else {
            // Already base64
            imageBase64 = imageUrlOrBase64;
        }

        // Use Vision API — the model can actually SEE the image
        const response = await generateVisionCompletion({
            prompt: CLASSIFICATION_PROMPT,
            imageBase64,
            temperature: 0,
        });

        const cleanContent = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanContent);

        const classification: ImageClassification = result.classification || 'unknown';
        const confidence = result.confidence || 0.5;
        const reason = result.reason || '';

        logger.info('[ImageClassifier] Result', { classification, confidence, reason });

        return {
            classification,
            confidence,
            reason,
            shouldRunOCR: classification === 'vehicle_document' && confidence >= 0.6,
        };
    } catch (err: any) {
        logger.warn('[ImageClassifier] Classification failed, defaulting to vehicle_document (safe fallback)', {
            error: err?.message,
        });

        // Fail-safe: if classification fails, assume vehicle document (conservative — runs OCR)
        return {
            classification: 'vehicle_document',
            confidence: 0,
            reason: `Classification failed: ${err?.message}`,
            shouldRunOCR: true,
        };
    }
}
