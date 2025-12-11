import {
  TecDocCategory,
  TecDocEngineType,
  TecDocManufacturer,
  TecDocModel,
  findBestEngine,
  findBestManufacturer,
  findBestModel,
  tecdocApi
} from "../tecdocClient";
import { fetchWithTimeoutAndRetry } from "../../utils/httpClient";

type NullableString = string | null | undefined;

const MANUFACTURER_ID_MAP: Record<string, number> = {
  bmw: 63,
  vw: 2068,
  volkswagen: 2068,
  audi: 2031,
  mercedes: 2026,
  mercedesbenz: 2026,
  mercedes_benz: 2026,
  opel: 2153
};

export interface TecdocPartsouqVehicleInput {
  vin?: NullableString;
  hsn?: NullableString;
  tsn?: NullableString;
  make?: NullableString;
  model?: NullableString;
  year?: number | null;
  kw?: number | null;
  engineCode?: NullableString;
  fuelType?: NullableString;
  engineCapacity?: number | null;
}

export interface TecdocPartsouqPartInput {
  part_name: string;
  suspected_article_number?: NullableString;
  axle?: NullableString;
  side?: NullableString;
  position?: NullableString;
}

export interface TecdocPartsouqResult {
  status: "match_confirmed" | "only_tecdoc" | "not_found" | "error";
  best_match_oem_number: string | null;
  tecdoc_oem_candidates: Array<{
    oem_number: string;
    articleId: string | null;
    manufacturer: string | null;
    description: string | null;
    scoreTecdoc: number;
  }>;
  partsouq_oem_candidates: Array<{
    oem_number: string;
    manufacturer: string | null;
    description: string | null;
    scorePartsouq: number;
  }>;
  debug: {
    used_vehicleIds: string[];
    used_categoryIds: string[];
    notes: string;
  };
}

interface LangCountrySelection {
  langId: number;
  countryFilterId: number;
}

interface VehicleSelection extends LangCountrySelection {
  typeId: number;
  manufacturerId: number | null;
  manufacturerName?: string | null;
  modelSeriesId: number | null;
  modelName?: string | null;
  vehicleId: number | null;
  engineMatch?: TecDocEngineType | null;
}

interface TecdocCandidate {
  oem: string;
  articleId: string | null;
  manufacturer: string | null;
  description: string | null;
  score: number;
}

interface PartsouqCandidate {
  oem: string;
  manufacturer: string | null;
  description: string | null;
  score: number;
}

