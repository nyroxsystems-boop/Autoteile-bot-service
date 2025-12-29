"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTecdocAndPartSouq = resolveTecdocAndPartSouq;
const tecdocClient_1 = require("../tecdocClient");
const httpClient_1 = require("../../utils/httpClient");
const MANUFACTURER_ID_MAP = {
    bmw: 63,
    vw: 2068,
    volkswagen: 2068,
    audi: 2031,
    mercedes: 2026,
    mercedesbenz: 2026,
    mercedes_benz: 2026,
    opel: 2153
};
function normalizeOem(oem) {
    if (!oem)
        return "";
    return oem.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function pickBestLangId(langs, preferred = "de") {
    const list = langs || [];
    const german = list.find((l) => /german|deutsch/i.test(l?.name || "") || String(l?.langId || l?.lngId) === "10");
    const english = list.find((l) => /english|englisch/i.test(l?.name || "") || String(l?.langId || l?.lngId) === "4");
    if (preferred === "de" && german?.langId)
        return german.langId;
    if (preferred === "en" && english?.langId)
        return english.langId;
    return german?.langId || english?.langId || 4;
}
function pickBestCountryId(countries, countryCode) {
    const list = countries || [];
    const code = (countryCode || "DE").toUpperCase();
    const match = list.find((c) => (c?.countryCode || "").toUpperCase() === code) ||
        list.find((c) => (c?.name || c?.countryName || "").toUpperCase().includes(code));
    const germany = list.find((c) => /germany|deutschland/i.test(c?.name || c?.countryName || "")) ||
        list.find((c) => String(c?.countryId || c?.countryFilterId) === "62");
    return match?.countryFilterId || match?.countryId || germany?.countryFilterId || germany?.countryId || 62;
}
function pickTypeId(types) {
    const list = types || [];
    const passenger = list.find((t) => /pkw|passenger|car/i.test(t?.name || t?.typeName || ""));
    const id = passenger?.typeId || passenger?.id || passenger?.vehicleTypeId || passenger?.value || list?.[0]?.typeId || list?.[0]?.id;
    return id || 1;
}
function mapCategories(resp) {
    return resp?.data || resp?.genericArticles || resp?.assemblyGroups || resp?.categories || [];
}
function mapArticles(resp) {
    return (resp?.data ||
        resp?.articles ||
        resp?.article ||
        resp?.results ||
        resp?.articleDirectSearchResults ||
        []);
}
function mapVehicles(resp) {
    return resp?.data || resp?.vehicles || resp?.types || resp?.results || resp || [];
}
function scoreCategoryMatch(part, category) {
    const base = (category.productGroupName || category.assemblyGroupName || category.name || category.text || "").toLowerCase();
    const partText = (part.part_name || "").toLowerCase();
    let score = 0;
    if (base.includes(partText) || partText.includes(base))
        score += 2;
    const keyWords = {
        brake: ["bremse", "brems", "brake"],
        pad: ["belag", "pad", "pad kit"],
        disc: ["scheibe", "disc"],
        filter: ["filter", "ölfilter", "luftfilter", "oil filter", "air filter"],
        suspension: ["lenker", "querlenker", "control arm", "suspension", "stabilizer", "koppel"],
        spark: ["zündkerze", "spark"]
    };
    Object.values(keyWords).forEach((words) => {
        if (words.some((w) => partText.includes(w) && base.includes(w)))
            score += 1.2;
    });
    const axle = (part.axle || part.position || "").toLowerCase();
    if (axle.includes("front") && /front|vorder/i.test(base))
        score += 0.5;
    if (axle.includes("rear") && /rear|hinter/i.test(base))
        score += 0.5;
    const side = (part.side || "").toLowerCase();
    if (side && base.includes(side))
        score += 0.3;
    return score;
}
function pickBestCategory(part, categories) {
    let best = null;
    let bestScore = 0;
    for (const cat of categories) {
        const score = scoreCategoryMatch(part, cat);
        if (score > bestScore) {
            bestScore = score;
            best = cat;
        }
    }
    return best;
}
function collectOemsFromArticle(article, articleDetails) {
    const out = new Set();
    const possible = [
        article?.articleNo,
        article?.articleNumber,
        article?.data?.articleNo,
        ...(article?.oeNumbers || []).map((o) => o?.oeNumber),
        ...(articleDetails?.oeNumbers || []).map((o) => o?.oeNumber),
        ...(Array.isArray(articleDetails?.data) ? articleDetails.data.flatMap((x) => x?.oeNumbers || []).map((o) => o?.oeNumber) : []),
        ...(Array.isArray(articleDetails?.data) ? articleDetails.data.map((x) => x?.articleNo) : [])
    ].filter(Boolean);
    for (const p of possible) {
        const norm = normalizeOem(String(p));
        if (norm)
            out.add(norm);
    }
    return Array.from(out);
}
async function fetchArticleDetails(articleId, langId, countryFilterId) {
    if (!articleId)
        return null;
    try {
        return await tecdocClient_1.tecdocApi.getArticleDetailsById({ langId, countryFilterId, articleId });
    }
    catch {
        return null;
    }
}
async function fetchPartsouqCandidates(queries) {
    const out = [];
    for (const query of queries) {
        if (!query)
            continue;
        try {
            const url = `https://partsouq.com/en/search/all?q=${encodeURIComponent(query)}`;
            const resp = await (0, httpClient_1.fetchWithTimeoutAndRetry)(url, { method: "GET", timeoutMs: 8000, retry: 1 });
            if (!resp.ok)
                continue;
            const text = await resp.text();
            const regex = /OEM[:\s]*([A-Z0-9\-\.\s]{5,})/gi;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const raw = match[1]?.trim();
                const norm = normalizeOem(raw);
                if (!norm)
                    continue;
                if (out.some((c) => normalizeOem(c.oem) === norm))
                    continue;
                out.push({
                    oem: norm,
                    manufacturer: null,
                    description: `partsouq: ${query}`,
                    score: 0.5
                });
            }
            // fallback: generic alphanumeric tokens
            const tokenRegex = /\b([A-Z0-9][A-Z0-9\-\.\s]{6,})\b/g;
            while ((match = tokenRegex.exec(text)) !== null && out.length < 8) {
                const raw = match[1]?.trim();
                const norm = normalizeOem(raw);
                if (!norm)
                    continue;
                if (out.some((c) => normalizeOem(c.oem) === norm))
                    continue;
                out.push({
                    oem: norm,
                    manufacturer: null,
                    description: `partsouq: ${query}`,
                    score: 0.35
                });
            }
            if (out.length >= 5)
                break;
        }
        catch {
            // ignore and continue with next query
        }
    }
    return out;
}
async function resolveBaseParams(language, countryCode) {
    const langsResp = await tecdocClient_1.tecdocApi.getAllLanguages();
    const langs = langsResp?.data || langsResp?.languages || langsResp || [];
    const langId = pickBestLangId(langs, language === "en" ? "en" : "de");
    const countriesResp = await tecdocClient_1.tecdocApi.getAllCountries({ langId });
    const countries = countriesResp?.data || countriesResp?.countries || countriesResp || [];
    const countryFilterId = pickBestCountryId(countries, countryCode);
    // RapidAPI catalog sometimes lacks listVehicleTypes; default to PKW = 1
    const typeId = 1;
    return { langId, countryFilterId, typeId };
}
async function identifyVehicle(vehicle, base) {
    const selection = {
        ...base,
        manufacturerId: null,
        modelSeriesId: null,
        vehicleId: null,
        manufacturerName: null,
        modelName: null,
        engineMatch: null
    };
    // Try direct VIN lookup if available
    if (vehicle.vin) {
        try {
            const vinResp = await tecdocClient_1.tecdocApi.getVehicleByVIN({
                vin: vehicle.vin,
                countryFilterId: base.countryFilterId,
                langId: base.langId,
                typeId: base.typeId
            });
            const vinVehicles = mapVehicles(vinResp);
            const vinFirst = vinVehicles[0];
            const manuId = vinFirst?.manufacturerId ?? vinFirst?.manuId ?? vinFirst?.mfrId ?? vinFirst?.makeId ?? vinFirst?.manufacturer?.id ?? null;
            const vehId = vinFirst?.vehicleId ?? vinFirst?.id ?? vinFirst?.typeId ?? null;
            if (manuId && vehId) {
                return {
                    ...base,
                    manufacturerId: manuId,
                    manufacturerName: vinFirst?.manufacturerName || vinFirst?.makeName || null,
                    modelSeriesId: vinFirst?.modelSeriesId ?? vinFirst?.modelId ?? null,
                    modelName: vinFirst?.modelName ?? vinFirst?.model ?? null,
                    vehicleId: vehId,
                    engineMatch: null
                };
            }
        }
        catch {
            // ignore and continue
        }
    }
    if (vehicle.hsn && vehicle.tsn) {
        try {
            const kbaResp = await tecdocClient_1.tecdocApi.getVehicleByKba({
                hsn: vehicle.hsn,
                tsn: vehicle.tsn,
                countryFilterId: base.countryFilterId,
                langId: base.langId,
                typeId: base.typeId
            });
            const kbaVehicles = mapVehicles(kbaResp);
            const kbaFirst = kbaVehicles[0];
            const manuId = kbaFirst?.manufacturerId ?? kbaFirst?.manuId ?? kbaFirst?.mfrId ?? kbaFirst?.makeId ?? kbaFirst?.manufacturer?.id ?? null;
            const vehId = kbaFirst?.vehicleId ?? kbaFirst?.id ?? kbaFirst?.typeId ?? null;
            if (manuId && vehId) {
                return {
                    ...base,
                    manufacturerId: manuId,
                    manufacturerName: kbaFirst?.manufacturerName || kbaFirst?.makeName || null,
                    modelSeriesId: kbaFirst?.modelSeriesId ?? kbaFirst?.modelId ?? null,
                    modelName: kbaFirst?.modelName ?? kbaFirst?.model ?? null,
                    vehicleId: vehId,
                    engineMatch: null
                };
            }
        }
        catch {
            // ignore and continue
        }
    }
    // Manufacturer
    let manu = null;
    try {
        const manuResp = await tecdocClient_1.tecdocApi.getManufacturers({
            typeId: base.typeId,
            langId: base.langId,
            countryFilterId: base.countryFilterId
        });
        const manuList = manuResp?.data || manuResp?.manufacturers || [];
        manu = (0, tecdocClient_1.findBestManufacturer)(vehicle.make || "", manuList);
    }
    catch {
        // ignore, fallback to static map
    }
    selection.manufacturerId = manu?.manuId ?? manu?.manufacturerId ?? null;
    selection.manufacturerName = manu?.mfrName || manu?.name || null;
    if (!selection.manufacturerId && vehicle.make) {
        const key = vehicle.make.toLowerCase().replace(/\s+/g, "");
        selection.manufacturerId = MANUFACTURER_ID_MAP[key] ?? null;
    }
    // Model
    if (selection.manufacturerId) {
        const modelsResp = await tecdocClient_1.tecdocApi.getModels({
            typeId: base.typeId,
            langId: base.langId,
            countryFilterId: base.countryFilterId,
            manufacturerId: selection.manufacturerId
        });
        const models = modelsResp?.data || modelsResp?.modelSeries || modelsResp?.models || [];
        const model = (0, tecdocClient_1.findBestModel)(vehicle.model || "", vehicle.year ?? undefined, models);
        selection.modelSeriesId = model?.modelSeriesId ?? model?.modelId ?? null;
        selection.modelName = model?.name || model?.modelname || null;
        if (selection.modelSeriesId) {
            const enginesResp = await tecdocClient_1.tecdocApi.getVehicleEngineTypes({
                typeId: base.typeId,
                langId: base.langId,
                countryFilterId: base.countryFilterId,
                manufacturerId: selection.manufacturerId,
                modelSeriesId: selection.modelSeriesId
            });
            const engines = enginesResp?.data || enginesResp?.vehicles || enginesResp?.engineTypes || [];
            const engineMatch = (0, tecdocClient_1.findBestEngine)(vehicle.engineCode || null, vehicle.year ?? null, vehicle.kw ?? null, engines);
            selection.engineMatch = engineMatch ?? undefined;
            selection.vehicleId = engineMatch?.vehicleId ?? null;
        }
    }
    return selection;
}
function deriveCategoryId(category) {
    if (!category)
        return null;
    return (category.categoryId ??
        category.genericArticleId ??
        category.levelId_3 ??
        category.levelId_2 ??
        category.levelId_1 ??
        null);
}
async function pickCategory(part, base) {
    const resp = (await tecdocClient_1.tecdocApi.getCategoryV3({
        typeId: base.typeId,
        langId: base.langId,
        countryFilterId: base.countryFilterId,
        manufacturerId: base.manufacturerId ?? undefined,
        vehicleId: base.vehicleId ?? undefined
    })) || {};
    let categories = mapCategories(resp);
    if (!categories?.length) {
        const resp2 = await tecdocClient_1.tecdocApi.getCategoryV2({
            typeId: base.typeId,
            langId: base.langId,
            countryFilterId: base.countryFilterId,
            manufacturerId: base.manufacturerId ?? undefined,
            vehicleId: base.vehicleId ?? undefined
        });
        categories = mapCategories(resp2);
    }
    const category = pickBestCategory(part, categories);
    return { category, categories };
}
async function fetchTecdocCandidates(base, category, part) {
    const out = [];
    const productGroupId = deriveCategoryId(category);
    if (!productGroupId && !part.suspected_article_number) {
        return out;
    }
    const params = {
        typeId: base.typeId,
        langId: base.langId,
        countryFilterId: base.countryFilterId,
        manufacturerId: base.manufacturerId ?? undefined,
        vehicleId: base.vehicleId ?? undefined,
        productGroupId: productGroupId ?? undefined
    };
    if (productGroupId) {
        try {
            const artResp = await tecdocClient_1.tecdocApi.getArticlesList(params);
            const articles = mapArticles(artResp);
            const limited = articles.slice(0, 10);
            for (const a of limited) {
                const details = await fetchArticleDetails(a.articleId ?? a.id, base.langId, base.countryFilterId);
                const oems = collectOemsFromArticle(a, details);
                for (const oem of oems) {
                    if (!oem)
                        continue;
                    const score = Math.min(1, 0.6 + (productGroupId ? 0.1 : 0) + (base.vehicleId ? 0.1 : 0));
                    if (out.some((c) => normalizeOem(c.oem) === oem))
                        continue;
                    out.push({
                        oem,
                        articleId: (a.articleId ?? a.id ?? null)?.toString?.() ?? null,
                        manufacturer: a.brandName ?? a.mfrName ?? null,
                        description: a.genericArticleDescription ?? a.articleName ?? null,
                        score
                    });
                }
            }
        }
        catch {
            // ignore if TecDoc RapidAPI does not support product-group article lists
        }
    }
    // direct search via suspected article number
    if (part.suspected_article_number) {
        try {
            const searchResp = await tecdocClient_1.tecdocApi.searchArticlesByNumber({
                langId: base.langId,
                articleSearchNr: part.suspected_article_number
            });
            const searchArticles = mapArticles(searchResp);
            for (const sa of searchArticles.slice(0, 5)) {
                const details = await fetchArticleDetails(sa.articleId ?? sa.id, base.langId, base.countryFilterId);
                const oems = collectOemsFromArticle(sa, details);
                for (const oem of oems) {
                    if (out.some((c) => normalizeOem(c.oem) === oem))
                        continue;
                    out.push({
                        oem,
                        articleId: (sa.articleId ?? sa.id ?? null)?.toString?.() ?? null,
                        manufacturer: sa.brandName ?? sa.mfrName ?? null,
                        description: sa.genericArticleDescription ?? sa.articleName ?? null,
                        score: 0.9
                    });
                }
            }
        }
        catch {
            // ignore search failures
        }
        try {
            const oemResp = await tecdocClient_1.tecdocApi.searchAllEqualOemNo({
                langId: base.langId,
                oemNo: part.suspected_article_number
            });
            const oemArticles = mapArticles(oemResp);
            for (const sa of oemArticles.slice(0, 10)) {
                const details = await fetchArticleDetails(sa.articleId ?? sa.id, base.langId, base.countryFilterId);
                const oems = collectOemsFromArticle(sa, details);
                for (const oem of oems) {
                    if (out.some((c) => normalizeOem(c.oem) === oem))
                        continue;
                    out.push({
                        oem,
                        articleId: (sa.articleId ?? sa.id ?? null)?.toString?.() ?? null,
                        manufacturer: sa.brandName ?? sa.mfrName ?? null,
                        description: sa.genericArticleDescription ?? sa.articleName ?? null,
                        score: 0.95
                    });
                }
            }
        }
        catch {
            // ignore
        }
    }
    return out;
}
async function resolveTecdocAndPartSouq(vehicle, part, options) {
    const debug = {
        used_vehicleIds: [],
        used_categoryIds: [],
        notes: ""
    };
    const tecdoc_oem_candidates = [];
    const partsouq_oem_candidates = [];
    try {
        const baseParams = await resolveBaseParams(options?.preferredLanguage ?? "de", options?.countryCode ?? undefined);
        const vehicleSelection = await identifyVehicle(vehicle, baseParams);
        if (vehicleSelection.vehicleId) {
            debug.used_vehicleIds.push(String(vehicleSelection.vehicleId));
        }
        const { category } = await pickCategory(part, vehicleSelection);
        const categoryId = deriveCategoryId(category);
        if (categoryId) {
            debug.used_categoryIds.push(String(categoryId));
        }
        const tecCandidates = await fetchTecdocCandidates(vehicleSelection, category, part);
        for (const c of tecCandidates) {
            tecdoc_oem_candidates.push({
                oem_number: c.oem,
                articleId: c.articleId,
                manufacturer: c.manufacturer,
                description: c.description,
                scoreTecdoc: Number(c.score.toFixed(2))
            });
        }
        const partsouqQueries = [];
        if (part.suspected_article_number)
            partsouqQueries.push(part.suspected_article_number);
        if (vehicle.vin)
            partsouqQueries.push(vehicle.vin);
        const combined = [vehicle.make, vehicle.model, vehicle.year ? String(vehicle.year) : null, part.part_name]
            .filter(Boolean)
            .join(" ");
        if (combined)
            partsouqQueries.push(combined);
        const psCandidates = await fetchPartsouqCandidates(partsouqQueries);
        for (const p of psCandidates) {
            partsouq_oem_candidates.push({
                oem_number: p.oem,
                manufacturer: p.manufacturer,
                description: p.description,
                scorePartsouq: Number(p.score.toFixed(2))
            });
        }
        const normalizedTec = tecdoc_oem_candidates.map((c) => ({
            norm: normalizeOem(c.oem_number),
            raw: c
        }));
        const normalizedPs = partsouq_oem_candidates.map((c) => ({
            norm: normalizeOem(c.oem_number),
            raw: c
        }));
        let bestMatch = null;
        let status = "not_found";
        const intersection = [];
        for (const t of normalizedTec) {
            if (!t.norm)
                continue;
            const ps = normalizedPs.find((p) => p.norm === t.norm);
            if (ps) {
                intersection.push({
                    norm: t.norm,
                    score: (t.raw.scoreTecdoc || 0.6) + (ps.raw.scorePartsouq || 0.5),
                    tec: t.raw,
                    ps: ps.raw
                });
            }
        }
        if (intersection.length > 0) {
            const sorted = intersection.sort((a, b) => b.score - a.score);
            bestMatch = sorted[0].tec.oem_number;
            status = "match_confirmed";
        }
        else if (tecdoc_oem_candidates.length > 0) {
            const sorted = [...tecdoc_oem_candidates].sort((a, b) => (b.scoreTecdoc || 0) - (a.scoreTecdoc || 0));
            bestMatch = sorted[0].oem_number;
            status = "only_tecdoc";
        }
        else {
            bestMatch = null;
            status = "not_found";
        }
        debug.notes =
            status === "match_confirmed"
                ? "TecDoc + PartSouq Schnittmenge gefunden."
                : status === "only_tecdoc"
                    ? "Nur TecDoc-Kandidaten gefunden; PartSouq leer."
                    : "Keine OEM gefunden.";
        return {
            status,
            best_match_oem_number: bestMatch,
            tecdoc_oem_candidates,
            partsouq_oem_candidates,
            debug
        };
    }
    catch (err) {
        debug.notes = err?.message || "Unbekannter Fehler im TecDoc/PartSouq Flow.";
        return {
            status: "error",
            best_match_oem_number: null,
            tecdoc_oem_candidates,
            partsouq_oem_candidates,
            debug
        };
    }
}
