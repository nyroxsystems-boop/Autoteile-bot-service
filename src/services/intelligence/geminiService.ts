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
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout for all Gemini calls

// Verify API key
if (!GEMINI_API_KEY) {
    logger.warn("GEMINI_API_KEY is not set. AI features will fail.");
}

// Initialize client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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

    logger.error("Gemini FAILED after all attempts", {
        finalError: lastErr?.message,
    });

    throw new Error(`Gemini request failed: ${lastErr?.message || 'Unknown error'}`);
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
