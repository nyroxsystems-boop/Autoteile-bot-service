import fetch from "node-fetch";
import { ApifyError } from "./apifyErrors";

const APIFY_BASE_URL = "https://api.apify.com/v2";

async function handleResponse<T>(resp: any, ctx: { actorId?: string; taskId?: string }): Promise<T> {
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const bodySnippet = text?.slice(0, 500);
    throw new ApifyError({
      message: `Apify request failed: ${resp.status} ${resp.statusText}`,
      status: resp.status,
      actorId: ctx.actorId,
      taskId: ctx.taskId,
      bodySnippet
    });
  }

  const json = await resp.json().catch(() => null);
  // Apify responses often wrap payload in data; prefer data if present.
  return (json?.data as T) ?? (json as T);
}

export function createApifyClient(token = process.env.APIFY_TOKEN || "") {
  if (!token) {
    throw new Error("APIFY_TOKEN is required");
  }

  async function callActor<TInput, TOutput>(actorId: string, input: TInput): Promise<TOutput> {
    const url = `${APIFY_BASE_URL}/acts/${actorId}/runs?token=${encodeURIComponent(token)}`;
    const resp = await (fetch as any)(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    return handleResponse<TOutput>(resp, { actorId });
  }

  async function callTask<TInput, TOutput>(taskId: string, input: TInput): Promise<TOutput> {
    const url = `${APIFY_BASE_URL}/actor-tasks/${taskId}/runs?token=${encodeURIComponent(token)}`;
    const resp = await (fetch as any)(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    return handleResponse<TOutput>(resp, { taskId });
  }

  return {
    callActor,
    callTask
  };
}

export type ApifyClient = ReturnType<typeof createApifyClient>;
