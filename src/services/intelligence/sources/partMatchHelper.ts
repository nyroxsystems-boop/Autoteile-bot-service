import { OEMResolverRequest, OEMCandidate } from "../types";
import { logger } from "@utils/logger";
import { generateChatCompletion } from "../geminiService";

/**
 * STRATEGY: "Reverse-Aftermarket-Lookup"
 * 1. Ask LLM for the specific Aftermarket Number (e.g. MANN CUK 2939).
 * 2. Search for that Aftermarket Number to finding the linked OEM.
 * 3. Return the linked OEM as a high-confidence candidate.
 * 
 * MIGRATED: OpenAI → Gemini (Feb 2026)
 */
export async function resolveAftermarketToOEM(req: OEMResolverRequest): Promise<OEMCandidate[]> {
  const prompt = `
      You are a spare parts expert.
      Vehicle: ${req.vehicle.make} ${req.vehicle.model} (${req.vehicle.kw} kW, Year ${req.vehicle.year})
      Part: ${req.partQuery.rawText}
      
      Task:
      1. Identify the most likely Premium Aftermarket Part Number (MANN, BOSCH, ATE, TRW, etc.) for this exact car.
      2. Convert that Aftermarket Number to the corresponding OEM Number.
      
      Return JSON:
      {
        "candidates": [
           { "oem": "12345", "confidence": 0.8, "reason": "Derived from MANN CUK 123" }
        ]
      }
    `;

  try {
    const content = await generateChatCompletion({
      messages: [{ role: "user", content: prompt }],
      responseFormat: "json_object",
      temperature: 0
    });
    const json = JSON.parse(content || "{}");
    return (json.candidates || []).map((c: any) => ({
      oem: c.oem,
      source: "aftermarket_reverse_lookup",
      confidence: c.confidence || 0.6,
      meta: { reason: c.reason }
    }));
  } catch { return []; }
}

export async function filterByPartMatch(candidates: OEMCandidate[], req: any): Promise<OEMCandidate[]> {
  // If no candidates, nothing to filter
  if (candidates.length === 0) return [];

  // If we have a lot of candidates, we only check the top 5 to save tokens/time
  const toCheck = candidates.slice(0, 5);

  const prompt = `
    You are an automotive parts expert.
    User queries for part: "${req.partQuery.rawText}"
    Vehicle: "${req.vehicle.make} ${req.vehicle.model}"
    
    Found OEM Candidates:
    ${toCheck.map(c => `- ${c.oem} (Source: ${c.source})`).join("\n")}
    
    TASK: You must be extremely skeptical. Return a JSON array of strings containing ONLY the OEM numbers that definitely correspond to the USER'S REQUESTED PART TYPE for this specific vehicle.
    
    WARNING (Cross-Category Contamination): 
    Search engines often return nearby parts (e.g., if user asks for "Air Filter", ignore "Oil Filter", "Brake Pad", or "Spark Plug" results).
    Only return numbers where you are 95% certain they represent the correct part category.
    
    Response format: {"valid_oems": ["OEM1", "OEM2"]}
  `;

  try {
    const content = await generateChatCompletion({
      messages: [{ role: "user", content: prompt }],
      responseFormat: "json_object",
      temperature: 0
    });

    if (!content) return candidates;

    const parsed = JSON.parse(content);
    // Handle both array format or object with key format
    const validOems = new Set<string>(Array.isArray(parsed) ? parsed : (parsed.oems || parsed.valid_oems || Object.values(parsed)[0] || []));

    if (validOems.size === 0) return candidates; // Conservative fallback

    return candidates.filter(c => validOems.has(c.oem) || !toCheck.includes(c));
  } catch (e) {
    return candidates;
  }
}