function normalizeOem(oem: string | null | undefined): string {
  if (!oem) return "";
  return oem.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function pickBestLangId(langs: any[], preferred: "de" | "en" = "de"): number {
  const list = langs || [];
  const german = list.find(
    (l: any) => /german|deutsch/i.test(l?.name || "") || String(l?.langId || l?.lngId) === "10"
  );
  const english = list.find(
    (l: any) => /english|englisch/i.test(l?.name || "") || String(l?.langId || l?.lngId) === "4"
  );
  if (preferred === "de" && german?.langId) return german.langId;
  if (preferred === "en" && english?.langId) return english.langId;
  return german?.langId || english?.langId || 4;
}

function pickBestCountryId(countries: any[], countryCode?: string | null): number {
  const list = countries || [];
  const code = (countryCode || "DE").toUpperCase();
  const match =
    list.find((c: any) => (c?.countryCode || "").toUpperCase() === code) ||
    list.find((c: any) => (c?.name || c?.countryName || "").toUpperCase().includes(code));
  const germany =
    list.find((c: any) => /germany|deutschland/i.test(c?.name || c?.countryName || "")) ||
    list.find((c: any) => String(c?.countryId || c?.countryFilterId) === "62");
  return match?.countryFilterId || match?.countryId || germany?.countryFilterId || germany?.countryId || 62;
}

function pickTypeId(types: any[]): number {
  const list = types || [];
  const passenger = list.find((t: any) => /pkw|passenger|car/i.test(t?.name || t?.typeName || ""));
  const id =
    passenger?.typeId || passenger?.id || passenger?.vehicleTypeId || passenger?.value || list?.[0]?.typeId || list?.[0]?.id;
  return id || 1;
}

function mapCategories(resp: any): TecDocCategory[] {
  return resp?.data || resp?.genericArticles || resp?.assemblyGroups || resp?.categories || [];
}

function mapArticles(resp: any): any[] {
  return (
    resp?.data ||
    resp?.articles ||
    resp?.article ||
    resp?.results ||
    resp?.articleDirectSearchResults ||
    []
  );
}

function mapVehicles(resp: any): any[] {
  return resp?.data || resp?.vehicles || resp?.types || resp?.results || resp || [];
}

function scoreCategoryMatch(part: TecdocPartsouqPartInput, category: TecDocCategory): number {
  const base = (category.productGroupName || category.assemblyGroupName || category.name || category.text || "").toLowerCase();
  const partText = (part.part_name || "").toLowerCase();
  let score = 0;
  if (base.includes(partText) || partText.includes(base)) score += 2;
  const keyWords: Record<string, string[]> = {
    brake: ["bremse", "brems", "brake"],
    pad: ["belag", "pad", "pad kit"],
    disc: ["scheibe", "disc"],
    filter: ["filter", "ölfilter", "luftfilter", "oil filter", "air filter"],
    suspension: ["lenker", "querlenker", "control arm", "suspension", "stabilizer", "koppel"],
    spark: ["zündkerze", "spark"]
  };
  Object.values(keyWords).forEach((words) => {
    if (words.some((w) => partText.includes(w) && base.includes(w))) score += 1.2;
  });
  const axle = (part.axle || part.position || "").toLowerCase();
  if (axle.includes("front") && /front|vorder/i.test(base)) score += 0.5;
  if (axle.includes("rear") && /rear|hinter/i.test(base)) score += 0.5;
  const side = (part.side || "").toLowerCase();
  if (side && base.includes(side)) score += 0.3;
  return score;
}

function pickBestCategory(part: TecdocPartsouqPartInput, categories: TecDocCategory[]): TecDocCategory | null {
  let best: TecDocCategory | null = null;
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

function collectOemsFromArticle(article: any, articleDetails: any): string[] {
  const out = new Set<string>();
  const possible = [
    article?.articleNo,
    article?.articleNumber,
    article?.data?.articleNo,
    ...(article?.oeNumbers || []).map((o: any) => o?.oeNumber),
    ...(articleDetails?.oeNumbers || []).map((o: any) => o?.oeNumber),
    ...(Array.isArray(articleDetails?.data) ? articleDetails.data.flatMap((x: any) => x?.oeNumbers || []).map((o: any) => o?.oeNumber) : []),
    ...(Array.isArray(articleDetails?.data) ? articleDetails.data.map((x: any) => x?.articleNo) : [])
  ].filter(Boolean);
  for (const p of possible) {
    const norm = normalizeOem(String(p));
    if (norm) out.add(norm);
  }
  return Array.from(out);
}

async function fetchArticleDetails(articleId: number | string, langId: number, countryFilterId: number) {
  if (!articleId) return null;
  try {
    return await tecdocApi.getArticleDetailsById({ langId, countryFilterId, articleId });
  } catch {
    return null;
  }
}

async function fetchPartsouqCandidates(queries: string[]): Promise<PartsouqCandidate[]> {
  const out: PartsouqCandidate[] = [];
  for (const query of queries) {
    if (!query) continue;
    try {
      const url = `https://partsouq.com/en/search/all?q=${encodeURIComponent(query)}`;
      const resp = await fetchWithTimeoutAndRetry(url, { method: "GET", timeoutMs: 8000, retry: 1 });
      if (!resp.ok) continue;
      const text = await resp.text();
      const regex = /OEM[:\s]*([A-Z0-9\-\.\s]{5,})/gi;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const raw = match[1]?.trim();
        const norm = normalizeOem(raw);
        if (!norm) continue;
        if (out.some((c) => normalizeOem(c.oem) === norm)) continue;
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
        if (!norm) continue;
        if (out.some((c) => normalizeOem(c.oem) === norm)) continue;
        out.push({
          oem: norm,
          manufacturer: null,
          description: `partsouq: ${query}`,
          score: 0.35
        });
      }
      if (out.length >= 5) break;
    } catch {
      // ignore and continue with next query
    }
  }
  return out;
}

async function resolveBaseParams(language?: "de" | "en", countryCode?: string | null): Promise<LangCountrySelection & { typeId: number }> {
  const langsResp = await tecdocApi.getAllLanguages();
  const langs = langsResp?.data || langsResp?.languages || langsResp || [];
  const langId = pickBestLangId(langs, language === "en" ? "en" : "de");

  const countriesResp = await tecdocApi.getAllCountries({ langId });
  const countries = countriesResp?.data || countriesResp?.countries || countriesResp || [];
  const countryFilterId = pickBestCountryId(countries, countryCode);

  // RapidAPI catalog sometimes lacks listVehicleTypes; default to PKW = 1
  const typeId = 1;

  return { langId, countryFilterId, typeId };
}

async function identifyVehicle(
  vehicle: TecdocPartsouqVehicleInput,
  base: { langId: number; countryFilterId: number; typeId: number }
): Promise<VehicleSelection> {
  const selection: VehicleSelection = {
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
      const vinResp = await tecdocApi.getVehicleByVIN({
        vin: vehicle.vin,
        countryFilterId: base.countryFilterId,
        langId: base.langId,
        typeId: base.typeId
      });
      const vinVehicles = mapVehicles(vinResp);
      const vinFirst = vinVehicles[0];
      const manuId =
        vinFirst?.manufacturerId ?? vinFirst?.manuId ?? vinFirst?.mfrId ?? vinFirst?.makeId ?? vinFirst?.manufacturer?.id ?? null;
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
    } catch {
      // ignore and continue
    }
  }

  if (vehicle.hsn && vehicle.tsn) {
    try {
      const kbaResp = await tecdocApi.getVehicleByKba({
        hsn: vehicle.hsn,
        tsn: vehicle.tsn,
        countryFilterId: base.countryFilterId,
        langId: base.langId,
        typeId: base.typeId
      });
      const kbaVehicles = mapVehicles(kbaResp);
      const kbaFirst = kbaVehicles[0];
      const manuId =
        kbaFirst?.manufacturerId ?? kbaFirst?.manuId ?? kbaFirst?.mfrId ?? kbaFirst?.makeId ?? kbaFirst?.manufacturer?.id ?? null;
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
    } catch {
      // ignore and continue
    }
  }

  // Manufacturer
  let manu: TecDocManufacturer | null = null;
  try {
    const manuResp = await tecdocApi.getManufacturers({
      typeId: base.typeId,
      langId: base.langId,
      countryFilterId: base.countryFilterId
    });
    const manuList: TecDocManufacturer[] = manuResp?.data || manuResp?.manufacturers || [];
    manu = findBestManufacturer(vehicle.make || "", manuList);
  } catch {
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
    const modelsResp = await tecdocApi.getModels({
      typeId: base.typeId,
      langId: base.langId,
      countryFilterId: base.countryFilterId,
      manufacturerId: selection.manufacturerId
    });
    const models: TecDocModel[] = modelsResp?.data || modelsResp?.modelSeries || modelsResp?.models || [];
    const model = findBestModel(vehicle.model || "", vehicle.year ?? undefined, models);
    selection.modelSeriesId = model?.modelSeriesId ?? model?.modelId ?? null;
    selection.modelName = model?.name || model?.modelname || null;

    if (selection.modelSeriesId) {
      const enginesResp = await tecdocApi.getVehicleEngineTypes({
        typeId: base.typeId,
        langId: base.langId,
        countryFilterId: base.countryFilterId,
        manufacturerId: selection.manufacturerId,
        modelSeriesId: selection.modelSeriesId
      });
      const engines: TecDocEngineType[] = enginesResp?.data || enginesResp?.vehicles || enginesResp?.engineTypes || [];
      const engineMatch = findBestEngine(vehicle.engineCode || null, vehicle.year ?? null, vehicle.kw ?? null, engines);
      selection.engineMatch = engineMatch ?? undefined;
      selection.vehicleId = engineMatch?.vehicleId ?? null;
    }
  }

  return selection;
}

