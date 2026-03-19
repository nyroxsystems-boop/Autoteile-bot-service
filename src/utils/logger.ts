type LogLevel = "debug" | "info" | "warn" | "error";

type Meta = Record<string, unknown> | Error | unknown;

// Log level hierarchy: debug < info < warn < error
const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

/**
 * Structured logger with component tagging, PII redaction, and level filtering.
 *
 * Environment:
 *   LOG_LEVEL=debug|info|warn|error (default: 'info' in production, 'debug' in dev)
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
  // Skip logs below configured level
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;

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

  // Use appropriate console method for log level
  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  // eslint-disable-next-line no-console
  consoleFn(JSON.stringify(payload));
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
