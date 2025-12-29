"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tecdocApi = void 0;
exports.findBestManufacturer = findBestManufacturer;
exports.findBestModel = findBestModel;
exports.findBestEngine = findBestEngine;
exports.findCategoryByName = findCategoryByName;
exports.getDefaultTecDocClient = getDefaultTecDocClient;
const httpClient_1 = require("../utils/httpClient");
const TECDOC_BASE_URL = (process.env.TECDOC_BASE_URL || "").replace(/\/+$/, "");
const TECDOC_API_TOKEN = process.env.TECDOC_API_TOKEN || process.env.TECDOC_API_KEY || "";
if (!TECDOC_BASE_URL) {
    // eslint-disable-next-line no-console
    console.warn("TECDOC_BASE_URL is not set. TecDoc calls will fail until configured.");
}
async function callTecDoc(path, body) {
    if (!TECDOC_BASE_URL || !TECDOC_API_TOKEN) {
        throw new Error("TecDoc API not configured (TECDOC_BASE_URL / TECDOC_API_TOKEN missing)");
    }
    const url = `${TECDOC_BASE_URL}${path}`;
    const resp = await (0, httpClient_1.fetchWithTimeoutAndRetry)(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TECDOC_API_TOKEN}`
        },
        body: JSON.stringify(body),
        timeoutMs: Number(process.env.TECDOC_TIMEOUT_MS || 10000),
        retry: Number(process.env.TECDOC_RETRY_COUNT || 2)
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`TecDoc API error: ${resp.status} ${resp.statusText} - ${text}`);
    }
    return resp.json();
}
exports.tecdocApi = {
    getAllLanguages(params = {}) {
        return callTecDoc("/getAllLanguages", params);
    },
    getAllCountries(params = {}) {
        return callTecDoc("/getAllCountries", params);
    },
    listVehicleTypes(params) {
        return callTecDoc("/listVehicleTypes", params);
    },
    getManufacturers(params) {
        return callTecDoc("/getManufacturers", params);
    },
    getModels(params) {
        return callTecDoc("/getModels", params);
    },
    getVehicleEngineTypes(params) {
        return callTecDoc("/getVehicleEngineTypes", params);
    },
    getVehicleDetails(params) {
        return callTecDoc("/getVehicleDetails", params);
    },
    getCategoryV3(params) {
        return callTecDoc("/getCategoryV3", params);
    },
    getArticlesList(params) {
        return callTecDoc("/getArticlesList", params);
    },
    getArticleDetailsById(params) {
        return callTecDoc("/getArticleDetailsById", params);
    },
    searchArticlesByNumber(params) {
        return callTecDoc("/searchArticlesByNumber", params);
    },
    searchArticlesByNumberAndSupplier(params) {
        return callTecDoc("/searchArticlesByNumberAndSupplier", params);
    },
    getVehicleByVin(params) {
        return callTecDoc("/getVehicleByVin", params);
    }
};
function normalize(str) {
    return (str || "").toString().toLowerCase().trim();
}
function scoreIncludes(haystack, needle) {
    if (!haystack || !needle)
        return 0;
    return haystack.includes(needle) ? needle.length : 0;
}
function findBestManufacturer(make, list) {
    if (!make)
        return null;
    const needle = normalize(make);
    let best = null;
    let bestScore = 0;
    for (const m of list) {
        const name = normalize(m.name || m.mfrName || m.text);
        const s = scoreIncludes(name, needle);
        if (s > bestScore) {
            best = m;
            bestScore = s;
        }
    }
    return best;
}
function findBestModel(model, year, list) {
    const needle = normalize(model);
    let best = null;
    let bestScore = 0;
    for (const m of list) {
        const name = normalize(m.name || m.modelname);
        let s = needle ? scoreIncludes(name, needle) : 0;
        const from = m.yearFrom ?? m.yearOfConstrFrom;
        const to = m.yearTo ?? m.yearOfConstrTo;
        if (year && from && to && year >= from && year <= to) {
            s += 2; // small bonus for matching year range
        }
        if (s > bestScore) {
            best = m;
            bestScore = s;
        }
    }
    return best;
}
function findBestEngine(engine, year, list) {
    const needle = normalize(engine);
    let best = null;
    let bestScore = 0;
    for (const e of list) {
        const name = normalize(e.engineName || e.engineCode || e.engine);
        let s = needle ? scoreIncludes(name, needle) : 0;
        const from = e.yearFrom ?? e.yearOfConstrFrom;
        const to = e.yearTo ?? e.yearOfConstrTo;
        if (year && from && to && year >= from && year <= to) {
            s += 2;
        }
        if (s > bestScore) {
            best = e;
            bestScore = s;
        }
    }
    return best;
}
function findCategoryByName(partName, list) {
    if (!partName)
        return null;
    const needle = normalize(partName);
    let best = null;
    let bestScore = 0;
    for (const c of list) {
        const name = normalize(c.productGroupName || c.assemblyGroupName || c.name || c.text);
        const s = scoreIncludes(name, needle);
        if (s > bestScore) {
            best = c;
            bestScore = s;
        }
    }
    return best;
}
function getDefaultTecDocClient() {
    return exports.tecdocApi;
}
