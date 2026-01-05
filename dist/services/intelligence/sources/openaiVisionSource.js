"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiVisionSource = void 0;
const oemScraper_1 = require("../oemScraper");
const logger_1 = require("@utils/logger");
const openai_1 = __importDefault(require("openai"));
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY
});
/**
 * Takes a screenshot of a URL using a headless browser
 * This would typically use Puppeteer or Playwright
 */
async function captureScreenshot(url) {
    try {
        // For now, we'll use a simple fetch and convert to base64
        // In production, you'd use Puppeteer/Playwright for real screenshots
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
        });
        if (!response.ok)
            return null;
        const html = await response.text();
        // For now, we'll pass the HTML directly to Vision API
        // In production, you'd convert actual screenshot to base64
        return {
            url,
            base64: Buffer.from(html).toString('base64')
        };
    }
    catch (error) {
        logger_1.logger.error(`[OpenAI Vision] Screenshot failed: ${error}`);
        return null;
    }
}
/**
 * Extracts OEM numbers from HTML using OpenAI Vision
 */
async function extractOemsWithVision(html, context) {
    try {
        const prompt = `You are analyzing a car parts website page.
    
Context: ${context}

Task: Extract ALL OEM numbers (Original Equipment Manufacturer part numbers) from this page.

OEM numbers typically:
- Are 5-18 characters long
- Contain both letters and numbers
- May include hyphens or dots
- Examples: 1K0615301AA, 8V0-615-301, A2034211012

Return ONLY a JSON array of OEM numbers found, nothing else.
Format: ["OEM1", "OEM2", "OEM3"]

If no OEM numbers are found, return: []

HTML Content (first 8000 chars):
${html.substring(0, 8000)}`;
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Using mini for cost efficiency
            messages: [
                {
                    role: "system",
                    content: "You are an expert at extracting OEM part numbers from automotive websites. You return only valid JSON arrays."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0,
            max_tokens: 500
        });
        const content = response.choices[0]?.message?.content || "[]";
        // Extract JSON array from response
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (!jsonMatch)
            return [];
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed))
            return [];
        // Normalize and validate all OEMs
        return parsed
            .map(oem => (0, oemScraper_1.normalizeOem)(String(oem)))
            .filter((oem) => oem !== null);
    }
    catch (error) {
        logger_1.logger.error(`[OpenAI Vision] Extraction failed: ${error.message}`);
        return [];
    }
}
exports.openaiVisionSource = {
    name: "OpenAI-Vision",
    async resolveCandidates(req) {
        if (!process.env.OPENAI_API_KEY) {
            logger_1.logger.warn("[OpenAI Vision] API key not configured");
            return [];
        }
        try {
            const { vehicle, partDescription, suspectedOEM } = req;
            // Build search context
            const context = `Vehicle: ${vehicle.brand} ${vehicle.model} ${vehicle.year || ''}
Part: ${partDescription}
${suspectedOEM ? `Suspected OEM: ${suspectedOEM}` : ''}`;
            // Try multiple sources with Vision API
            const sources = [
                `https://www.autodoc.de/search?keyword=${encodeURIComponent(`${vehicle.brand} ${vehicle.model} ${partDescription}`)}`,
                `https://www.kfzteile24.de/search?q=${encodeURIComponent(`${vehicle.brand} ${vehicle.model} ${partDescription}`)}`
            ];
            const allOems = [];
            for (const url of sources) {
                try {
                    logger_1.logger.info(`[OpenAI Vision] Analyzing: ${url}`);
                    const response = await fetch(url, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                        }
                    });
                    if (!response.ok)
                        continue;
                    const html = await response.text();
                    const oems = await extractOemsWithVision(html, context);
                    allOems.push(...oems);
                    logger_1.logger.info(`[OpenAI Vision] Found ${oems.length} OEMs from ${url}`);
                }
                catch (error) {
                    logger_1.logger.error(`[OpenAI Vision] Error processing ${url}: ${error.message}`);
                }
            }
            const uniqueOems = [...new Set(allOems)];
            return uniqueOems.map(oem => ({
                oem,
                source: "OpenAI-Vision",
                confidence: 0.88, // High confidence - AI-powered extraction
                metadata: {
                    method: "gpt-4-vision",
                    context
                }
            }));
        }
        catch (error) {
            logger_1.logger.error(`[OpenAI Vision] Error: ${error.message}`);
            return [];
        }
    }
};
