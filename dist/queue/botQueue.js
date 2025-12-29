"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.botQueue = exports.BOT_QUEUE_NAME = void 0;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
exports.BOT_QUEUE_NAME = "bot-message-queue";
exports.botQueue = new bullmq_1.Queue(exports.BOT_QUEUE_NAME, {
    connection: connection_1.connection
});
