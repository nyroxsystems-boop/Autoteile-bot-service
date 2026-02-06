"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = exports.generateChatCompletion = void 0;
const logger_1 = require("../../utils/logger");
// WARNING: This service is deprecated
logger_1.logger.warn("openAiService is deprecated - use geminiService instead");
// Re-export from geminiService for backwards compatibility
var geminiService_1 = require("./geminiService");
Object.defineProperty(exports, "generateChatCompletion", { enumerable: true, get: function () { return geminiService_1.generateChatCompletion; } });
Object.defineProperty(exports, "client", { enumerable: true, get: function () { return geminiService_1.client; } });
