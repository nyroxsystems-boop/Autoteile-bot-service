import { OEMResolverRequest, OEMCandidate } from "../types";
import { OEMSource, clampConfidence, logSourceResult } from "./baseSource";

/**
 * Cache-backed OEM source (intended for Supabase).
 * Currently returns empty; wire up Supabase table (e.g., oem_cache) with key on vehicle + category.
 */
export const cacheSource: OEMSource = {
  name: "cache",

  async resolveCandidates(_req: OEMResolverRequest): Promise<OEMCandidate[]> {
    // TODO: implement Supabase lookup (oem_cache) and return cached OEMs.
    const out: OEMCandidate[] = [];
    logSourceResult(this.name, out.length);
    return out;
  }
};
