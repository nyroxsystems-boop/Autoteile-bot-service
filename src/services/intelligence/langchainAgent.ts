/**
 * 🤖 LANGCHAIN AGENT - Premium WhatsApp Orchestrator
 * 
 * Drop-in replacement for callOrchestrator() using LangChain ReAct pattern.
 * Features:
 * - Tool-calling with structured output
 * - Conversation memory
 * - Optional LangSmith observability
 */

import { ChatOpenAI } from "@langchain/openai";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";
import { logger } from "@utils/logger";
import { allTools } from "./langchainTools";
import { createMemoryForSession, getSessionMessageCount } from "./langchainMemory";
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
// Agent Configuration
// ============================================================================

// Create the LLM with structured output
function createLLM() {
    return new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0,
        openAIApiKey: process.env.OPENAI_API_KEY,
    });
}

// Create the prompt template
function createPromptTemplate() {
    return ChatPromptTemplate.fromMessages([
        ["system", ORCHESTRATOR_PROMPT],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
        new MessagesPlaceholder("agent_scratchpad"),
    ]);
}

// ============================================================================
// Main Agent Function
// ============================================================================

/**
 * LangChain-based orchestrator function
 * Drop-in replacement for callOrchestrator()
 *
 * 10/10 Premium Features:
 * - Rate limiting
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
        logger.warn("[LangChain] Rate limit exceeded", {
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

    logger.info("🤖 [LangChain] Calling Agent", {
        sessionId: payload.sessionId,
        status: payload.conversation?.status,
        language: payload.conversation?.language,
        hasOCR: !!payload.ocr,
        messagePreview: payload.latestMessage?.substring(0, 100),
        historyLength: getSessionMessageCount(payload.sessionId),
    });

    try {
        // 1. Create LLM
        const llm = createLLM();

        // 2. Create prompt
        const prompt = createPromptTemplate();

        // 3. Create agent with tools
        const agent = await createToolCallingAgent({
            llm,
            tools: allTools,
            prompt,
        });

        // 4. Create executor with memory
        const memory = createMemoryForSession(payload.sessionId);
        const executor = new AgentExecutor({
            agent,
            tools: allTools,
            memory,
            verbose: process.env.LANGCHAIN_VERBOSE === "true",
            returnIntermediateSteps: false,
            maxIterations: 3, // Prevent infinite loops
        });

        // 5. Build input context
        const inputContext = JSON.stringify({
            conversation: payload.conversation,
            latestMessage: payload.latestMessage,
            ocr: payload.ocr || null,
        });

        // 6. Execute agent
        const result = await executor.invoke({
            input: inputContext,
        });

        const elapsed = Date.now() - startTime;

        // 7. Parse output
        let parsed: OrchestratorOutput;

        try {
            // Try to parse as JSON first
            const outputText = typeof result.output === "string"
                ? result.output
                : JSON.stringify(result.output);

            // Find JSON in response
            const jsonStart = outputText.indexOf("{");
            const jsonEnd = outputText.lastIndexOf("}");

            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                const jsonString = outputText.slice(jsonStart, jsonEnd + 1);
                const rawParsed = JSON.parse(jsonString);

                // Validate with Zod
                parsed = OrchestratorOutputSchema.parse(rawParsed);
            } else {
                // Fallback: Treat as plain text response
                parsed = {
                    action: "smalltalk",
                    reply: outputText.trim(),
                    slots: {},
                    required_slots: [],
                    confidence: 0.8,
                };
            }
        } catch (parseError: any) {
            logger.warn("🤖 [LangChain] JSON parse failed, using fallback", {
                error: parseError?.message,
                output: result.output,
            });

            parsed = {
                action: "smalltalk",
                reply: typeof result.output === "string"
                    ? result.output.trim()
                    : "Ich verstehe Ihre Anfrage. Wie kann ich Ihnen helfen?",
                slots: {},
                required_slots: [],
                confidence: 0.7,
            };
        }

        // 📊 Record success metrics
        recordRequest(true, elapsed);

        logger.info("✅ [LangChain] Agent succeeded", {
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

        logger.error("❌ [LangChain] Agent call FAILED", {
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
 * Check if LangChain agent is enabled via environment variable
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
    toolCount: number;
} {
    return {
        enabled: isLangChainEnabled(),
        modelName: "gpt-4o-mini",
        toolCount: allTools.length,
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
