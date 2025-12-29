"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmHeuristicSource = void 0;
const baseSource_1 = require("./baseSource");
const openAiService_1 = require("../../openAiService");
/**
 * Uses LLM to guess potential OEM numbers based on vehicle data and part description.
 * This is useful as a fallback or a "hint" for other sources.
 */
exports.llmHeuristicSource = {
    name: "llm_heuristic",
    async resolveCandidates(req) {
        const prompt = `Fahrzeug: ${JSON.stringify(req.vehicle)}
Teil: ${req.partQuery.rawText}

AUFGABE:
1. Identifiziere das Teil und finde die gängigsten Premium-Aftermarket-Nummern dafür (z.B. von MANN, BOSCH, ATE, LEMFÖRDER, SACHS).
2. Konvertiere diese Aftermarket-Nummern in die exakte Original-Hersteller-OEM-Nummer (VAG, BMW, MB, etc.).
3. Nenne mir die 3 wahrscheinlichsten OEM-Nummern für genau dieses Fahrzeugmodell (Motorcode/kW beachten!).

ANTWORT:
Gib mir NUR ein JSON-Array zurück:
[{"oem": "...", "brand": "OEM-MARKE", "confidence": 0.6, "reason": "Referenz via MANN CUK 1234..."}]
Setze Confidence auf 0.5-0.7 je nach Sicherheit.`;
        try {
            const raw = await (0, openAiService_1.generateChatCompletion)({
                messages: [
                    { role: "system", content: "Du bist ein erfahrener KFZ-Teilehändler mit Zugriff auf TecDoc-Cross-Referenz-Wissen. Sei extrem präzise." },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4.1-mini" // or gpt-4o if available for better reasoning
            });
            const start = raw.indexOf("[");
            const end = raw.lastIndexOf("]");
            if (start === -1 || end === -1)
                return [];
            const parsed = JSON.parse(raw.slice(start, end + 1));
            const candidates = parsed.map(p => ({
                oem: String(p.oem).toUpperCase().replace(/[^A-Z0-9]/g, ""),
                brand: p.brand || null,
                source: this.name,
                confidence: (0, baseSource_1.clampConfidence)(Number(p.confidence || 0.3)),
                meta: { reason: p.reason }
            }));
            (0, baseSource_1.logSourceResult)(this.name, candidates.length);
            return candidates;
        }
        catch (err) {
            return [];
        }
    }
};
