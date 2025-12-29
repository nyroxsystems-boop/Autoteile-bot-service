"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomUserAgent = getRandomUserAgent;
exports.getStealthHeaders = getStealthHeaders;
exports.fetchWithTimeoutAndRetry = fetchWithTimeoutAndRetry;
const node_fetch_1 = __importDefault(require("node-fetch"));
async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0"
];
function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}
function getStealthHeaders(host) {
    const headers = {
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
    if (host)
        headers["Host"] = host;
    return headers;
}
async function fetchWithTimeoutAndRetry(url, options = {}) {
    const { timeoutMs = Number(process.env.HTTP_TIMEOUT_MS || 10000), retry = Number(process.env.HTTP_RETRY_COUNT || 2), retryDelayMs = Number(process.env.HTTP_RETRY_DELAY_MS || 500), ...rest } = options;
    let attempt = 0;
    while (true) {
        attempt++;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const headers = { ...getStealthHeaders(), ...rest.headers };
            const resp = await node_fetch_1.default(url, { ...rest, headers, body: rest?.body ?? undefined, signal: controller.signal });
            clearTimeout(timeout);
            if (resp.status === 403 || resp.status === 429) {
                throw new Error(`HTTP ${resp.status}`); // Trigger retry for bot detection
            }
            return resp;
        }
        catch (err) {
            clearTimeout(timeout);
            if (attempt > retry)
                throw err;
            // Exponential backoff
            await delay(retryDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100);
        }
    }
}
