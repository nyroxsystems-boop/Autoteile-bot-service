import fetch from "node-fetch";

export interface TecdocActorInput {
  endpoint: string;
  [key: string]: any;
}

export interface TecdocActorResponse<T = any> {
  items: T[];
  raw: any;
}

const ACTOR_BASE =
  process.env.APIFY_TECDOC_ACTOR_URL ||
  "https://api.apify.com/v2/acts/making-data-meaningful~tecdoc/run-sync-get-dataset-items";

function requireToken(): string {
  const token = process.env.APIFY_TECDOC_TOKEN;
  if (!token) {
    throw new Error("APIFY_TECDOC_TOKEN is required for TecDoc Actor calls");
  }
  return token;
}

async function httpPostJson(url: string, body: any): Promise<any> {
  const res = await fetch(url, {
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

export async function runTecdocActor<T = any>(input: TecdocActorInput): Promise<TecdocActorResponse<T>> {
  const token = requireToken();
  const url = `${ACTOR_BASE}?token=${encodeURIComponent(token)}`;
  const raw = await httpPostJson(url, input);
  const items = Array.isArray(raw) ? raw : raw?.items || raw?.data || [];
  return { items, raw };
}

// ------------------------
// Logical wrappers
// ------------------------

export function tecdocGetAllLanguages() {
  return runTecdocActor({ endpoint: "/getAllLanguages" });
}

export function tecdocGetAllCountries() {
  return runTecdocActor({ endpoint: "/getAllCountries" });
}

export function tecdocListVehicleTypes() {
  return runTecdocActor({ endpoint: "/listVehicleTypes" });
}

export function tecdocGetManufacturers(params: { typeId: number; langId: number; countryFilterId: number }) {
  return runTecdocActor({ endpoint: "/getManufacturers", ...params });
}

export function tecdocGetModels(params: {
  typeId: number;
  langId: number;
  countryFilterId: number;
  manufacturerId: number;
}) {
  return runTecdocActor({ endpoint: "/getModels", ...params });
}

export function tecdocGetVehicleEngineTypes(params: {
  typeId: number;
  langId: number;
  countryFilterId: number;
  manufacturerId: number;
  modelSeriesId: number;
}) {
  return runTecdocActor({ endpoint: "/getVehicleEngineTypes", ...params });
}

export function tecdocGetVehicleDetails(params: {
  typeId: number;
  langId: number;
  countryFilterId: number;
  manufacturerId: number;
  vehicleId: number;
}) {
  return runTecdocActor({ endpoint: "/getVehicleDetails", ...params });
}

export function tecdocGetCategoryV3(params: {
  typeId: number;
  langId: number;
  countryFilterId: number;
  manufacturerId: number;
  vehicleId: number;
}) {
  return runTecdocActor({ endpoint: "/getCategoryV3", ...params });
}

export function tecdocGetArticlesList(params: {
  typeId: number;
  langId: number;
  countryFilterId: number;
  manufacturerId: number;
  vehicleId: number;
  productGroupId: number;
}) {
  return runTecdocActor({ endpoint: "/getArticlesList", ...params });
}

export function tecdocGetArticleDetailsById(params: { langId: number; countryFilterId: number; articleId: number }) {
  return runTecdocActor({ endpoint: "/getArticleDetailsById", ...params });
}

export function tecdocSearchArticlesByNumber(params: { articleSearchNr: string; langId: number }) {
  return runTecdocActor({ endpoint: "/searchArticlesByNumber", ...params });
}

export function tecdocSearchArticlesByNumberAndSupplier(params: {
  articleSearchNr: string;
  supplierId: number;
  langId: number;
}) {
  return runTecdocActor({ endpoint: "/searchArticlesByNumberAndSupplier", ...params });
}
