import { OEMResolverRequest, OEMCandidate } from "../types";

export interface OEMSource {
  name: string;
  resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]>;
}

// Helper to normalize confidence into [0,1]
export function clampConfidence(val: number): number {
  if (Number.isNaN(val)) return 0;
  if (val < 0) return 0;
  if (val > 1) return 1;
  return val;
}

// Helper to log results per source (can later route to real logger)
export function logSourceResult(source: string, count: number) {
  // eslint-disable-next-line no-console
  console.log(`[OEM-Resolver][${source}] candidates: ${count}`);
}
