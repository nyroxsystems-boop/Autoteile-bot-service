"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeVin = decodeVin;
exports.fetchBuildsheet = fetchBuildsheet;
exports.extractOemHintsFromBuildsheetCodes = extractOemHintsFromBuildsheetCodes;
exports.normalizeVehicleData = normalizeVehicleData;
exports.enrichVehicleForOemSearch = enrichVehicleForOemSearch;
const node_fetch_1 = __importDefault(require("node-fetch"));
const DEFAULT_BASE_URL = process.env.VEHICLEDATABASES_BASE_URL || "https://api.vehicledatabases.com";
async function httpGet(url, headers) {
    const res = await (0, node_fetch_1.default)(url, { method: "GET", headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
}
async function decodeVin(baseUrl, apiKey, vin) {
    const url = `${baseUrl.replace(/\/+$/, "")}/vin-decode/${encodeURIComponent(vin)}`;
    return httpGet(url, {
        Accept: "application/json",
        "x-AuthKey": apiKey
    });
}
async function fetchBuildsheet(baseUrl, apiKey, vin) {
    const url = `${baseUrl.replace(/\/+$/, "")}/buildsheet/${encodeURIComponent(vin)}`;
    return httpGet(url, {
        Accept: "application/json",
        "x-AuthKey": apiKey
    });
}
function parseNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
}
function extractEngineCode(engineDescription) {
    if (!engineDescription)
        return null;
    const token = engineDescription.split(/[ +]/)[0];
    return token || null;
}
function extractOemHintsFromBuildsheetCodes(codes) {
    if (!codes)
        return [];
    return Object.values(codes)
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter((v) => !!v);
}
function normalizeVehicleData(vinData, buildsheetData) {
    const basic = vinData?.data?.basic || {};
    const engine = vinData?.data?.engine || {};
    const fuel = vinData?.data?.fuel || {};
    const drivetrain = vinData?.data?.drivetrain || {};
    const buildsheetCodes = buildsheetData?.data?.codes || {};
    const oemHints = extractOemHintsFromBuildsheetCodes(buildsheetCodes);
    const engineCapacityRaw = engine?.engine_capacity ?? (engine?.engine_size ? Number(engine.engine_size) * 1000 : null);
    return {
        make: basic.make ?? null,
        model: basic.model ?? null,
        year: parseNumber(basic.year),
        trim: basic.trim ?? null,
        bodyType: basic.body_type ?? null,
        vehicleType: basic.vehicle_type ?? null,
        doors: parseNumber(basic.doors),
        seatingCapacity: parseNumber(basic.seating_capacity),
        engineCode: extractEngineCode(engine?.engine_description),
        engineCapacityCcm: parseNumber(engineCapacityRaw),
        engineDescription: engine?.engine_description ?? null,
        cylinders: parseNumber(engine?.cylinders),
        fuelType: fuel?.fuel_type ?? null,
        driveType: drivetrain?.drive_type ?? null,
        oemHints
    };
}
async function enrichVehicleForOemSearch(options) {
    const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    const apiKey = options.apiKey;
    const errors = [];
    let vinDecodeRaw = null;
    let buildsheetRaw = null;
    let vinDecodeStatus = "error";
    let buildsheetStatus = "skipped";
    // VIN decode
    try {
        vinDecodeRaw = await decodeVin(baseUrl, apiKey, options.vin);
        vinDecodeStatus = vinDecodeRaw?.status === "success" ? "success" : "error";
        if (vinDecodeStatus === "error") {
            errors.push(`vin-decode returned status ${vinDecodeRaw?.status || "unknown"}`);
        }
    }
    catch (err) {
        errors.push(`vin-decode failed: ${err?.message || err}`);
        vinDecodeStatus = "error";
    }
    // Buildsheet (best effort)
    try {
        buildsheetRaw = await fetchBuildsheet(baseUrl, apiKey, options.vin);
        buildsheetStatus = buildsheetRaw?.status === "success" ? "success" : "error";
        if (buildsheetStatus === "error") {
            errors.push(`buildsheet returned status ${buildsheetRaw?.status || "unknown"}`);
        }
    }
    catch (err) {
        errors.push(`buildsheet failed: ${err?.message || err}`);
        buildsheetStatus = "error";
    }
    const vehicleNormalized = normalizeVehicleData(vinDecodeStatus === "success" ? vinDecodeRaw : null, buildsheetStatus === "success" ? buildsheetRaw : null);
    const suspectedOemNumbers = [];
    if (options.suspectedArticleNumber) {
        const cleaned = options.suspectedArticleNumber.trim().toUpperCase();
        if (cleaned)
            suspectedOemNumbers.push(cleaned);
    }
    return {
        vin: options.vin,
        vinDecodeRaw,
        buildsheetRaw,
        vehicleNormalized,
        suspectedOemNumbers,
        meta: {
            vinDecodeStatus,
            buildsheetStatus,
            errors
        }
    };
}
