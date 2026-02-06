/**
 * @deprecated This service is deprecated. Use geminiService.ts instead.
 * 
 * MIGRATION NOTICE (Feb 2026):
 * The bot has been migrated from OpenAI to Gemini for:
 * - Higher rate limits
 * - Better cost efficiency
 * - Unified API with vision capabilities
 * 
 * All new code should import from './geminiService' instead.
 * 
 * This file is kept for backwards compatibility but will be removed in a future version.
 */

import { logger } from "@utils/logger";

// WARNING: This service is deprecated
logger.warn("openAiService is deprecated - use geminiService instead");

// Re-export from geminiService for backwards compatibility
export { generateChatCompletion, client } from "./geminiService";

// Legacy type export
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
