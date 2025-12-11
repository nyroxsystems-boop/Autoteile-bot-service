import { ApifyPartNumberCrossRefSource, OEMResolutionCandidate, OemResolutionInput } from "./sources/apifyPartNumberCrossRefSource";
import { ApifyTecdocSource } from "./sources/apifyTecdocSource";
import { AutodocApifySource } from "../shops/sources/autodocApifySource";
import { DapartoApifySource } from "../shops/sources/dapartoApifySource";
import { MisterAutoApifySource } from "../shops/sources/misterAutoApifySource";
import { RockautoApifySource } from "../shops/sources/rockautoApifySource";
import { OreillyApifySource } from "../shops/sources/oreillyApifySource";
import { AutoZoneApifySource } from "../shops/sources/autoZoneApifySource";
import { ShopProduct, ShopSearchInput, ShopSearchSource } from "../shops/sources/apifyShopSearchSourceBase";
import { buildOemCacheKey } from "./cache/oemCacheKey";
import { InMemoryOemCacheRepository } from "./cache/inMemoryOemCacheRepository";
import { OemCacheRepository } from "./cache/types";
import { refineOemCandidatesWithLlm } from "./llm/refineOemCandidatesWithLlm";
import { ApifyVinDecoder } from "../vehicle/vin/apifyVinDecoder";
import { getBrandOemActorConfig } from "./sources/brandOemActorRegistry";
import { BrandOemCatalogSource } from "./sources/brandOemCatalogSource";

export interface AggregatedOemCandidate {
  oem: string;
  sources: string[];
  rawCandidates: OEMResolutionCandidate[];
  maxConfidence: number;
  avgConfidence: number;
  finalConfidence: number;
}

export interface OemResolutionResult {
  primaryOem?: string;
  primaryConfidence: number;
  candidates: Array<{
    oem: string;
    finalConfidence: number;
    sources: string[];
    rawCandidates: OEMResolutionCandidate[];
  }>;
  fromCache?: boolean;
  debug?: any;
}

function normalizeOem(value: string | undefined | null): string | null {
  if (!value) return null;
  const cleaned = value.toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const stripped = cleaned.replace(/^OE(?=\d)/, "");
  return (stripped || cleaned) || null;
}

let cacheRepo: OemCacheRepository = new InMemoryOemCacheRepository();
let vinDecoder = new ApifyVinDecoder();

export function setOemCacheRepository(repo: OemCacheRepository) {
  cacheRepo = repo;
}

export function setVinDecoder(decoder: ApifyVinDecoder) {
  vinDecoder = decoder;
}

async function collectCandidatesFromAllSources(input: OemResolutionInput): Promise<OEMResolutionCandidate[]> {
  const oemSources = [ApifyPartNumberCrossRefSource, ApifyTecdocSource];
  const shopSources: ShopSearchSource[] = [
    AutodocApifySource,
    DapartoApifySource,
    MisterAutoApifySource,
    RockautoApifySource,
    OreillyApifySource,
    AutoZoneApifySource
  ];

  const brandConfig = getBrandOemActorConfig((input.vehicle as any)?.brand || (input.vehicle as any)?.make);
  const brandSource = brandConfig ? new BrandOemCatalogSource(brandConfig.actorId, brandConfig.displayName) : null;

  const shopInput: ShopSearchInput = {
    vehicle: input.vehicle as any,
    query: input.query,
    locale: input.locale,
    countryCode: input.countryCode
  };

  const calls: Promise<OEMResolutionCandidate[]>[] = [
    ...oemSources.map((s) =>
      s
        .resolve(input)
        .catch(() => [])
    ),
    ...(brandSource
      ? [
          brandSource
            .resolve(input)
            .catch(() => [])
        ]
      : []),
    ...shopSources.map((s) =>
      s
        .search(shopInput)
        .then((products) => mapProductsToCandidates(products, s.name))
        .catch(() => [])
    )
  ];

  const settled = await Promise.allSettled(calls);
  const all: OEMResolutionCandidate[] = [];
  settled.forEach((res) => {
    if (res.status === "fulfilled") {
      all.push(...res.value);
    }
  });
  return all;
}

