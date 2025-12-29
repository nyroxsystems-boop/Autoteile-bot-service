"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = Number(process.env.REDIS_PORT || 6379);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
// Use REDIS_URL if available (Render style), otherwise fallback to host/port
exports.connection = redisUrl
    ? new ioredis_1.default(redisUrl, { maxRetriesPerRequest: null })
    : new ioredis_1.default({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        maxRetriesPerRequest: null
    });
