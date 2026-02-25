/**
 * 🖼️ IMAGE PRE-CLASSIFIER
 *
 * Determines whether an incoming WhatsApp image is:
 * - A vehicle document (registration, Fahrzeugschein, license plate)
 * - A part photo (user showing the part they need)
 * - Neither (random photo, screenshot, etc.)
 *
 * This avoids sending every image through GPT-4.1 Vision OCR,
 * which is expensive (~$0.01-0.03 per call) and adds ~3-5s latency.
 *
 * Uses a cheap Gemini Flash call for classification only.
 * Only vehicle documents proceed to the expensive OCR pipeline.
 */

import { logger } from '@utils/logger';
import { generateChatCompletion } from '../intelligence/geminiService';

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

2. "part_photo" — Foto eines Autoteils
   - Bremsscheibe, Filter, Zündkerze, Stoßdämpfer etc.
   - Teile-Verpackung mit OEM-Nummer

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
 * Uses a cheap Gemini Flash call (~$0.001).
 * Returns whether OCR should run.
 */
export async function classifyImage(imageUrl: string): Promise<ImageClassificationResult> {
    try {
        const promptWithUrl = `${CLASSIFICATION_PROMPT}\n\nBild-URL: ${imageUrl}\n\n(Wenn du das Bild nicht sehen kannst, antworte mit {"classification": "unknown", "confidence": 0, "reason": "Bild nicht verfügbar"})`;

        const response = await generateChatCompletion({
            messages: [
                {
                    role: 'user',
                    content: promptWithUrl
                }
            ],
            responseFormat: 'json_object',
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
        logger.warn('[ImageClassifier] Classification failed, defaulting to OCR', { error: err?.message });

        // Fail-safe: if classification fails, run OCR anyway (conservative approach)
        return {
            classification: 'unknown',
            confidence: 0,
            reason: `Classification failed: ${err?.message}`,
            shouldRunOCR: true,
        };
    }
}
