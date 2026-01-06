"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = Number(process.env.REDIS_PORT || 6379);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
let connection = null;
exports.connection = connection;
try {
    // Use REDIS_URL if available (Render style), otherwise fallback to host/port
    exports.connection = connection = redisUrl
        ? new ioredis_1.default(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true })
        : new ioredis_1.default({
            host: redisHost,
            port: redisPort,
            password: redisPassword,
            maxRetriesPerRequest: null,
            lazyConnect: true
        });
    connection.on('error', (err) => {
        logger_1.logger.warn(`Redis connection error: ${err.message}. Queue features disabled.`);
    });
    // Test connection
    connection.connect().catch((err) => {
        logger_1.logger.warn(`Redis not available: ${err.message}. Queue features will be disabled.`);
        exports.connection = connection = null;
    });
}
catch (err) {
    logger_1.logger.warn(`Failed to initialize Redis: ${err.message}. Queue features disabled.`);
    exports.connection = connection = null;
}
