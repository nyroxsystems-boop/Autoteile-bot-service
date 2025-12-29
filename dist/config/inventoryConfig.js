"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOT_SERVICE_BASE_URL = void 0;
exports.BOT_SERVICE_BASE_URL = process.env.BOT_SERVICE_BASE_URL || "http://localhost:5000";
// Hinweis: Im Deployment BOT_SERVICE_BASE_URL in der Umgebung setzen,
// damit der Inventory-Orchestrator des bot-service korrekt angesprochen wird.
