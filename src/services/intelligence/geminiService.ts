/**
 * 🤖 GEMINI AI SERVICE
 * Drop-in replacement for OpenAI with higher rate limits
 * 
 * Features:
 * - Chat completions (text)
 * - Vision completions (OCR)
 * - JSON response mode
 * - Retry logic
 */

import { GoogleGenerativeAI, GenerativeModel, Content, Part } from "@google/generative-ai";
import { logger } from "../../utils/logger";

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout for all Gemini calls

// Verify API key
if (!GEMINI_API_KEY) {
    logger.warn("GEMINI_API_KEY is not set. AI features will fail.");
}

// Initialize client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ============================================================================
// M5 FIX: Global Rate Limiter (token bucket)
// ============================================================================

const RATE_LIMIT_MAX = 30;      // Max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window
const RATE_LIMIT_REFILL_RATE = RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS; // ~0.5 tokens/sec
let rateLimitTokens = RATE_LIMIT_MAX;
let rateLimitLastRefill = Date.now();

function acquireRateToken(): boolean {
    const now = Date.now();
    const elapsed = now - rateLimitLastRefill;
    // #13 FIX: Gradual refill — tokens trickle back, no burst spike
    const tokensToAdd = elapsed * RATE_LIMIT_REFILL_RATE;
    rateLimitTokens = Math.min(RATE_LIMIT_MAX, rateLimitTokens + tokensToAdd);
    rateLimitLastRefill = now;

    if (rateLimitTokens >= 1) {
        rateLimitTokens--;
        return true;
    }
    return false;
}

async function waitForRateToken(): Promise<void> {
    if (acquireRateToken()) return;
    // Wait until next refill
    const waitMs = RATE_LIMIT_WINDOW_MS - (Date.now() - rateLimitLastRefill) + 100;
    logger.warn('[GeminiRateLimit] Rate limit hit, waiting', { waitMs });
    await sleep(Math.min(waitMs, 5000)); // Cap wait at 5s
}

// ============================================================================
// Types (OpenAI-compatible)
// ============================================================================

export type ChatMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

type ImagePart = {
    type: "image";
    data: string;      // Base64 encoded
    mimeType: string;
};

type TextPart = {
    type: "text";
    text: string;
};

export type MessageContent = string | (TextPart | ImagePart)[];

// ============================================================================
// Helper Functions
// ============================================================================

function truncateContent(content: string, maxLen = 8000): string {
    if (!content) return "";
    return content.length > maxLen ? content.slice(0, maxLen) + "..." : content;
}

/**
 * Convert OpenAI-style messages to Gemini format
 */
function convertMessages(messages: ChatMessage[]): { systemInstruction?: string; contents: Content[] } {
    let systemInstruction: string | undefined;
    const contents: Content[] = [];

    for (const msg of messages) {
        if (msg.role === "system") {
            // Gemini uses systemInstruction instead of system messages
            systemInstruction = truncateContent(msg.content);
        } else {
            contents.push({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: truncateContent(msg.content) }],
            });
        }
    }

    return { systemInstruction, contents };
}

// ============================================================================
// Main Chat Completion (OpenAI-compatible signature)
// ============================================================================

