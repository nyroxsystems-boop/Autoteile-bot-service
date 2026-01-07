import axios, { AxiosResponse } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

// Read proxy from HTTPS_WEB or HTTP_WEB environment variables
const PROXY_URL = process.env.HTTPS_WEB || process.env.HTTP_WEB;

// Configure axios defaults with proxy
if (PROXY_URL) {
  const proxyAgent = new HttpsProxyAgent(PROXY_URL);
  axios.defaults.httpAgent = proxyAgent;
  axios.defaults.httpsAgent = proxyAgent;
  console.log("✅ HTTP Client (axios): Using proxy from HTTPS_WEB/HTTP_WEB:", {
    proxyUrl: PROXY_URL.replace(/:[^:@]+@/, ':***@') // Hide password
  });
} else {
  console.warn("⚠️ HTTP Client: No proxy configured (HTTPS_WEB/HTTP_WEB not set) - requests may be blocked!");
}

export interface FetchOptions {
  timeoutMs?: number;
  retry?: number;
  retryDelayMs?: number;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
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

// Adapter to make axios response compatible with node-fetch Response interface
export interface Response {
  ok: boolean;
  status: number;
  statusText: string;
  headers: any;
  text(): Promise<string>;
  json(): Promise<any>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function axiosToFetchResponse(axiosResponse: AxiosResponse): Response {
  return {
    ok: axiosResponse.status >= 200 && axiosResponse.status < 300,
    status: axiosResponse.status,
    statusText: axiosResponse.statusText,
    headers: axiosResponse.headers,
    text: async () => axiosResponse.data,
    json: async () => typeof axiosResponse.data === 'string' ? JSON.parse(axiosResponse.data) : axiosResponse.data,
    arrayBuffer: async () => {
      if (axiosResponse.data instanceof ArrayBuffer) {
        return axiosResponse.data;
      }
      // Convert Buffer to ArrayBuffer if needed
      if (Buffer.isBuffer(axiosResponse.data)) {
        return axiosResponse.data.buffer.slice(
          axiosResponse.data.byteOffset,
          axiosResponse.data.byteOffset + axiosResponse.data.byteLength
        ) as ArrayBuffer;
      }
      // For string data, encode to ArrayBuffer
      const encoder = new TextEncoder();
      return encoder.encode(axiosResponse.data).buffer as ArrayBuffer;
    }
  };
}

export async function fetchWithTimeoutAndRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = Number(process.env.HTTP_TIMEOUT_MS || 10000),
    retry = Number(process.env.HTTP_RETRY_COUNT || 2),
    retryDelayMs = Number(process.env.HTTP_RETRY_DELAY_MS || 500),
    method = 'GET',
    headers = {},
    body
  } = options;

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const mergedHeaders = { ...getStealthHeaders(), ...headers };

      const axiosResponse = await axios({
        url,
        method,
        headers: mergedHeaders,
        data: body,
        timeout: timeoutMs,
        validateStatus: () => true, // Don't throw on any status
        maxRedirects: 5
      });

      if (axiosResponse.status === 403 || axiosResponse.status === 429) {
        throw new Error(`HTTP ${axiosResponse.status}`); // Trigger retry for bot detection
      }

      return axiosToFetchResponse(axiosResponse);
    } catch (err: any) {
      if (attempt > retry) throw err;
      // Exponential backoff
      await delay(retryDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100);
    }
  }
}
