type LogLevel = "debug" | "info" | "warn" | "error";

type Meta = Record<string, unknown> | Error | undefined;

/**
 * Structured logger with component tagging.
 *
 * Usage:
 *   logger.info({ component: "DashboardAPI", orderId }, "Fetched order");
 *   logger.error({ component: "Webhook", error }, "Failed to handle message");
 */
function log(
  level: LogLevel,
  metaOrMessage: Meta | string,
  maybeMessage?: string | Meta,
  maybeMeta?: Meta
) {
  const message =
    typeof metaOrMessage === "string"
      ? typeof maybeMessage === "string"
        ? maybeMessage
        : metaOrMessage
      : typeof maybeMessage === "string"
      ? maybeMessage
      : "";

  const meta =
    typeof metaOrMessage === "string"
      ? typeof maybeMessage === "string"
        ? maybeMeta
        : (maybeMessage as Meta)
      : metaOrMessage;

  const payload = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...(meta ? { meta: serializeMeta(meta) } : {})
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

function serializeMeta(meta: Meta) {
  if (!meta) return undefined;
  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      stack: meta.stack
    };
  }
  try {
    // Deep-clone and redact potential PII from string values
    const cloned = JSON.parse(JSON.stringify(meta));
  const redactString = (s: string): string => {
      if (!s || typeof s !== "string") return s;
      // VIN (17 chars, exclude I,O,Q)
      const vinRegex = /\b([A-HJ-NPR-Z0-9]{17})\b/g;
      // Simple phone number-ish patterns
      const phoneRegex = /\b(\+?\d[\d\s\-()]{6,}\d)\b/g;
      // Email
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

      return s.replace(vinRegex, "[REDACTED_VIN]").replace(phoneRegex, "[REDACTED_PHONE]").replace(emailRegex, "[REDACTED_EMAIL]");
    };

  const walk = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === "string") return redactString(obj);
      if (Array.isArray(obj)) return obj.map(walk);
      if (typeof obj === "object") {
        const out: any = {};
        for (const k of Object.keys(obj)) {
          out[k] = walk(obj[k]);
        }
        return out;
      }
      return obj;
    };

    return walk(cloned);
  } catch (e) {
    // If cloning fails, return original meta to avoid hiding errors
    return meta;
  }
}

export const logger = {
  debug: (metaOrMessage: Meta | string, message?: string | Meta, meta?: Meta) =>
    log("debug", metaOrMessage, message, meta),
  info: (metaOrMessage: Meta | string, message?: string | Meta, meta?: Meta) =>
    log("info", metaOrMessage, message, meta),
  warn: (metaOrMessage: Meta | string, message?: string | Meta, meta?: Meta) =>
    log("warn", metaOrMessage, message, meta),
  error: (metaOrMessage: Meta | string, message?: string | Meta, meta?: Meta) =>
    log("error", metaOrMessage, message, meta)
};