export async function generateChatCompletion(params: {
    messages: ChatMessage[];
    model?: string;
    responseFormat?: "json_object" | "text";
    temperature?: number;
}): Promise<string> {
    const { messages, model = DEFAULT_MODEL, responseFormat, temperature = 0.7 } = params;
    const startTime = Date.now();

    // M5: Rate limiter
    await waitForRateToken();

    // LOG: Request details
    logger.info("Gemini Request", {
        model,
        messageCount: messages.length,
        responseFormat,
        temperature,
        systemPromptLength: messages.find(m => m.role === "system")?.content?.length || 0,
    });

    const maxAttempts = 3;
    let lastErr: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const { systemInstruction, contents } = convertMessages(messages);

            // Configure model
            const generationConfig: any = {
                temperature,
                maxOutputTokens: 4096,
            };

            // JSON mode
            if (responseFormat === "json_object") {
                generationConfig.responseMimeType = "application/json";
            }

            const genModel = genAI.getGenerativeModel({
                model,
                systemInstruction,
                generationConfig,
            });

            logger.debug("Gemini API call", { attempt, maxAttempts });

            // Set up timeout to prevent hanging
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error(`Gemini request timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
            });

            // For single turn, use generateContent with contents wrapper (with timeout)
            const apiPromise = genModel.generateContent({ contents });
            const result = await Promise.race([apiPromise, timeoutPromise]);
            const response = result.response;
            const content = response.text();

            const elapsed = Date.now() - startTime;

            logger.info("Gemini Success", {
                elapsed,
                model,
                responseLength: content.length,
                finishReason: response.candidates?.[0]?.finishReason,
            });

            return content;

        } catch (err: any) {
            lastErr = err;
            const elapsed = Date.now() - startTime;

            logger.error("Gemini Error", {
                attempt,
                maxAttempts,
                elapsed,
                error: err?.message,
                errorType: err?.constructor?.name,
                statusCode: err?.status,
                isRateLimit: err?.status === 429,
            });

            // Wait before retry
            if (attempt < maxAttempts) {
                await sleep(1000 * attempt);
            }
        }
    }

    // S1 FIX: OpenAI fallback when Gemini exhausts retries
    if (OPENAI_API_KEY) {
        try {
            logger.warn('[GeminiFallback] Gemini failed, attempting OpenAI fallback', {
                geminiError: lastErr?.message
            });
            const openAiResponse = await openAiFallback(messages, responseFormat, temperature);
            return openAiResponse;
        } catch (fallbackErr: any) {
            logger.error('[GeminiFallback] OpenAI fallback also failed', {
                error: fallbackErr?.message
            });
        }
    }

    logger.error("Gemini FAILED after all attempts (no fallback available)", {
        finalError: lastErr?.message,
    });

    throw new Error(`Gemini request failed: ${lastErr?.message || 'Unknown error'}`);
}

/**
 * S1: OpenAI fallback for critical AI calls when Gemini is down
 */
async function openAiFallback(
    messages: ChatMessage[],
    responseFormat?: "json_object" | "text",
    temperature = 0.7
): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-4.1-mini',
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            temperature,
            max_tokens: 4096,
            ...(responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
        throw new Error(`OpenAI HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';

    logger.info('[GeminiFallback] OpenAI fallback succeeded', {
        responseLength: content.length,
        model: 'gpt-4.1-mini',
    });

    return content;
}

// ============================================================================
// Vision Completion (for OCR)
// ============================================================================

export async function generateVisionCompletion(params: {
    prompt: string;
    imageBase64: string;
    mimeType?: string;
    model?: string;
    temperature?: number;
}): Promise<string> {
    const {
        prompt,
        imageBase64,
        mimeType = "image/jpeg",
        model = DEFAULT_MODEL,
        temperature = 0.3
    } = params;

    const startTime = Date.now();

    logger.info("Gemini Vision Request", {
        model,
        promptLength: prompt.length,
        imageSize: imageBase64.length,
        mimeType,
    });

    const maxAttempts = 2;
    let lastErr: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const genModel = genAI.getGenerativeModel({
                model,
                generationConfig: {
                    temperature,
                    maxOutputTokens: 4096,
                },
            });

            // Build image part
            const imagePart: Part = {
                inlineData: {
                    data: imageBase64,
                    mimeType,
                },
            };

            const textPart: Part = { text: prompt };

            logger.debug("Gemini Vision call", { attempt, maxAttempts });

            // Set up timeout to prevent hanging
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error(`Gemini Vision request timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
            });

            const apiPromise = genModel.generateContent([textPart, imagePart]);
            const result = await Promise.race([apiPromise, timeoutPromise]);
            const response = result.response;
            const content = response.text();

            const elapsed = Date.now() - startTime;

            logger.info("Gemini Vision Success", {
                elapsed,
                responseLength: content.length,
            });

            return content;

        } catch (err: any) {
            lastErr = err;
            const elapsed = Date.now() - startTime;

            logger.error("Gemini Vision Error", {
                attempt,
                maxAttempts,
                elapsed,
                error: err?.message,
            });

            if (attempt < maxAttempts) {
                await sleep(2000);
            }
        }
    }

    throw new Error(`Gemini Vision failed: ${lastErr?.message || 'Unknown error'}`);
}

// ============================================================================
// Streaming (optional)
// ============================================================================

export async function* streamChatCompletion(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
}): AsyncGenerator<string, void, unknown> {
    const { messages, model = DEFAULT_MODEL, temperature = 0.7 } = params;

    const { systemInstruction, contents } = convertMessages(messages);

    const genModel = genAI.getGenerativeModel({
        model,
        systemInstruction,
        generationConfig: { temperature },
    });

    const result = await genModel.generateContentStream({ contents });

    for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
            yield text;
        }
    }
}

// ============================================================================
// 🌐 Grounded Completion (with Google Search)
// ============================================================================

export interface GroundedResult {
    text: string;
    groundingChunks: Array<{ uri?: string; title?: string }>;
    searchQueries: string[];
    isGrounded: boolean;
}

/**
 * Generate a completion with Google Search grounding enabled.
 * Gemini will search the web during inference and return cited results.
 * Cost: 0 extra API keys — uses existing GEMINI_API_KEY.
 */
export async function generateGroundedCompletion(params: {
    prompt: string;
    systemInstruction?: string;
    temperature?: number;
}): Promise<GroundedResult> {
    const { prompt, systemInstruction, temperature = 0.3 } = params;

    await waitForRateToken();

    const startTime = Date.now();

    try {
        const genModel = genAI.getGenerativeModel({
            model: DEFAULT_MODEL,
            systemInstruction,
            generationConfig: {
                temperature,
                maxOutputTokens: 4096,
            },
            tools: [{ googleSearchRetrieval: {} } as any],
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Grounded request timed out')), 15000);
        });

        const apiPromise = genModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const result = await Promise.race([apiPromise, timeoutPromise]);
        const response = result.response;
        const text = response.text();

        // Extract grounding metadata
        const candidate = response.candidates?.[0] as any;
        const groundingMeta = candidate?.groundingMetadata;

        const groundingChunks: Array<{ uri?: string; title?: string }> = [];
        if (groundingMeta?.groundingChunks) {
            for (const chunk of groundingMeta.groundingChunks) {
                if (chunk.web) {
                    groundingChunks.push({ uri: chunk.web.uri, title: chunk.web.title });
                }
            }
        }

        const searchQueries: string[] = groundingMeta?.webSearchQueries || [];
        const isGrounded = groundingChunks.length > 0;

        const elapsed = Date.now() - startTime;
        logger.info('[GeminiGrounded] Completion', {
            elapsed,
            textLength: text.length,
            groundingChunks: groundingChunks.length,
            isGrounded,
            searchQueries: searchQueries.slice(0, 3),
        });

        return { text, groundingChunks, searchQueries, isGrounded };
    } catch (err: any) {
        logger.warn('[GeminiGrounded] Failed', { error: err?.message });
        return { text: '', groundingChunks: [], searchQueries: [], isGrounded: false };
    }
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Legacy export for compatibility
export const client = genAI;

// ============================================================================
// Export
// ============================================================================

export default {
    generateChatCompletion,
    generateVisionCompletion,
    streamChatCompletion,
    client: genAI,
};
