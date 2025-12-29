"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeVehicleInputWithOpenAI = normalizeVehicleInputWithOpenAI;
exports.suggestTecdocLookupsWithOpenAI = suggestTecdocLookupsWithOpenAI;
const node_fetch_1 = __importDefault(require("node-fetch"));
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
function requireOpenAiKey() {
    const key = process.env.OPENAI_API_KEY;
    if (!key)
        throw new Error("OPENAI_API_KEY is required");
    return key;
}
async function chatJson(messages) {
    const apiKey = requireOpenAiKey();
    const res = await (0, node_fetch_1.default)("https://api.openai.com/v1/chat/completions", {
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
        return JSON.parse(content);
    }
    catch (err) {
        throw new Error("Failed to parse OpenAI JSON response");
    }
}
async function normalizeVehicleInputWithOpenAI(input) {
    const sys = "Du bist ein strenger Normalizer für Fahrzeugschein-/VIN-/Teileingaben. Gib ausschließlich JSON zurück mit den Feldern: vin, make, model, year, engineCode, engineCapacityCcm, fuelType, powerKw, hsn, tsn, notes.";
    const user = `Eingabe:\n${JSON.stringify(input, null, 2)}\nGib ein kompaktes JSON zurück. Wenn Werte fehlen, setze sie auf null.`;
    return chatJson([
        { role: "system", content: sys },
        { role: "user", content: user }
    ]);
}
async function suggestTecdocLookupsWithOpenAI(normalized) {
    const sys = "Plane TecDoc-Aufrufe über den Apify Actor. Gib JSON {steps:[{endpoint:string,params:object}],langId?,countryFilterId?,typeId?}. Nutze, falls nichts bekannt: langId=4, countryFilterId=62, typeId=1.";
    const user = `Normalisierte Daten:\n${JSON.stringify(normalized, null, 2)}\nPlane minimal notwendige Schritte (getManufacturers -> getModels -> getVehicleEngineTypes -> getVehicleDetails).`;
    const plan = await chatJson([
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
