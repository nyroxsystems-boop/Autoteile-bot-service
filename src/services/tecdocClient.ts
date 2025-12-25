import { fetchWithTimeoutAndRetry } from "../utils/httpClient";

export interface TecDocVehicleLookup {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  engine?: string | null;
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

const TECDOC_BASE_URL = (process.env.TECDOC_BASE_URL || "").replace(/\/+$/, "");
const TECDOC_API_TOKEN = process.env.TECDOC_API_TOKEN || process.env.TECDOC_API_KEY || "";

if (!TECDOC_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn("TECDOC_BASE_URL is not set. TecDoc calls will fail until configured.");
}

async function callTecDoc(path: string, body: Record<string, any>): Promise<any> {
  if (!TECDOC_BASE_URL || !TECDOC_API_TOKEN) {
    throw new Error("TecDoc API not configured (TECDOC_BASE_URL / TECDOC_API_TOKEN missing)");
  }

  const url = `${TECDOC_BASE_URL}${path}`;
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

export const tecdocApi = {
  getAllLanguages(params: Record<string, any> = {}) {
    return callTecDoc("/getAllLanguages", params);
  },
  getAllCountries(params: Record<string, any> = {}) {
    return callTecDoc("/getAllCountries", params);
  },
  listVehicleTypes(params: Record<string, any>) {
    return callTecDoc("/listVehicleTypes", params);
  },
  getManufacturers(params: Record<string, any>) {
    return callTecDoc("/getManufacturers", params);
  },
  getModels(params: Record<string, any>) {
    return callTecDoc("/getModels", params);
  },
  getVehicleEngineTypes(params: Record<string, any>) {
    return callTecDoc("/getVehicleEngineTypes", params);
  },
  getVehicleDetails(params: Record<string, any>) {
    return callTecDoc("/getVehicleDetails", params);
  },
  getCategoryV3(params: Record<string, any>) {
    return callTecDoc("/getCategoryV3", params);
  },
  getArticlesList(params: Record<string, any>) {
    return callTecDoc("/getArticlesList", params);
  },
  getArticleDetailsById(params: Record<string, any>) {
    return callTecDoc("/getArticleDetailsById", params);
  },
  searchArticlesByNumber(params: Record<string, any>) {
    return callTecDoc("/searchArticlesByNumber", params);
  },
  searchArticlesByNumberAndSupplier(params: Record<string, any>) {
    return callTecDoc("/searchArticlesByNumberAndSupplier", params);
  },
  getVehicleByVin(params: Record<string, any>) {
    return callTecDoc("/getVehicleByVin", params);
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
  let best: TecDocManufacturer | null = null;
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

export function findBestEngine(engine: string | null | undefined, year: number | null | undefined, list: TecDocEngineType[]): TecDocEngineType | null {
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
