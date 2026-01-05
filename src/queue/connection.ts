import IORedis from "ioredis";
import { logger } from "../utils/logger";

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = Number(process.env.REDIS_PORT || 6379);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

let connection: IORedis | null = null;

try {
  // Use REDIS_URL if available (Render style), otherwise fallback to host/port
  connection = redisUrl
    ? new IORedis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true })
    : new IORedis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: null,
      lazyConnect: true
    });

  connection.on('error', (err) => {
    logger.warn(`Redis connection error: ${err.message}. Queue features disabled.`);
  });

  // Test connection
  connection.connect().catch((err) => {
    logger.warn(`Redis not available: ${err.message}. Queue features will be disabled.`);
    connection = null;
  });
} catch (err: any) {
  logger.warn(`Failed to initialize Redis: ${err.message}. Queue features disabled.`);
  connection = null;
}

export { connection };
