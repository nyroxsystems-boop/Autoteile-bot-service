import fetch, { Response } from "node-fetch";

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retry?: number;
  retryDelayMs?: number;
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0"
];

export function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function getStealthHeaders(host?: string) {
  const headers: Record<string, string> = {
    "User-Agent": getRandomUserAgent(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0"
  };
  if (host) headers["Host"] = host;
  return headers;
}

export async function fetchWithTimeoutAndRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = Number(process.env.HTTP_TIMEOUT_MS || 10000),
    retry = Number(process.env.HTTP_RETRY_COUNT || 2),
    retryDelayMs = Number(process.env.HTTP_RETRY_DELAY_MS || 500),
    ...rest
  } = options;

  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = { ...getStealthHeaders(), ...(rest.headers as any) };
      const resp = await (fetch as any)(url, { ...rest, headers, body: (rest as any)?.body ?? undefined, signal: controller.signal });
      clearTimeout(timeout);

      if (resp.status === 403 || resp.status === 429) {
        throw new Error(`HTTP ${resp.status}`); // Trigger retry for bot detection
      }

      return resp;
    } catch (err: any) {
      clearTimeout(timeout);
      if (attempt > retry) throw err;
      // Exponential backoff
      await delay(retryDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100);
    }
  }
}
