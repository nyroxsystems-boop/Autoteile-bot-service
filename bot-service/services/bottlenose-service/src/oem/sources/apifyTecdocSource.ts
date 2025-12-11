import { createApifyClient } from "../../integrations/apify/apifyClient";
import { OEMResolutionCandidate, OEMSource, OemResolutionInput } from "./apifyPartNumberCrossRefSource";

interface TecdocActorInput {
  vin?: string;
  kbaCode?: string;
  brand?: string;
  model?: string;
  engineCode?: string;
  year?: number;
  language?: string;
  country?: string;
  partCategory?: string;
}

interface TecdocActorResultItem {
  oemNumbers?: string[];
  brand?: string;
  articleNumber?: string;
  description?: string;
  manufacturer?: string;
  matchedByVin?: boolean;
  meta?: Record<string, any>;
}

function normalizeOem(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.toString().trim().toUpperCase().replace(/\s+/g, "");
}

function deriveBaseConfidence(input: OemResolutionInput, item: TecdocActorResultItem, multipleOems: boolean): number {
  const hasVin = Boolean(input.vehicle?.vin || item.matchedByVin);
  const hasKba = Boolean((input.vehicle as any)?.hsnTsn);
  const hasBasic = Boolean((input.vehicle as any)?.brand || input.vehicle?.make || input.vehicle?.model || input.vehicle?.year);

  let base = 0.7;
  if (hasVin || hasKba) base = 0.9;
  else if (hasBasic) base = 0.8;

  if (multipleOems) {
    // Slightly lower to let downstream scoring/LLM pick the best
    base = Math.min(base, 0.75);
    base = Math.max(base, 0.65);
  }

  return base;
}

export const ApifyTecdocSource: OEMSource = {
  name: "apify:tecdoc",

  async resolve(input: OemResolutionInput): Promise<OEMResolutionCandidate[]> {
    const client = createApifyClient();
    const actorInput: TecdocActorInput = {
      vin: input.vehicle?.vin,
      kbaCode: (input.vehicle as any)?.hsnTsn,
      brand: (input.vehicle as any)?.brand || input.vehicle?.make,
      model: input.vehicle?.model,
      engineCode: (input.vehicle as any)?.engineCode,
      year: input.vehicle?.year,
      language: input.locale,
      country: input.countryCode,
      partCategory: input.query
    };

    try {
      const items = (await client.callActor<any, TecdocActorResultItem[]>("tecdoc-car-parts", actorInput)) || [];
      if (!Array.isArray(items) || items.length === 0) return [];

      const candidates: OEMResolutionCandidate[] = [];

      items.forEach((item) => {
        const oems = item.oemNumbers || [];
        const normalizedOems = oems.map((o) => normalizeOem(o)).filter(Boolean) as string[];
        if (normalizedOems.length === 0) return;

        const baseConfidence = deriveBaseConfidence(input, item, normalizedOems.length > 1);

        normalizedOems.forEach((oem) => {
          candidates.push({
            oemNumber: oem,
            sourceName: this.name,
            confidence: baseConfidence,
            brand: item.brand,
            manufacturer: item.manufacturer,
            raw: item
          });
        });
      });

      return candidates;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`[${this.name}] failed`, err?.message ?? err);
      return [];
    }
  }
};
