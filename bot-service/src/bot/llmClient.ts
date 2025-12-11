import OpenAI from "openai";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function askLLM(messages: ChatMessage[]): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: messages as any // cast to align with OpenAI types
  });

  return response.choices?.[0]?.message?.content ?? "";
}
