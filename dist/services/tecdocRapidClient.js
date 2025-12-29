"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TecDocClient = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
function buildPath(template, params) {
    return template.replace(/{(\w+)}/g, (_, key) => {
        const value = params[key];
        if (value === undefined || value === null) {
            throw new Error(`Missing path param ${key} for template ${template}`);
        }
        return encodeURIComponent(String(value));
    });
}
class TecDocClient {
    constructor(config) {
        this.baseUrl = (config?.baseUrl || "https://tecdoc-catalog.p.rapidapi.com").replace(/\/+$/, "");
        this.apiKey = config?.apiKey || process.env.RAPIDAPI_KEY || "";
        this.apiHost = config?.apiHost || process.env.RAPIDAPI_HOST || "tecdoc-catalog.p.rapidapi.com";
        if (!this.apiKey) {
            throw new Error("TecDocClient requires RAPIDAPI_KEY (apiKey)");
        }
    }
    async request(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            Accept: "application/json",
            "x-rapidapi-key": this.apiKey,
            "x-rapidapi-host": this.apiHost,
            ...(options.headers || {})
        };
        const res = await (0, node_fetch_1.default)(url, { ...options, headers });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`TecDoc Rapid error ${res.status}: ${text}`);
        }
        return res.json();
    }
    async listModelsByTypeAndManufacturer(typeId, manufacturerId, langId, countryFilterId) {
        const path = buildPath("/models/list/type-id/{typeId}/manufacturer-id/{manufacturerId}/lang-id/{langId}/country-filter-id/{countryFilterId}", { typeId, manufacturerId, langId, countryFilterId });
        return this.request(path);
    }
    async getModelByType(typeId, modelId, langId, countryFilterId) {
        const path = buildPath("/models/type-id/{typeId}/model-id/{modelId}/lang-id/{langId}/country-filter-id/{countryFilterId}", { typeId, modelId, langId, countryFilterId });
        return this.request(path);
    }
    async searchCommodityGroupsByDescription(typeId, langId, searchText) {
        const path = buildPath("/category/search-for-the-commodity-group-tree-by-description/type-id/{typeId}/lang-id/{langId}/search-text/{searchText}", { typeId, langId, searchText });
        return this.request(path);
    }
    async searchAllEqualOemNo(langId, articleOemNo) {
        const path = buildPath("/articles-oem/search-all-equal-oem-no/lang-id/{langId}/article-oem-no/{articleOemNo}", { langId, articleOemNo });
        return this.request(path);
    }
    async selectOemPartsByVehicleAndDescription(typeId, vehicleId, langId, searchParam) {
        const path = buildPath("/articles-oem/selecting-oem-parts-vehicle-modification-description-product-group/type-id/{typeId}/vehicle-id/{vehicleId}/lang-id/{langId}/search-param/{searchParam}", { typeId, vehicleId, langId, searchParam });
        return this.request(path);
    }
    async searchPassengerCarByLtnNumber(langId, countryFilterId, ltnNumber, numberType) {
        const path = buildPath("/types/searching-the-passenger-car-by-ltn-number/lang-id/{langId}/country-filter-id/{countryFilterId}/ltn-number/{ltnNumber}/number-type/{numberType}", { langId, countryFilterId, ltnNumber, numberType });
        return this.request(path);
    }
    async listCategoriesForVehicle(typeId, vehicleId, langId, variant = 1) {
        const path = `/category/type-id/${typeId}/products-groups-variant-${variant}/${vehicleId}/lang-id/${langId}`;
        return this.request(path);
    }
    async listArticlesForVehicleCategory(typeId, vehicleId, categoryId, langId) {
        const path = `/articles/list/type-id/${typeId}/vehicle-id/${vehicleId}/category-id/${categoryId}/lang-id/${langId}`;
        return this.request(path);
    }
    async decodeVin(vin, variant = "v3") {
        const path = `/vin/decoder-${variant}/${encodeURIComponent(vin)}`;
        return this.request(path);
    }
}
exports.TecDocClient = TecDocClient;
// Usage example:
// const client = new TecDocClient();
// client
//   .listModelsByTypeAndManufacturer("1", "5", "4", "63")
//   .then((res) => console.log(res))
//   .catch((err) => console.error(err));
