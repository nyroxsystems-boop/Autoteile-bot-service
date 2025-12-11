import fetch from "node-fetch";

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
}

export interface OpenAiClient {
  chat(prompt: string, opts?: ChatCompletionOptions): Promise<string>;
}

export function createOpenAiClient(): OpenAiClient {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  async function chat(prompt: string, opts: ChatCompletionOptions = {}): Promise<string> {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    const body = {
      model: opts.model || "gpt-4.1-mini",
      temperature: opts.temperature ?? 0,
      messages: [{ role: "system", content: "You are a concise assistant that only returns JSON when asked." }, { role: "user", content: prompt }]
    };
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI error ${resp.status}: ${text.slice(0, 500)}`);
    }
    const json: any = await resp.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("OpenAI response missing content");
    }
    return content;
  }

  return { chat };
}
