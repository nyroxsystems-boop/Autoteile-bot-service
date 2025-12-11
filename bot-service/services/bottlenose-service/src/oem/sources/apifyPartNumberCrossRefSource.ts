import { createApifyClient } from "../../integrations/apify/apifyClient";

export interface OemResolutionInput {
  vehicle: {
    vin?: string;
    hsn?: string;
    tsn?: string;
    make?: string;
    model?: string;
    kw?: number;
    year?: number;
  } | null;
  query: string;
  oemHint?: string;
  locale?: string;
  countryCode?: string;
}

export interface OEMResolutionCandidate {
  oemNumber: string;
  sourceName: string;
  confidence: number;
  brand?: string;
  manufacturer?: string;
  raw?: any;
}

export interface OEMSource {
  name: string;
  resolve(input: OemResolutionInput): Promise<OEMResolutionCandidate[]>;
}

interface PartCrossRefActorInput {
  searchType: "OEM" | "AFTERMARKET";
  partNumber: string;
  country?: string;
  language?: string;
}

interface PartCrossRefActorResultItem {
  sourceOem: string;
  equivalentOem?: string;
  manufacturer?: string;
  brand?: string;
  partNumber: string;
  score?: number;
  meta?: Record<string, any>;
}

function normalizeOem(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.toString().trim().toUpperCase().replace(/\s+/g, "");
}

function aggregateConfidence(items: string[], hint?: string): number {
  if (!items.length) return 0;
  const counts = items.reduce<Record<string, number>>((acc, o) => {
    acc[o] = (acc[o] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  let base = 0.6;
  if (top && top[1] > 1) base = 0.8;
  if (hint && top && top[0] === normalizeOem(hint)) base = 0.9;
  return base;
}

export const ApifyPartNumberCrossRefSource: OEMSource = {
  name: "apify:part-cross-ref",

  async resolve(input: OemResolutionInput): Promise<OEMResolutionCandidate[]> {
    const client = createApifyClient();
    const partNumber = normalizeOem(input.oemHint) || normalizeOem(input.query);
    if (!partNumber) return [];

    const actorInput: PartCrossRefActorInput = {
      searchType: input.oemHint ? "OEM" : "AFTERMARKET",
      partNumber,
      country: input.countryCode,
      language: input.locale
    };

    try {
      const items = (await client.callActor<any, PartCrossRefActorResultItem[]>("part-number-cross-reference", actorInput)) || [];
      if (!Array.isArray(items) || items.length === 0) return [];

      const normalized = items
        .map((it) => normalizeOem(it.equivalentOem || it.partNumber || it.sourceOem))
        .filter((oem): oem is string => Boolean(oem));

      const baseConfidence = aggregateConfidence(normalized, input.oemHint);

      const candidates = items
        .map((it) => {
          const oem = normalizeOem(it.equivalentOem || it.partNumber || it.sourceOem);
          if (!oem) return null;
          let confidence = baseConfidence;
          if (it.score && it.score > 0) {
            confidence = Math.max(confidence, Math.min(1, 0.6 + it.score / 100));
          }
          if (input.oemHint && oem === normalizeOem(input.oemHint)) {
            confidence = Math.max(confidence, 0.9);
          }
          return {
            oemNumber: oem,
            sourceName: this.name,
            confidence,
            brand: it.brand,
            manufacturer: it.manufacturer,
            raw: it
          };
        })
        .filter(Boolean) as OEMResolutionCandidate[];

      return candidates;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`[${this.name}] failed`, err?.message ?? err);
      return [];
    }
  }
};
