import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required but not set.");
}

export const client = new OpenAI({ apiKey });

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function truncateContent(content: string, maxLen = 2000): string {
  if (!content) return "";
  return content.length > maxLen ? content.slice(0, maxLen) : content;
}

export async function generateChatCompletion(params: {
  messages: ChatMessage[];
  model?: string;
}): Promise<string> {
  const { messages, model = "gpt-4.1-mini" } = params;

  const sanitizedMessages = messages.map((m) => ({
    role: m.role,
    content: truncateContent(m.content)
  }));

  const maxAttempts = 2;
  let lastErr: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: sanitizedMessages
      });

      return response.choices[0]?.message?.content ?? "";
    } catch (err: any) {
      lastErr = err;
      console.error(`OpenAI chat completion failed (attempt ${attempt}/${maxAttempts}):`, err?.message || err);
    }
  }

  throw new Error("OpenAI request failed");
}
