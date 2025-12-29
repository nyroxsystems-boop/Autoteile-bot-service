"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const baseInventoryProvider_1 = __importDefault(require("./baseInventoryProvider"));
const providerTypes_1 = require("../providerTypes");
class HttpApiProvider extends baseInventoryProvider_1.default {
    constructor(connection) {
        super(connection);
        this.type = providerTypes_1.ProviderTypes.HTTP_API;
        this.baseUrl = connection.baseUrl || "";
        this.authConfig = connection.authConfig || {};
        this.config = connection.config || {};
    }
    createHttpClient() {
        const headers = {};
        const authType = this.authConfig?.authType;
        if (authType === "api_key_header") {
            const headerName = this.authConfig?.headerName || "X-API-Key";
            const apiKey = this.authConfig?.apiKey || "";
            if (apiKey)
                headers[headerName] = apiKey;
        }
        const axiosConfig = {
            baseURL: this.baseUrl,
            headers
        };
        if (authType === "basic" && this.authConfig?.username && this.authConfig?.password) {
            axiosConfig.auth = {
                username: this.authConfig.username,
                password: this.authConfig.password
            };
        }
        return axios_1.default.create(axiosConfig);
    }
    buildUrl(oemNumber) {
        const endpointTemplate = this.config?.oemEndpoint || "/inventory/by-oem/:oem";
        const style = this.config?.oemParamStyle || "path";
        const queryName = this.config?.oemQueryParamName || "oemNumber";
        if (style === "query") {
            const joiner = endpointTemplate.includes("?") ? "&" : "?";
            return `${endpointTemplate}${joiner}${encodeURIComponent(queryName)}=${encodeURIComponent(oemNumber)}`;
        }
        return endpointTemplate.replace(":oem", encodeURIComponent(oemNumber));
    }
    pickFirst(item, fields) {
        for (const f of fields) {
            if (!f)
                continue;
            if (item && Object.prototype.hasOwnProperty.call(item, f)) {
                return item[f];
            }
        }
        return undefined;
    }
    toNumber(value) {
        const n = typeof value === "string" ? Number(value) : value;
        return typeof n === "number" && !Number.isNaN(n) ? n : null;
    }
    async checkAvailabilityByOem(oemNumber) {
        try {
            const client = this.createHttpClient();
            const url = this.buildUrl(oemNumber);
            const response = await client.get(url);
            const data = response.data;
            const mapping = this.config?.responseMapping || {};
            const payload = Array.isArray(data?.results)
                ? data.results
                : Array.isArray(data)
                    ? data
                    : data
                        ? [data]
                        : [];
            return payload.map((item) => {
                const price = this.toNumber(this.pickFirst(item, [mapping.priceField, "price", "unitPrice", "amount"]));
                const availableQuantity = this.toNumber(this.pickFirst(item, [mapping.quantityField, "availableQuantity", "stock", "qty", "quantity"]));
                return {
                    systemId: this.id,
                    systemName: this.name,
                    providerType: this.type,
                    oemNumber: this.pickFirst(item, [mapping.oemField, "oemNumber", "oem", "partNumber"]) ?? oemNumber,
                    internalPartId: this.pickFirst(item, [mapping.internalPartIdField, "id", "partId"]) ?? null,
                    internalSku: this.pickFirst(item, [mapping.internalSkuField, "sku", "internalSku"]) ?? null,
                    title: this.pickFirst(item, [mapping.titleField, "title", "name", "description"]) ?? null,
                    brand: this.pickFirst(item, [mapping.brandField, "brand", "make"]) ?? null,
                    model: this.pickFirst(item, [mapping.modelField, "model"]) ?? null,
                    price,
                    currency: this.pickFirst(item, [mapping.currencyField, "currency"]) ?? null,
                    availableQuantity,
                    deliveryTime: this.pickFirst(item, [mapping.deliveryTimeField, "deliveryTime", "eta", "availability"]) ??
                        null,
                    sourceRaw: item
                };
            });
        }
        catch (error) {
            console.error("[HttpApiProvider] error", error?.message ?? error);
            return [];
        }
    }
}
exports.default = HttpApiProvider;
