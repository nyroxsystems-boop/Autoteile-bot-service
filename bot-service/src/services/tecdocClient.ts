import { fetchWithTimeoutAndRetry } from "../utils/httpClient";

export interface TecDocVehicleLookup {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  engine?: string | null;
  engineKw?: number | null;
  vin?: string | null;
  hsn?: string | null;
  tsn?: string | null;
}

export interface TecDocLanguage {
  langId?: number;
  lngId?: number;
  name?: string;
}

export interface TecDocCountry {
  countryId?: number;
  countryFilterId?: number;
  countryName?: string;
  name?: string;
  countryCode?: string;
}

export interface TecDocManufacturer {
  manuId?: number;
  manufacturerId?: number;
  mfrId?: number;
  mfrName?: string;
  name?: string;
  text?: string;
}

export interface TecDocModel {
  modelId?: number;
  modelSeriesId?: number;
  modelname?: string;
  name?: string;
  constructionType?: string;
  yearOfConstrFrom?: number;
  yearOfConstrTo?: number;
  yearFrom?: number;
  yearTo?: number;
}

export interface TecDocEngineType {
  vehicleId?: number;
  modelSeriesId?: number;
  modelId?: number;
  engineName?: string;
  engineCode?: string;
  engine?: string;
  kWFrom?: number;
  yearOfConstrFrom?: number;
  yearOfConstrTo?: number;
  yearFrom?: number;
  yearTo?: number;
}

export interface TecDocCategory {
  categoryId?: number;
  genericArticleId?: number;
  levelId_1?: number;
  levelId_2?: number;
  levelId_3?: number;
  assemblyGroupName?: string;
  productGroupName?: string;
  name?: string;
  text?: string;
}

export interface TecDocArticle {
  articleId?: number;
  articleNo?: string;
  productGroupId?: number;
  genericArticleDescription?: string;
  articleName?: string;
  brandName?: string;
  oeNumbers?: { oeNumber?: string }[];
  mfrName?: string;
}

const DEFAULT_BASE = "https://tecdoc-catalog.p.rapidapi.com";
const TECDOC_BASE_URL = (process.env.TECDOC_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
const TECDOC_API_TOKEN = process.env.TECDOC_API_TOKEN || process.env.TECDOC_API_KEY || process.env.TECDOC_RAPIDAPI_KEY || "";
const TECDOC_RAPIDAPI_HOST =
  process.env.TECDOC_RAPIDAPI_HOST || (TECDOC_BASE_URL ? new URL(TECDOC_BASE_URL).host : "tecdoc-catalog.p.rapidapi.com");
const DEFAULT_LANG_ID = Number(process.env.TECDOC_DEFAULT_LANG_ID || 4); // English fallback
const DEFAULT_COUNTRY_FILTER_ID = Number(process.env.TECDOC_DEFAULT_COUNTRY_FILTER_ID || 62); // Germany fallback

const USE_RAPIDAPI = /rapidapi\.com/.test(TECDOC_BASE_URL) || !!process.env.TECDOC_RAPIDAPI_HOST;

if (!TECDOC_BASE_URL || !TECDOC_API_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn("TECDOC_BASE_URL or TECDOC_API_KEY missing. TecDoc calls will fail until configured.");
}

function ensurePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function buildPath(template: string, params: Record<string, any> = {}): string {
  return template.replace(/{(.*?)}/g, (_, key) => encodeURIComponent(params[key] ?? ""));
}

function attachQuery(url: URL, query: Record<string, any> = {}) {
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, String(v));
  });
}

async function callTecDocRapid(pathTemplate: string, pathParams: Record<string, any> = {}, query: Record<string, any> = {}) {
  if (!TECDOC_API_TOKEN || !TECDOC_BASE_URL) {
    throw new Error("TecDoc API not configured (TECDOC_BASE_URL / TECDOC_API_KEY missing)");
  }

  const url = new URL(`${TECDOC_BASE_URL}${buildPath(ensurePath(pathTemplate), pathParams)}`);
  attachQuery(url, query);

  const resp = await fetchWithTimeoutAndRetry(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": TECDOC_API_TOKEN,
      "X-RapidAPI-Host": TECDOC_RAPIDAPI_HOST
    },
    timeoutMs: Number(process.env.TECDOC_TIMEOUT_MS || 10000),
    retry: Number(process.env.TECDOC_RETRY_COUNT || 2)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`TecDoc API error: ${resp.status} ${resp.statusText} - ${text}`);
  }

  return resp.json();
}

