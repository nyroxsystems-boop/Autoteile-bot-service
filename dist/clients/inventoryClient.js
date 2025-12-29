"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchInventoryByOem = fetchInventoryByOem;
const axios_1 = __importDefault(require("axios"));
const inventoryConfig_1 = require("../config/inventoryConfig");
async function fetchInventoryByOem(oemNumber) {
    const url = `${inventoryConfig_1.BOT_SERVICE_BASE_URL}/api/bot/inventory/by-oem/${encodeURIComponent(oemNumber)}`;
    try {
        const res = await axios_1.default.get(url);
        return res.data;
    }
    catch (error) {
        console.error("[inventoryClient] fetchInventoryByOem error", error?.message || error);
        throw new Error("Inventar konnte nicht geladen werden.");
    }
}
