"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTecdocActor = runTecdocActor;
exports.tecdocGetAllLanguages = tecdocGetAllLanguages;
exports.tecdocGetAllCountries = tecdocGetAllCountries;
exports.tecdocListVehicleTypes = tecdocListVehicleTypes;
exports.tecdocGetManufacturers = tecdocGetManufacturers;
exports.tecdocGetModels = tecdocGetModels;
exports.tecdocGetVehicleEngineTypes = tecdocGetVehicleEngineTypes;
exports.tecdocGetVehicleDetails = tecdocGetVehicleDetails;
exports.tecdocGetCategoryV3 = tecdocGetCategoryV3;
exports.tecdocGetArticlesList = tecdocGetArticlesList;
exports.tecdocGetArticleDetailsById = tecdocGetArticleDetailsById;
exports.tecdocSearchArticlesByNumber = tecdocSearchArticlesByNumber;
exports.tecdocSearchArticlesByNumberAndSupplier = tecdocSearchArticlesByNumberAndSupplier;
const node_fetch_1 = __importDefault(require("node-fetch"));
const ACTOR_BASE = process.env.APIFY_TECDOC_ACTOR_URL ||
    "https://api.apify.com/v2/acts/making-data-meaningful~tecdoc/run-sync-get-dataset-items";
function requireToken() {
    const token = process.env.APIFY_TECDOC_TOKEN;
    if (!token) {
        throw new Error("APIFY_TECDOC_TOKEN is required for TecDoc Actor calls");
    }
    return token;
}
async function httpPostJson(url, body) {
    const res = await (0, node_fetch_1.default)(url, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`TecDoc Actor HTTP ${res.status}: ${text}`);
    }
    return res.json();
}
async function runTecdocActor(input) {
    const token = requireToken();
    const url = `${ACTOR_BASE}?token=${encodeURIComponent(token)}`;
    const raw = await httpPostJson(url, input);
    const items = Array.isArray(raw) ? raw : raw?.items || raw?.data || [];
    return { items, raw };
}
// ------------------------
// Logical wrappers
// ------------------------
function tecdocGetAllLanguages() {
    return runTecdocActor({ endpoint: "/getAllLanguages" });
}
function tecdocGetAllCountries() {
    return runTecdocActor({ endpoint: "/getAllCountries" });
}
function tecdocListVehicleTypes() {
    return runTecdocActor({ endpoint: "/listVehicleTypes" });
}
function tecdocGetManufacturers(params) {
    return runTecdocActor({ endpoint: "/getManufacturers", ...params });
}
function tecdocGetModels(params) {
    return runTecdocActor({ endpoint: "/getModels", ...params });
}
function tecdocGetVehicleEngineTypes(params) {
    return runTecdocActor({ endpoint: "/getVehicleEngineTypes", ...params });
}
function tecdocGetVehicleDetails(params) {
    return runTecdocActor({ endpoint: "/getVehicleDetails", ...params });
}
function tecdocGetCategoryV3(params) {
    return runTecdocActor({ endpoint: "/getCategoryV3", ...params });
}
function tecdocGetArticlesList(params) {
    return runTecdocActor({ endpoint: "/getArticlesList", ...params });
}
function tecdocGetArticleDetailsById(params) {
    return runTecdocActor({ endpoint: "/getArticleDetailsById", ...params });
}
function tecdocSearchArticlesByNumber(params) {
    return runTecdocActor({ endpoint: "/searchArticlesByNumber", ...params });
}
function tecdocSearchArticlesByNumberAndSupplier(params) {
    return runTecdocActor({ endpoint: "/searchArticlesByNumberAndSupplier", ...params });
}
