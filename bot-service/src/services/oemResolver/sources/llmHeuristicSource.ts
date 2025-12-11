import { OEMResolverRequest, OEMCandidate } from "../types";
import { OEMSource, clampConfidence, logSourceResult } from "./baseSource";
import OpenAI from "openai";

export const llmHeuristicSource: OEMSource = {
  name: "llm_heuristic",

  async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
    if (!process.env.OPENAI_API_KEY) return [];

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt =
        "Given vehicle data and a part description, suggest plausible OEM numbers or confirm an existing one. " +
        "Respond ONLY with JSON array of {\"oem\":\"...\",\"confidence\":0-1}.\n" +
        `Vehicle: ${JSON.stringify(req.vehicle)}\nPart: ${req.partQuery.rawText}\n` +
        `Normalized category: ${req.partQuery.normalizedCategory ?? "n/a"}\n` +
        "If unsure, return an empty array.";

      const resp = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      });

      const raw = resp.choices[0]?.message?.content ?? "[]";
      let arr: any[] = [];
      try {
        const start = raw.indexOf("[");
        const end = raw.lastIndexOf("]");
        const jsonString = start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;
        arr = JSON.parse(jsonString);
      } catch {
        arr = [];
      }

      const out: OEMCandidate[] = (arr || [])
        .filter((x) => x?.oem)
        .map((x) => ({
          oem: String(x.oem),
          source: this.name,
          confidence: clampConfidence(Number(x.confidence ?? 0.4)),
          meta: { raw: x }
        }));

      logSourceResult(this.name, out.length);
      return out;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`[${this.name}] failed:`, err?.message ?? err);
      return [];
    }
  }
};
