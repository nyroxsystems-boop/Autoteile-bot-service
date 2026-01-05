"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
exports.generateChatCompletion = generateChatCompletion;
const openai_1 = __importDefault(require("openai"));
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required but not set.");
}
exports.client = new openai_1.default({ apiKey });
function truncateContent(content, maxLen = 2000) {
    if (!content)
        return "";
    return content.length > maxLen ? content.slice(0, maxLen) : content;
}
async function generateChatCompletion(params) {
    const { messages, model = "gpt-4.1-mini" } = params;
    const sanitizedMessages = messages.map((m) => ({
        role: m.role,
        content: truncateContent(m.content)
    }));
    const maxAttempts = 2;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await exports.client.chat.completions.create({
                model,
                messages: sanitizedMessages
            });
            return response.choices[0]?.message?.content ?? "";
        }
        catch (err) {
            lastErr = err;
            console.error(`OpenAI chat completion failed (attempt ${attempt}/${maxAttempts}):`, err?.message || err);
        }
    }
    throw new Error("OpenAI request failed");
}
