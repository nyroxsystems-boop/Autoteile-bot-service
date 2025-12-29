"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const baseInventoryProvider_1 = __importDefault(require("./baseInventoryProvider"));
const providerTypes_1 = require("../providerTypes");
class DemoWwsProvider extends baseInventoryProvider_1.default {
    constructor(connection) {
        super(connection);
        this.type = providerTypes_1.ProviderTypes.DEMO_WWS;
        this.baseUrl = connection.baseUrl || "http://localhost:4000";
    }
    async checkAvailabilityByOem(oemNumber) {
        const target = `${this.baseUrl}/api/inventory/by-oem/${encodeURIComponent(oemNumber)}`;
        try {
            const response = await axios_1.default.get(target);
            const data = response.data || {};
            const items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
            return items.map((item) => {
                const raw = item?.raw ?? item;
                return {
                    systemId: this.id,
                    systemName: this.name,
                    providerType: this.type,
                    oemNumber: item?.oemNumber || data?.oemNumber || oemNumber,
                    internalPartId: item?.partId ?? raw?.id ?? null,
                    internalSku: item?.internalSku ?? raw?.internalSku ?? null,
                    title: item?.title ?? raw?.title ?? null,
                    brand: item?.brand ?? raw?.brand ?? null,
                    model: item?.model ?? raw?.model ?? null,
                    price: typeof item?.price === "number" ? item.price : raw?.price ?? null,
                    currency: item?.currency ?? raw?.currency ?? null,
                    availableQuantity: typeof item?.availableQuantity === "number"
                        ? item.availableQuantity
                        : typeof raw?.availableQuantity === "number"
                            ? raw.availableQuantity
                            : null,
                    deliveryTime: item?.deliveryTime ?? raw?.deliveryTime ?? null,
                    sourceRaw: item
                };
            });
        }
        catch (error) {
            console.error("[DemoWwsProvider] error", error?.message ?? error);
            return [];
        }
    }
}
exports.default = DemoWwsProvider;