function mapProductsToCandidates(products: ShopProduct[], sourceName: string): OEMResolutionCandidate[] {
  const candidates: OEMResolutionCandidate[] = [];
  products.forEach((p) => {
    (p.oemNumbers || []).forEach((o) => {
      const norm = normalizeOem(o);
      if (!norm) return;
      candidates.push({
        oemNumber: norm,
        sourceName,
        confidence: 0.6,
        brand: p.brand,
        raw: p
      });
    });
  });
  return candidates;
}

export async function resolveOEM(input: OemResolutionInput): Promise<OemResolutionResult> {
  let enrichedInput = input;
  const needsVinEnrichment =
    input.vehicle?.vin &&
    (!input.vehicle.make && !(input.vehicle as any).brand || !(input.vehicle as any).engineCode || !input.vehicle.model);

  if (needsVinEnrichment) {
    const decoded = await vinDecoder.decode(input.vehicle!.vin!);
    if (decoded) {
      enrichedInput = {
        ...input,
        vehicle: {
          ...(decoded as any),
          ...input.vehicle // prefer existing specifics
        }
      };
    }
  }

  const cacheKey = buildOemCacheKey(input);
  const cached = await cacheRepo.get(cacheKey);
  if (cached && cached.primaryConfidence >= 0.9) {
    const boostedConfidence = Math.min(0.98, cached.primaryConfidence + 0.05);
    return {
      primaryOem: cached.primaryOem,
      primaryConfidence: boostedConfidence,
      candidates: cached.candidates.map((c) => ({
        oem: c.oem,
        finalConfidence: c.finalConfidence,
        sources: c.sources,
        rawCandidates: []
      })),
      fromCache: true,
      debug: { cacheKey }
    };
  }

  const candidates = await collectCandidatesFromAllSources(enrichedInput);
  const grouped = new Map<
    string,
    {
      oem: string;
      sources: Set<string>;
      rawCandidates: OEMResolutionCandidate[];
      maxConfidence: number;
      avgConfidence: number;
    }
  >();

  candidates.forEach((c) => {
    const norm = normalizeOem(c.oemNumber);
    if (!norm) return;
    if (!grouped.has(norm)) {
      grouped.set(norm, {
        oem: norm,
        sources: new Set<string>(),
        rawCandidates: [],
        maxConfidence: 0,
        avgConfidence: 0
      });
    }
    const entry = grouped.get(norm)!;
    entry.sources.add(c.sourceName);
    entry.rawCandidates.push(c);
  });

  let aggregated: AggregatedOemCandidate[] = Array.from(grouped.values()).map((g) => {
    const confidences = g.rawCandidates.map((r) => r.confidence || 0);
    const maxConfidence = Math.max(...confidences, 0);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / (confidences.length || 1);
    const sourcesCount = g.sources.size;
    const base = maxConfidence;
    const bonus = Math.min(0.1, (sourcesCount - 1) * 0.03);
    const finalConfidence = Math.min(0.99, base + bonus);
    return {
      oem: g.oem,
      sources: Array.from(g.sources),
      rawCandidates: g.rawCandidates,
      maxConfidence,
      avgConfidence,
      finalConfidence
    };
  });

  aggregated.sort((a, b) => b.finalConfidence - a.finalConfidence);

  const shouldRefineWithLlm = aggregated.length >= 2 && (aggregated[0]?.finalConfidence ?? 0) < 0.9;
  if (shouldRefineWithLlm) {
    aggregated = await refineOemCandidatesWithLlm(input, aggregated);
  }

  const top = aggregated[0];
  const result: OemResolutionResult = {
    primaryOem: top?.oem,
    primaryConfidence: top?.finalConfidence || 0,
    candidates: aggregated.map((a) => ({
      oem: a.oem,
      finalConfidence: a.finalConfidence,
      sources: a.sources,
      rawCandidates: a.rawCandidates
    })),
    debug: {
      totalCandidates: candidates.length
    }
  };

  if (result.primaryOem && result.primaryConfidence >= 0.9) {
    const entry = {
      key: cacheKey,
      primaryOem: result.primaryOem,
      primaryConfidence: result.primaryConfidence,
      candidates: result.candidates.map((c) => ({
        oem: c.oem,
        finalConfidence: c.finalConfidence,
        sources: c.sources
      })),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await cacheRepo.set(entry);
  }

  return result;
}
