"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const baseInventoryProvider_1 = __importDefault(require("./baseInventoryProvider"));
const providerTypes_1 = require("../providerTypes");
const SCRAPER_SERVICE_BASE_URL = process.env.SCRAPER_SERVICE_BASE_URL || "http://localhost:4100";
class ScraperProvider extends baseInventoryProvider_1.default {
    constructor(connection) {
        super(connection);
        this.type = providerTypes_1.ProviderTypes.SCRAPER;
    }
    async checkAvailabilityByOem(oemNumber) {
        const body = {
            oemNumber,
            connectionId: this.id,
            config: this.config
        };
        try {
            const res = await axios_1.default.post(`${SCRAPER_SERVICE_BASE_URL}/api/scrape/wws-inventory-by-oem`, body, { timeout: 30000 });
            if (!res.data?.ok) {
                console.error("[ScraperProvider] scraper-service returned error", res.data?.error);
                return [];
            }
            const items = res.data.items || [];
            return items.map((item) => ({
                systemId: this.id,
                systemName: this.name,
                providerType: this.type,
                oemNumber: item?.oemNumber || oemNumber,
                internalPartId: null,
                internalSku: null,
                title: item?.title ?? null,
                brand: item?.brand ?? null,
                model: item?.model ?? null,
                price: item?.price ?? null,
                currency: item?.currency ?? null,
                availableQuantity: item?.availableQuantity ?? null,
                deliveryTime: item?.deliveryTime ?? null,
                sourceRaw: item
            }));
        }
        catch (err) {
            console.error("[ScraperProvider] error", this.name, err?.message || err);
            return [];
        }
    }
}
exports.default = ScraperProvider;
