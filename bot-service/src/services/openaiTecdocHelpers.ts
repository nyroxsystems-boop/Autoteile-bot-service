import fetch from "node-fetch";

export interface RawVehicleInput {
  vin?: string;
  fahrzeugschein?: any;
  text?: string;
  articleNumber?: string;
}

export interface NormalizedVehicleInput {
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  engineCode?: string | null;
  engineCapacityCcm?: number | null;
  fuelType?: string | null;
  powerKw?: number | null;
  hsn?: string | null;
  tsn?: string | null;
  notes?: string;
}

export interface TecdocPlanStep {
  endpoint: string;
  params: Record<string, any>;
}

export interface TecdocLookupPlan {
  steps: TecdocPlanStep[];
  langId?: number;
  countryFilterId?: number;
  typeId?: number;
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function requireOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required");
  return key;
}

async function chatJson<T>(messages: Array<{ role: "system" | "user"; content: string }>): Promise<T> {
  const apiKey = requireOpenAiKey();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.2
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "{}";
  try {
    return JSON.parse(content) as T;
  } catch (err) {
    throw new Error("Failed to parse OpenAI JSON response");
  }
}

export async function normalizeVehicleInputWithOpenAI(input: RawVehicleInput): Promise<NormalizedVehicleInput> {
  const sys =
    "Du bist ein strenger Normalizer für Fahrzeugschein-/VIN-/Teileingaben. Gib ausschließlich JSON zurück mit den Feldern: vin, make, model, year, engineCode, engineCapacityCcm, fuelType, powerKw, hsn, tsn, notes.";
  const user = `Eingabe:\n${JSON.stringify(input, null, 2)}\nGib ein kompaktes JSON zurück. Wenn Werte fehlen, setze sie auf null.`;
  return chatJson<NormalizedVehicleInput>([
    { role: "system", content: sys },
    { role: "user", content: user }
  ]);
}

export async function suggestTecdocLookupsWithOpenAI(normalized: NormalizedVehicleInput): Promise<TecdocLookupPlan> {
  const sys =
    "Plane TecDoc-Aufrufe über den Apify Actor. Gib JSON {steps:[{endpoint:string,params:object}],langId?,countryFilterId?,typeId?}. Nutze, falls nichts bekannt: langId=4, countryFilterId=62, typeId=1.";
  const user = `Normalisierte Daten:\n${JSON.stringify(normalized, null, 2)}\nPlane minimal notwendige Schritte (getManufacturers -> getModels -> getVehicleEngineTypes -> getVehicleDetails).`;
  const plan = await chatJson<TecdocLookupPlan>([
    { role: "system", content: sys },
    { role: "user", content: user }
  ]);
  // Basic fallback defaults
  plan.langId = plan.langId ?? 4;
  plan.countryFilterId = plan.countryFilterId ?? 62;
  plan.typeId = plan.typeId ?? 1;
  plan.steps = Array.isArray(plan.steps) ? plan.steps : [];
  return plan;
}
