/**
 * 📱 Twilio Media Service
 * 
 * Handles downloading media from Twilio WhatsApp messages.
 * Extracted from botLogicService.ts for modularity.
 */
import fetch from "node-fetch";
import * as fs from "fs/promises";
import { fetchWithTimeoutAndRetry } from "@utils/httpClient";
import { logger } from "@utils/logger";

// ============================================================================
// CONFIGURATION
// ============================================================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const MEDIA_DOWNLOAD_TIMEOUT_MS = Number(process.env.MEDIA_DOWNLOAD_TIMEOUT_MS || 10000);
const MEDIA_DOWNLOAD_RETRY_COUNT = Number(process.env.MEDIA_DOWNLOAD_RETRY_COUNT || 2);

// ============================================================================
// MEDIA DOWNLOAD
// ============================================================================

/**
 * Download image from a generic URL
 */
export async function downloadImageBuffer(url: string): Promise<Buffer> {
    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(`Failed to download image: ${resp.status} ${resp.statusText}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Download media from Twilio with authentication
 * Also supports local dev/test via data: and file: URLs
 */
export async function downloadFromTwilio(mediaUrl: string): Promise<Buffer> {
    // Allow local dev/test without Twilio by accepting data: and file: URLs
    if (mediaUrl.startsWith("data:")) {
        const base64 = mediaUrl.substring(mediaUrl.indexOf(",") + 1);
        return Buffer.from(base64, "base64");
    }

    if (mediaUrl.startsWith("file:")) {
        const filePath = mediaUrl.replace("file://", "");
        return fs.readFile(filePath);
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        throw new Error("Missing Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
    }

    const authHeader = "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

    try {
        const res = await fetchWithTimeoutAndRetry(mediaUrl, {
            headers: {
                Authorization: authHeader
            },
            timeoutMs: MEDIA_DOWNLOAD_TIMEOUT_MS,
            retry: MEDIA_DOWNLOAD_RETRY_COUNT
        });

        if (!res.ok) {
            throw new Error(`Failed to download image: ${res.status} ${res.statusText}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (err: any) {
        logger.error("[Twilio] Media download failed", {
            error: err?.message,
            mediaUrl: mediaUrl.substring(0, 50) + "..."
        });
        throw err;
    }
}

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Check if URL is a valid Twilio media URL
 */
export function isTwilioMediaUrl(url: string): boolean {
    return url.includes("api.twilio.com") || url.includes("media.twiliocdn.com");
}

/**
 * Check if URL is a local test URL
 */
export function isLocalTestUrl(url: string): boolean {
    return url.startsWith("data:") || url.startsWith("file:");
}

/**
 * Get media type from URL or content
 */
export function getMediaType(url: string): "image" | "document" | "unknown" {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes("image") ||
        lowerUrl.endsWith(".jpg") ||
        lowerUrl.endsWith(".jpeg") ||
        lowerUrl.endsWith(".png") ||
        lowerUrl.endsWith(".webp")) {
        return "image";
    }

    if (lowerUrl.endsWith(".pdf")) {
        return "document";
    }

    return "unknown";
}
