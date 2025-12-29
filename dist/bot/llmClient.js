"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askLLM = askLLM;
const openai_1 = __importDefault(require("openai"));
const client = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY || ""
});
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
async function askLLM(messages) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured");
    }
    const response = await client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: messages // cast to align with OpenAI types
    });
    return response.choices?.[0]?.message?.content ?? "";
}
