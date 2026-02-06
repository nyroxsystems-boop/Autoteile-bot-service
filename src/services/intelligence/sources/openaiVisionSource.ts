/**
 * Gemini Vision Scraper (migrated from OpenAI)
 * Uses Gemini Vision to extract OEM numbers from website content
 * Useful for sites with complex layouts
 * 
 * MIGRATION: OpenAI -> Gemini (Feb 2026)
 */
import { OEMSource, OEMCandidate } from "./baseSource";
import { normalizeOem } from "../oemScraper";
import { logger } from "@utils/logger";
import { generateChatCompletion } from "../geminiService";

/**
 * Extracts OEM numbers from HTML using Gemini
 */
async function extractOemsWithGemini(html: string, context: string): Promise<string[]> {
    try {
        const prompt = `You are analyzing a car parts website page.
    
Context: ${context}

Task: Extract ALL OEM numbers (Original Equipment Manufacturer part numbers) from this page.

OEM numbers typically:
- Are 5-18 characters long
- Contain both letters and numbers
- May include hyphens or dots
- Examples: 1K0615301AA, 8V0-615-301, A2034211012

Return ONLY a JSON object with an array of OEM numbers found.
Format: {"oems": ["OEM1", "OEM2", "OEM3"]}

If no OEM numbers are found, return: {"oems": []}

HTML Content (first 8000 chars):
${html.substring(0, 8000)}`;

        const response = await generateChatCompletion({
            messages: [
                {
                    role: "system",
                    content: "You are an expert at extracting OEM part numbers from automotive websites. You return only valid JSON."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            responseFormat: "json_object",
            temperature: 0
        });

        if (!response) return [];

        // Parse JSON response
        const parsed = JSON.parse(response);
        const oems = parsed.oems || parsed.candidates || [];

        if (!Array.isArray(oems)) return [];

        // Normalize and validate all OEMs
        return oems
            .map(oem => normalizeOem(String(oem)))
            .filter((oem): oem is string => oem !== null);

    } catch (error: any) {
        logger.error(`[Gemini Vision] Extraction failed: ${error.message}`);
        return [];
    }
}

export const openaiVisionSource: OEMSource = {
    name: "Gemini-Vision", // Renamed but export kept for backwards compatibility

    async resolveCandidates(req: any): Promise<OEMCandidate[]> {
        if (!process.env.GEMINI_API_KEY) {
            logger.warn("[Gemini Vision] API key not configured");
            return [];
        }

        try {
            const vehicle = req.vehicle || {};
            const partDescription = req.partQuery?.rawText || "";
            const suspectedOEM = req.partQuery?.suspectedNumber;

            // Build search context
            const context = `Vehicle: ${vehicle.make} ${vehicle.model} ${vehicle.year || ''}
Part: ${partDescription}
${suspectedOEM ? `Suspected OEM: ${suspectedOEM}` : ''}`;

            // Try multiple sources with Gemini API
            const sources = [
                `https://www.autodoc.de/search?keyword=${encodeURIComponent(`${vehicle.make} ${vehicle.model} ${partDescription}`)}`,
                `https://www.kfzteile24.de/search?q=${encodeURIComponent(`${vehicle.make} ${vehicle.model} ${partDescription}`)}`
            ];

            const allOems: string[] = [];

            for (const url of sources) {
                try {
                    logger.info(`[Gemini Vision] Analyzing: ${url}`);

                    const response = await fetch(url, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                        }
                    });

                    if (!response.ok) continue;

                    const html = await response.text();
                    const oems = await extractOemsWithGemini(html, context);

                    allOems.push(...oems);

                    logger.info(`[Gemini Vision] Found ${oems.length} OEMs from ${url}`);

                } catch (error: any) {
                    logger.error(`[Gemini Vision] Error processing ${url}: ${error.message}`);
                }
            }

            const uniqueOems = [...new Set(allOems)];

            return uniqueOems.map(oem => ({
                oem,
                source: "Gemini-Vision",
                confidence: 0.88, // High confidence - AI-powered extraction
                metadata: {
                    method: "gemini-2.0-flash",
                    context
                }
            }));

        } catch (error: any) {
            logger.error(`[Gemini Vision] Error: ${error.message}`);
            return [];
        }
    }
};
