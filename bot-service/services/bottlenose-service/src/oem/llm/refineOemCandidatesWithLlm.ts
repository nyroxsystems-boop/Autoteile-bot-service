import { createOpenAiClient } from "../../llm/openAiClient";
import type { AggregatedOemCandidate } from "../resolveOEM";
import type { OemResolutionInput } from "../sources/apifyPartNumberCrossRefSource";

function buildPrompt(input: OemResolutionInput, candidates: AggregatedOemCandidate[]): string {
  const vehicle = input.vehicle || {};
  const vehicleDesc = JSON.stringify({
    vin: vehicle.vin,
    brand: (vehicle as any).brand || (vehicle as any).make,
    model: (vehicle as any).model,
    engineCode: (vehicle as any).engineCode,
    year: vehicle.year
  });

  const candidateList = candidates.map((c) => ({
    oem: c.oem,
    confidence: c.finalConfidence,
    sources: c.sources
  }));

  return [
    "You are validating OEM part numbers for an automotive parts request.",
    "Return JSON with a `candidates` array of {\"oem\": string, \"score\": number between 0 and 1}.",
    "Do not add any text outside JSON.",
    `Vehicle: ${vehicleDesc}`,
    `Part query: ${input.query}`,
    `Candidates: ${JSON.stringify(candidateList)}`
  ].join("\n");
}

function safeParseScores(raw: string): Record<string, number> | null {
  try {
    const match = raw.match(/{[\s\S]*}/);
    const obj = JSON.parse(match ? match[0] : raw);
    if (!obj || !Array.isArray(obj.candidates)) return null;
    const map: Record<string, number> = {};
    obj.candidates.forEach((c: any) => {
      if (c?.oem && typeof c.score === "number") {
        map[String(c.oem).toUpperCase().replace(/[^A-Z0-9]/g, "")] = Math.max(0, Math.min(1, c.score));
      }
    });
    return map;
  } catch (_e) {
    return null;
  }
}

export async function refineOemCandidatesWithLlm(
  input: OemResolutionInput,
  candidates: AggregatedOemCandidate[]
): Promise<AggregatedOemCandidate[]> {
  if (candidates.length === 0) return candidates;
  if (process.env.ENABLE_OEM_LLM_VALIDATION === "false") return candidates;

  try {
    const client = createOpenAiClient();
    const prompt = buildPrompt(input, candidates);
    const completion = await client.chat(prompt, { temperature: 0 });
    const scores = safeParseScores(completion);
    if (!scores) return candidates;

    const refined = candidates.map((c) => {
      const key = c.oem.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const llmScore = scores[key];
      if (typeof llmScore !== "number") return c;
      const combined = 0.5 * c.finalConfidence + 0.5 * llmScore;
      return { ...c, finalConfidence: combined };
    });
    refined.sort((a, b) => b.finalConfidence - a.finalConfidence);
    return refined;
  } catch (_err) {
    return candidates;
  }
}