async function callTecDocLegacy(path: string, body: Record<string, any>): Promise<any> {
  if (!TECDOC_BASE_URL || !TECDOC_API_TOKEN) {
    throw new Error("TecDoc API not configured (TECDOC_BASE_URL / TECDOC_API_TOKEN missing)");
  }

  const url = `${TECDOC_BASE_URL}${ensurePath(path)}`;
  const resp = await fetchWithTimeoutAndRetry(url, {
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

async function callTecDoc(pathTemplate: string, pathParams: Record<string, any> = {}, query: Record<string, any> = {}) {
  if (USE_RAPIDAPI) {
    return callTecDocRapid(pathTemplate, pathParams, query);
  }
  return callTecDocLegacy(pathTemplate, { ...pathParams, ...query });
}

async function callTecDocRapidForm(pathTemplate: string, body: Record<string, any> = {}) {
  if (!TECDOC_API_TOKEN || !TECDOC_BASE_URL) {
    throw new Error("TecDoc API not configured (TECDOC_BASE_URL / TECDOC_API_KEY missing)");
  }
  const url = new URL(`${TECDOC_BASE_URL}${ensurePath(pathTemplate)}`);
  const encoded = new URLSearchParams();
  Object.entries(body || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    encoded.append(k, String(v));
  });
  const resp = await fetchWithTimeoutAndRetry(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-RapidAPI-Key": TECDOC_API_TOKEN,
      "X-RapidAPI-Host": TECDOC_RAPIDAPI_HOST
    },
    body: encoded.toString(),
    timeoutMs: Number(process.env.TECDOC_TIMEOUT_MS || 10000),
    retry: Number(process.env.TECDOC_RETRY_COUNT || 2)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`TecDoc API error: ${resp.status} ${resp.statusText} - ${text}`);
  }
  return resp.json();
}

export const tecdocApi = {
  getAllLanguages(params: Record<string, any> = {}) {
    return callTecDoc("/getAllLanguages", {}, params);
  },
  getAllCountries(params: Record<string, any> = {}) {
    return callTecDoc("/getAllCountries", {}, params);
  },
  listVehicleTypes(params: Record<string, any> = {}) {
    return callTecDoc("/types/list-vehicles-type", {}, params);
  },
  async getManufacturers(params: Record<string, any> = {}) {
    try {
      return await callTecDoc("/getManufacturers", {}, params);
    } catch (err) {
      // If Rapid endpoint is unavailable, return empty to allow higher-level fallbacks.
      return { data: [] };
    }
  },
  getModels(params: Record<string, any> = {}) {
    const { typeId, manufacturerId, langId, countryFilterId } = params;
    return callTecDoc(
      "/models/list/type-id/{typeId}/manufacturer-id/{manufacturerId}/lang-id/{langId}/country-filter-id/{countryFilterId}",
      { typeId, manufacturerId, langId, countryFilterId },
      {}
    );
  },
  getVehicleEngineTypes(params: Record<string, any> = {}) {
    const { typeId, vehicleId, langId, countryFilterId } = params;
    return callTecDoc(
      "/types/type-id/{typeId}/vehicle-type-details/{vehicleId}/lang-id/{langId}/country-filter-id/{countryFilterId}",
      { typeId, vehicleId, langId, countryFilterId },
      {}
    );
  },
  getVehicleDetails(params: Record<string, any> = {}) {
    return callTecDoc("/getVehicleDetails", {}, params);
  },
  getVehicleByVIN(params: Record<string, any> = {}) {
    return callTecDoc("/getVehicleByVIN", {}, params);
  },
  getVehicleByKba(params: Record<string, any> = {}) {
    return callTecDoc("/getVehicleByKba", {}, params);
  },
  getCategoryV2(params: Record<string, any> = {}) {
    return callTecDoc("/getCategoryV2", {}, params);
  },
  getCategoryV3(params: Record<string, any> = {}) {
    return callTecDoc("/getCategoryV3", {}, params);
  },
  searchCategoryByDescription(params: { typeId: number; langId: number; searchText: string }) {
    const { typeId, langId, searchText } = params;
    return callTecDoc(
      "/category/search-for-the-commodity-group-tree-by-description/type-id/{typeId}/lang-id/{langId}/search-text/{searchText}",
      { typeId, langId, searchText },
      {}
    );
  },
  listArticlesForm(body: Record<string, any> = {}) {
    return callTecDocRapidForm("/articles/list-articles", body);
  },
  async getArticlesList(params: Record<string, any> = {}) {
    return callTecDoc("/getArticlesList", {}, params);
  },
  getArticleDetailsById(params: Record<string, any> = {}) {
    return callTecDoc("/getArticleDetailsById", {}, params);
  },
  searchArticlesByNumber(params: Record<string, any> = {}) {
    if (USE_RAPIDAPI) {
      const { langId, articleSearchNr } = params;
      return callTecDoc(
        "/artlookup/search-articles-by-article-no/lang-id/{langId}/article-type/ArticleNumber/article-no/{articleSearchNr}",
        { langId, articleSearchNr },
        {}
      );
    }
    return callTecDoc("/searchArticlesByNumber", {}, params);
  },
  searchArticlesByNumberAndSupplier(params: Record<string, any> = {}) {
    return callTecDoc("/searchArticlesByNumberAndSupplier", {}, params);
  },
  searchAllEqualOemNo(params: { langId: number; oemNo: string }) {
    const { langId, oemNo } = params;
    return callTecDoc("/articles-oem/search-all-equal-oem-no/lang-id/{langId}/article-oem-no/{oemNo}", { langId, oemNo }, {});
  },
  selectOemPartsByVehicleAndDescription(params: { typeId: number; vehicleId: number; langId: number; searchParam: string }) {
    const { typeId, vehicleId, langId, searchParam } = params;
    return callTecDoc(
      "/articles-oem/selecting-oem-parts-vehicle-modification-description-product-group/type-id/{typeId}/vehicle-id/{vehicleId}/lang-id/{langId}/search-param/{searchParam}",
      { typeId, vehicleId, langId, searchParam },
      {}
    );
  }
};

