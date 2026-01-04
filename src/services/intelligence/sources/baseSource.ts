export type OEMCandidate = {
  oem: string;
  brand?: string | null;
  source: string;
  confidence: number;
  meta?: Record<string, any>;
};

export type OEMSource = {
  name: string;
  resolveCandidates(req: any): Promise<OEMCandidate[]>;
};

export function clampConfidence(v: number): number {
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function logSourceResult(_name: string, _count: number) {
  // noop placeholder for logging helper used in sources
}
