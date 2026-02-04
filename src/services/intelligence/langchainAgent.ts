/**
 * 🤖 LANGCHAIN AGENT - Premium WhatsApp Orchestrator (GEMINI VERSION)
 * 
 * Drop-in replacement for callOrchestrator() using Gemini AI.
 * Uses the existing geminiService for maximum compatibility.
 * 
 * Features:
 * - Structured JSON output via Gemini
 * - Conversation memory
 * - Rate limiting
 * - Metrics tracking
 * - Graceful degradation
 */

import { z } from "zod";
import { logger } from "@utils/logger";
import { generateChatCompletion } from "./geminiService";
import { createMemoryForSession, getSessionMessageCount, addMessageToSession, getSessionHistory } from "./langchainMemory";
import { agentRateLimiter } from "./langchainRateLimiter";
import { recordRequest, recordFallback } from "./langchainMetrics";
import { ORCHESTRATOR_PROMPT } from "../../prompts/orchestratorPrompt";

// ============================================================================
// Output Schema (Zod)
// ============================================================================

const OrchestratorOutputSchema = z.object({
    action: z.enum([
        "ask_slot",
        "confirm",
        "oem_lookup",
        "order_status",
        "stock_check",
        "price_quote",
        "abort_order",
        "new_order",
        "escalate_human",
        "smalltalk",
        "abusive",
        "noop"
    ]).describe("The action to take"),
    reply: z.string().describe("Professional, short WhatsApp response (max 2-3 sentences)"),
    slots: z.object({
        make: z.string().nullable().optional(),
        model: z.string().nullable().optional(),
        year: z.number().nullable().optional(),
        vin: z.string().nullable().optional(),
        hsn: z.string().nullable().optional(),
        tsn: z.string().nullable().optional(),
        requestedPart: z.string().nullable().optional(),
        engineKw: z.number().nullable().optional(),
        position: z.string().nullable().optional(),
        oem: z.string().nullable().optional(),
    }).describe("Extracted slots from conversation"),
    required_slots: z.array(z.string()).optional().describe("Slots still needed"),
    confidence: z.number().min(0).max(1).describe("Confidence score 0.0-1.0"),
});

export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;

// ============================================================================
// Main Agent Function
// ============================================================================

/**
 * Gemini-based orchestrator function
 * Drop-in replacement for callOrchestrator()
 *
 * Premium Features:
 * - Uses Gemini 2.0 Flash for faster responses
 * - Rate limiting per session
 * - Metrics tracking
 * - Graceful degradation
 */
export async function langchainCallOrchestrator(payload: {
    conversation: {
        status: string;
        language: string;
        orderData?: any;
    };
    latestMessage: string;
    ocr?: any;
    sessionId: string; // Phone number for memory isolation
}): Promise<OrchestratorOutput | null> {
    const startTime = Date.now();

    // 🛡️ Rate Limit Check
    const rateLimitCheck = agentRateLimiter.checkLimit(payload.sessionId);
    if (!rateLimitCheck.allowed) {
        logger.warn("[Gemini Agent] Rate limit exceeded", {
            sessionId: payload.sessionId,
            reason: rateLimitCheck.reason,
        });

        // Return polite rate-limit response instead of null
        return {
            action: "smalltalk",
            reply: rateLimitCheck.reason || "Bitte warten Sie einen Moment bevor Sie weitere Nachrichten senden.",
            slots: {},
            required_slots: [],
            confidence: 1.0,
        };
    }

    logger.info("🤖 [Gemini Agent] Calling Orchestrator", {
        sessionId: payload.sessionId,
        status: payload.conversation?.status,
        language: payload.conversation?.language,
        hasOCR: !!payload.ocr,
        messagePreview: payload.latestMessage?.substring(0, 100),
        historyLength: getSessionMessageCount(payload.sessionId),
    });

    try {
        // 1. Get conversation history for context
        const history = getSessionHistory(payload.sessionId);

        // 2. Build input context
        const inputContext = JSON.stringify({
            conversation: payload.conversation,
            latestMessage: payload.latestMessage,
            ocr: payload.ocr || null,
            previousMessages: history.slice(-5), // Last 5 messages for context
        });

        // 3. Add current message to memory
        addMessageToSession(payload.sessionId, "user", payload.latestMessage);

        // 4. Call Gemini with structured JSON output
        const response = await generateChatCompletion({
            messages: [
                { role: "system", content: ORCHESTRATOR_PROMPT },
                { role: "user", content: inputContext }
            ],
            responseFormat: "json_object",
            temperature: 0
        });

        const elapsed = Date.now() - startTime;

        // 5. Parse output
        let parsed: OrchestratorOutput;

        try {
            // Find JSON in response
            const jsonStart = response.indexOf("{");
            const jsonEnd = response.lastIndexOf("}");

            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                const jsonString = response.slice(jsonStart, jsonEnd + 1);
                const rawParsed = JSON.parse(jsonString);

                // Validate with Zod
                parsed = OrchestratorOutputSchema.parse(rawParsed);
            } else {
                // Fallback: Treat as plain text response
                parsed = {
                    action: "smalltalk",
                    reply: response.trim(),
                    slots: {},
                    required_slots: [],
                    confidence: 0.8,
                };
            }
        } catch (parseError: any) {
            logger.warn("🤖 [Gemini Agent] JSON parse failed, using fallback", {
                error: parseError?.message,
                responsePreview: response?.substring(0, 200),
            });

            parsed = {
                action: "smalltalk",
                reply: response?.trim() || "Ich verstehe Ihre Anfrage. Wie kann ich Ihnen helfen?",
                slots: {},
                required_slots: [],
                confidence: 0.7,
            };
        }

        // 6. Add assistant response to memory
        addMessageToSession(payload.sessionId, "assistant", parsed.reply);

        // 📊 Record success metrics
        recordRequest(true, elapsed);

        logger.info("✅ [Gemini Agent] Orchestrator succeeded", {
            action: parsed.action,
            confidence: parsed.confidence,
            slotsCount: Object.keys(parsed.slots || {}).length,
            elapsed,
        });

        return parsed;

    } catch (error: any) {
        const elapsed = Date.now() - startTime;

        // 📊 Record failure metrics
        recordRequest(false, elapsed);
        recordFallback();

        logger.error("❌ [Gemini Agent] Orchestrator call FAILED", {
            error: error?.message,
            errorType: error?.constructor?.name,
            elapsed,
            stack: error?.stack?.split("\n").slice(0, 5).join("\n"),
        });

        return null;
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if Gemini LangChain agent is enabled via environment variable
 */
export function isLangChainEnabled(): boolean {
    return process.env.USE_LANGCHAIN_AGENT === "true";
}

/**
 * Get agent stats for monitoring
 */
export function getAgentStats(): {
    enabled: boolean;
    modelName: string;
    provider: string;
} {
    return {
        enabled: isLangChainEnabled(),
        modelName: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        provider: "Google Gemini",
    };
}

// ============================================================================
// Export
// ============================================================================

export default {
    langchainCallOrchestrator,
    isLangChainEnabled,
    getAgentStats,
    OrchestratorOutputSchema,
};