function deriveCategoryId(category: TecDocCategory | null | undefined): number | null {
  if (!category) return null;
  return (
    category.categoryId ??
    category.genericArticleId ??
    category.levelId_3 ??
    category.levelId_2 ??
    category.levelId_1 ??
    null
  );
}

async function pickCategory(
  part: TecdocPartsouqPartInput,
  base: VehicleSelection
): Promise<{ category: TecDocCategory | null; categories: TecDocCategory[] }> {
  const resp =
    (await tecdocApi.getCategoryV3({
      typeId: base.typeId,
      langId: base.langId,
      countryFilterId: base.countryFilterId,
      manufacturerId: base.manufacturerId ?? undefined,
      vehicleId: base.vehicleId ?? undefined
    })) || {};
  let categories = mapCategories(resp);
  if (!categories?.length) {
    const resp2 = await tecdocApi.getCategoryV2({
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

async function fetchTecdocCandidates(
  base: VehicleSelection,
  category: TecDocCategory | null,
  part: TecdocPartsouqPartInput
): Promise<TecdocCandidate[]> {
  const out: TecdocCandidate[] = [];
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
      const artResp = await tecdocApi.getArticlesList(params);
      const articles = mapArticles(artResp);
      const limited = articles.slice(0, 10);
      for (const a of limited) {
        const details = await fetchArticleDetails(a.articleId ?? a.id, base.langId, base.countryFilterId);
        const oems = collectOemsFromArticle(a, details);
        for (const oem of oems) {
          if (!oem) continue;
          const score = Math.min(1, 0.6 + (productGroupId ? 0.1 : 0) + (base.vehicleId ? 0.1 : 0));
          if (out.some((c) => normalizeOem(c.oem) === oem)) continue;
          out.push({
            oem,
            articleId: (a.articleId ?? a.id ?? null)?.toString?.() ?? null,
            manufacturer: a.brandName ?? a.mfrName ?? null,
            description: a.genericArticleDescription ?? a.articleName ?? null,
            score
          });
        }
      }
    } catch {
      // ignore if TecDoc RapidAPI does not support product-group article lists
    }
  }

  // direct search via suspected article number
  if (part.suspected_article_number) {
    try {
      const searchResp = await tecdocApi.searchArticlesByNumber({
        langId: base.langId,
        articleSearchNr: part.suspected_article_number
      });
      const searchArticles = mapArticles(searchResp);
      for (const sa of searchArticles.slice(0, 5)) {
        const details = await fetchArticleDetails(sa.articleId ?? sa.id, base.langId, base.countryFilterId);
        const oems = collectOemsFromArticle(sa, details);
        for (const oem of oems) {
          if (out.some((c) => normalizeOem(c.oem) === oem)) continue;
          out.push({
            oem,
            articleId: (sa.articleId ?? sa.id ?? null)?.toString?.() ?? null,
            manufacturer: sa.brandName ?? sa.mfrName ?? null,
            description: sa.genericArticleDescription ?? sa.articleName ?? null,
            score: 0.9
          });
        }
      }
    } catch {
      // ignore search failures
    }

    try {
      const oemResp = await tecdocApi.searchAllEqualOemNo({
        langId: base.langId,
        oemNo: part.suspected_article_number
      });
      const oemArticles = mapArticles(oemResp);
      for (const sa of oemArticles.slice(0, 10)) {
        const details = await fetchArticleDetails(sa.articleId ?? sa.id, base.langId, base.countryFilterId);
        const oems = collectOemsFromArticle(sa, details);
        for (const oem of oems) {
          if (out.some((c) => normalizeOem(c.oem) === oem)) continue;
          out.push({
            oem,
            articleId: (sa.articleId ?? sa.id ?? null)?.toString?.() ?? null,
            manufacturer: sa.brandName ?? sa.mfrName ?? null,
            description: sa.genericArticleDescription ?? sa.articleName ?? null,
            score: 0.95
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return out;
}

export async function resolveTecdocAndPartSouq(
  vehicle: TecdocPartsouqVehicleInput,
  part: TecdocPartsouqPartInput,
  options?: { preferredLanguage?: "de" | "en"; countryCode?: string | null }
): Promise<TecdocPartsouqResult> {
  const debug: TecdocPartsouqResult["debug"] = {
    used_vehicleIds: [],
    used_categoryIds: [],
    notes: ""
  };

  const tecdoc_oem_candidates: TecdocPartsouqResult["tecdoc_oem_candidates"] = [];
  const partsouq_oem_candidates: TecdocPartsouqResult["partsouq_oem_candidates"] = [];

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

    const partsouqQueries: string[] = [];
    if (part.suspected_article_number) partsouqQueries.push(part.suspected_article_number);
    if (vehicle.vin) partsouqQueries.push(vehicle.vin);
    const combined = [vehicle.make, vehicle.model, vehicle.year ? String(vehicle.year) : null, part.part_name]
      .filter(Boolean)
      .join(" ");
    if (combined) partsouqQueries.push(combined);

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

    let bestMatch: string | null = null;
    let status: TecdocPartsouqResult["status"] = "not_found";

    const intersection: Array<{ norm: string; score: number; tec: typeof tecdoc_oem_candidates[0]; ps?: typeof partsouq_oem_candidates[0] }> = [];
    for (const t of normalizedTec) {
      if (!t.norm) continue;
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
    } else if (tecdoc_oem_candidates.length > 0) {
      const sorted = [...tecdoc_oem_candidates].sort((a, b) => (b.scoreTecdoc || 0) - (a.scoreTecdoc || 0));
      bestMatch = sorted[0].oem_number;
      status = "only_tecdoc";
    } else {
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
  } catch (err: any) {
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