function normalize(str: string | null | undefined): string {
  return (str || "").toString().toLowerCase().trim();
}

function scoreIncludes(haystack: string, needle: string): number {
  if (!haystack || !needle) return 0;
  return haystack.includes(needle) ? needle.length : 0;
}

export function findBestManufacturer(make: string | null | undefined, list: TecDocManufacturer[]): TecDocManufacturer | null {
  if (!make) return null;
  const needle = normalize(make);
  const synonyms: Record<string, string[]> = {
    bmw: ["bayer", "bayerische", "bayerische motoren", "bayer. mot.", "bayer. mot. werke"],
    volkswagen: ["vw", "volkswagen", "volks wagen"],
    mercedes: ["mercedes-benz", "mercedes benz", "mb"],
    opel: ["opel"],
    audi: ["audi"],
    ford: ["ford"]
  };
  const needles = [needle, ...(synonyms[needle] || [])].map(normalize);
  let best: TecDocManufacturer | null = null;
  let bestScore = 0;
  for (const m of list) {
    const name = normalize(m.name || m.mfrName || m.text);
    let s = 0;
    for (const n of needles) {
      s = Math.max(s, scoreIncludes(name, n));
    }
    if (s > bestScore) {
      best = m;
      bestScore = s;
    }
  }
  return best;
}

export function findBestModel(model: string | null | undefined, year: number | null | undefined, list: TecDocModel[]): TecDocModel | null {
  const needle = normalize(model);
  let best: TecDocModel | null = null;
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

export function findBestEngine(
  engine: string | null | undefined,
  year: number | null | undefined,
  kw: number | null | undefined,
  list: TecDocEngineType[]
): TecDocEngineType | null {
  const needle = normalize(engine);
  let best: TecDocEngineType | null = null;
  let bestScore = 0;
  for (const e of list) {
    const name = normalize(e.engineName || e.engineCode || e.engine);
    let s = needle ? scoreIncludes(name, needle) : 0;
    const from = e.yearFrom ?? e.yearOfConstrFrom;
    const to = e.yearTo ?? e.yearOfConstrTo;
    if (year && from && to && year >= from && year <= to) {
      s += 2;
    }
    if (kw && e.kWFrom) {
      const diff = Math.abs(kw - e.kWFrom);
      if (diff <= 5) s += 2;
      else if (diff <= 10) s += 1;
    }
    if (s > bestScore) {
      best = e;
      bestScore = s;
    }
  }
  return best;
}

export function findCategoryByName(partName: string | null | undefined, list: TecDocCategory[]): TecDocCategory | null {
  if (!partName) return null;
  const needle = normalize(partName);
  let best: TecDocCategory | null = null;
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

export type TecDocApi = typeof tecdocApi;

export function getDefaultTecDocClient(): TecDocApi {
  return tecdocApi;
}

export async function findManufacturerIdByName(
  make: string | null | undefined,
  params: { typeId?: number; langId?: number; countryFilterId?: number }
): Promise<number | null> {
  if (!make) return null;
  // If TecDoc listVehicleTypes is not available on Rapid, return null to allow upstream fallbacks.
  return null;
}
