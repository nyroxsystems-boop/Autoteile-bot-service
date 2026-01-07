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
  responseFormat?: "json_object" | "text";
  temperature?: number;
}): Promise<string> {
  const { messages, model = "gpt-4o-mini", responseFormat, temperature } = params;
  const startTime = Date.now();

  const sanitizedMessages = messages.map((m) => ({
    role: m.role,
    content: truncateContent(m.content)
  }));

  // LOG: Request details
  console.log("🔵 OpenAI Request:", {
    model,
    messageCount: sanitizedMessages.length,
    responseFormat,
    temperature,
    systemPromptLength: sanitizedMessages[0]?.content?.length || 0,
    userContentLength: sanitizedMessages[1]?.content?.length || 0
  });

  const maxAttempts = 2;
  let lastErr: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const completionParams: any = {
        model,
        messages: sanitizedMessages
      };

      // Add response_format if JSON is requested
      if (responseFormat === "json_object") {
        completionParams.response_format = { type: "json_object" };
      }

      // Add temperature if specified
      if (temperature !== undefined) {
        completionParams.temperature = temperature;
      }

      console.log(`🟡 OpenAI API call attempt ${attempt}/${maxAttempts}...`);
      const response = await client.chat.completions.create(completionParams);
      const elapsed = Date.now() - startTime;

      const content = response.choices[0]?.message?.content ?? "";

      console.log("✅ OpenAI Success:", {
        elapsed,
        model: response.model,
        finishReason: response.choices[0]?.finish_reason,
        tokensUsed: response.usage?.total_tokens,
        responseLength: content.length
      });

      return content;
    } catch (err: any) {
      lastErr = err;
      const elapsed = Date.now() - startTime;

      console.error(`❌ OpenAI Error (attempt ${attempt}/${maxAttempts}):`, {
        elapsed,
        error: err?.message,
        errorType: err?.constructor?.name,
        statusCode: err?.status || err?.statusCode,
        code: err?.code,
        isRateLimit: err?.status === 429,
        isTimeout: err?.code === 'ETIMEDOUT',
        isNetworkError: err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND',
        stack: err?.stack?.split('\n').slice(0, 3).join('\n')
      });
    }
  }

  console.error("❌ OpenAI FAILED after all attempts:", {
    finalError: lastErr?.message,
    errorType: lastErr?.constructor?.name
  });

  throw new Error(`OpenAI request failed: ${lastErr?.message || 'Unknown error'}`);
}
