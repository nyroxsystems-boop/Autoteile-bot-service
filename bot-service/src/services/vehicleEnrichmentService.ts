import fetch from "node-fetch";

const DEFAULT_BASE_URL = process.env.VEHICLEDATABASES_BASE_URL || "https://api.vehicledatabases.com";

export interface VinDecodeResponse {
  status?: string;
  data?: any;
  [key: string]: any;
}

export interface BuildsheetResponse {
  status?: string;
  data?: any;
  [key: string]: any;
}

export interface VehicleNormalized {
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  bodyType: string | null;
  vehicleType: string | null;
  doors: number | null;
  seatingCapacity: number | null;
  engineCode: string | null;
  engineCapacityCcm: number | null;
  engineDescription: string | null;
  cylinders: number | null;
  fuelType: string | null;
  driveType: string | null;
  oemHints: string[];
}

export interface EnrichVehicleResult {
  vin: string;
  vinDecodeRaw: any | null;
  buildsheetRaw: any | null;
  vehicleNormalized: VehicleNormalized;
  suspectedOemNumbers: string[];
  meta: {
    vinDecodeStatus: "success" | "error";
    buildsheetStatus: "success" | "error" | "skipped";
    errors: string[];
  };
}

interface EnrichOptions {
  vin: string;
  apiKey: string;
  baseUrl?: string;
  suspectedArticleNumber?: string | null;
}

async function httpGet(url: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export async function decodeVin(baseUrl: string, apiKey: string, vin: string): Promise<VinDecodeResponse> {
  const url = `${baseUrl.replace(/\/+$/, "")}/vin-decode/${encodeURIComponent(vin)}`;
  return httpGet(url, {
    Accept: "application/json",
    "x-AuthKey": apiKey
  });
}

export async function fetchBuildsheet(baseUrl: string, apiKey: string, vin: string): Promise<BuildsheetResponse> {
  const url = `${baseUrl.replace(/\/+$/, "")}/buildsheet/${encodeURIComponent(vin)}`;
  return httpGet(url, {
    Accept: "application/json",
    "x-AuthKey": apiKey
  });
}

function parseNumber(val: any): number | null {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function extractEngineCode(engineDescription: string | null | undefined): string | null {
  if (!engineDescription) return null;
  const token = engineDescription.split(/[ +]/)[0];
  return token || null;
}

export function extractOemHintsFromBuildsheetCodes(codes: Record<string, string> | undefined | null): string[] {
  if (!codes) return [];
  return Object.values(codes)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => !!v);
}

export function normalizeVehicleData(vinData: any, buildsheetData: any): VehicleNormalized {
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

export async function enrichVehicleForOemSearch(options: EnrichOptions): Promise<EnrichVehicleResult> {
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  const apiKey = options.apiKey;
  const errors: string[] = [];

  let vinDecodeRaw: any | null = null;
  let buildsheetRaw: any | null = null;
  let vinDecodeStatus: "success" | "error" = "error";
  let buildsheetStatus: "success" | "error" | "skipped" = "skipped";

  // VIN decode
  try {
    vinDecodeRaw = await decodeVin(baseUrl, apiKey, options.vin);
    vinDecodeStatus = vinDecodeRaw?.status === "success" ? "success" : "error";
    if (vinDecodeStatus === "error") {
      errors.push(`vin-decode returned status ${vinDecodeRaw?.status || "unknown"}`);
    }
  } catch (err: any) {
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
  } catch (err: any) {
    errors.push(`buildsheet failed: ${err?.message || err}`);
    buildsheetStatus = "error";
  }

  const vehicleNormalized = normalizeVehicleData(
    vinDecodeStatus === "success" ? vinDecodeRaw : null,
    buildsheetStatus === "success" ? buildsheetRaw : null
  );

  const suspectedOemNumbers: string[] = [];
  if (options.suspectedArticleNumber) {
    const cleaned = options.suspectedArticleNumber.trim().toUpperCase();
    if (cleaned) suspectedOemNumbers.push(cleaned);
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
