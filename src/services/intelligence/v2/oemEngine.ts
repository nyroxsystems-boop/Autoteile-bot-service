/**
 * 🚀 OEM ENGINE v2 — Main Orchestrator
 *
 * Single entry point for OEM resolution. Clean 3-layer architecture:
 *
 *   Layer 1: Database Lookup     (<10ms, instant, highest confidence)
 *   Layer 2: AI Search           (2-5s, 1 Gemini Grounded call)
 *   Layer 3: Validation          (local + optional reverse-verify)
 *   Layer 4: Self-Learning       (async, non-blocking)
 *
 * Max AI calls per request: 2 (search + reverse-verify)
 * Typical AI calls: 1 (search only, reverse-verify skipped for high/low confidence)
 * DB-hit path: 0 AI calls
 *
 * Target: 90% accuracy with measurable tracking.
 */

import { OEMResolverRequest, OEMResolverResult, OEMCandidate } from '../types';
import { lookupFromDatabase, DB_SKIP_AI_THRESHOLD } from './databaseLayer';
import { searchWithAi } from './aiSearchAgent';
import { validateLocally, reverseVerify, needsReverseVerification, ACCEPT_THRESHOLD } from './validator';
import { learnOem } from './learner';
import { logger } from '@utils/logger';
import type { ResolutionLayer } from './types';

// ============================================================================
// Configuration
// ============================================================================

/** Global timeout for entire pipeline */
const PIPELINE_TIMEOUT_MS = 15000;

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Resolve an OEM number using the v2 intelligence engine.
 * Drop-in replacement for `resolveOemApex()`.
 */
export async function resolveOemV2(req: OEMResolverRequest): Promise<OEMResolverResult> {
  const startTime = Date.now();

  logger.info('[v2 Engine] 🚀 Pipeline started', {
    brand: req.vehicle.make,
    model: req.vehicle.model,
    year: req.vehicle.year,
    part: req.partQuery.rawText.slice(0, 60),
  });

  // Global timeout
  const timeoutPromise = new Promise<OEMResolverResult>((_, reject) =>
    setTimeout(() => reject(new Error(`v2 pipeline timeout after ${PIPELINE_TIMEOUT_MS}ms`)), PIPELINE_TIMEOUT_MS)
  );

  try {
    return await Promise.race([
      runPipeline(req, startTime),
      timeoutPromise,
    ]);
  } catch (err: any) {
    logger.error('[v2 Engine] Pipeline timeout/error', {
      error: err?.message,
      elapsed: Date.now() - startTime,
    });
    return {
      primaryOEM: undefined,
      candidates: [],
      overallConfidence: 0,
      notes: `v2 Engine error: ${err?.message}`,
    };
  }
}

// ============================================================================
// Pipeline
// ============================================================================

async function runPipeline(req: OEMResolverRequest, startTime: number): Promise<OEMResolverResult> {
  const brand = req.vehicle.make?.toUpperCase() || '';
  let allCandidates: OEMCandidate[] = [];
  let resolvedBy: ResolutionLayer = 'not_found';

  // ================================================================
  // LAYER 1: Database Lookup (<10ms)
  // ================================================================
  const dbResult = lookupFromDatabase(req);
  allCandidates.push(...dbResult.candidates);

  if (dbResult.highConfidenceHit && dbResult.topCandidate) {
    // High-confidence DB hit → skip AI entirely
    const oem = dbResult.topCandidate.oem;
    const conf = dbResult.topCandidate.confidence;
    resolvedBy = 'database';

    logger.info('[v2 Engine] ⚡ Database HIT — skipping AI', {
      oem,
      confidence: conf,
      elapsed: Date.now() - startTime,
    });

    // Still learn (reinforces the record)
    learnOem(oem, conf, 'v2_database', req);

    return buildResult(oem, conf, allCandidates, resolvedBy, startTime);
  }

  // ================================================================
  // LAYER 2: AI Search (1 Gemini Grounded Call)
  // ================================================================
  const aiResult = await searchWithAi(req);
  allCandidates.push(...aiResult.candidates);

  if (!aiResult.topCandidate || aiResult.candidates.length === 0) {
    // No AI result either
    logger.info('[v2 Engine] No candidates from AI search', {
      elapsed: Date.now() - startTime,
    });
    return buildResult(undefined, 0, allCandidates, 'not_found', startTime);
  }

  // Merge DB + AI candidates (deduplicate, keep highest confidence)
  allCandidates = deduplicateCandidates(allCandidates);

  // Get the best candidate
  let bestCandidate = allCandidates[0];
  let bestConfidence = bestCandidate.confidence;
  resolvedBy = 'ai_search';

  // ================================================================
  // LAYER 3: Validation
  // ================================================================

  // 3a: Local validation (pattern + aftermarket, <1ms)
  const localValidation = validateLocally(bestCandidate, brand);
  bestConfidence = localValidation.confidence;

  if (!localValidation.isValid && allCandidates.length > 1) {
    // Try second-best candidate
    for (let i = 1; i < Math.min(allCandidates.length, 3); i++) {
      const altValidation = validateLocally(allCandidates[i], brand);
      if (altValidation.isValid && altValidation.confidence > bestConfidence) {
        bestCandidate = allCandidates[i];
        bestConfidence = altValidation.confidence;
        break;
      }
    }
  }

  // 3b: Reverse verification (optional, only for gray-zone confidence)
  if (needsReverseVerification(bestConfidence)) {
    logger.info('[v2 Engine] 🔄 Running reverse verification', {
      oem: bestCandidate.oem,
      confidence: bestConfidence,
    });

    const reverseResult = await reverseVerify(bestCandidate.oem, req);

    // Apply confidence adjustment
    bestConfidence = Math.max(0, Math.min(0.99,
      bestConfidence + reverseResult.confidenceAdjustment
    ));

    if (reverseResult.verified) {
      resolvedBy = 'reverse_verified';
    }

    // Update candidate meta
    bestCandidate = {
      ...bestCandidate,
      confidence: bestConfidence,
      meta: {
        ...bestCandidate.meta,
        reverseVerified: reverseResult.verified,
        reverseMatchScore: reverseResult.matchScore,
        reverseConfAdj: reverseResult.confidenceAdjustment,
      },
    };
  }

  // ================================================================
  // Decision: Accept or reject
  // ================================================================
  const accepted = bestConfidence >= ACCEPT_THRESHOLD;
  const finalOem = accepted ? bestCandidate.oem : undefined;

  // ================================================================
  // LAYER 4: Self-Learning (async, non-blocking)
  // ================================================================
  if (finalOem) {
    learnOem(finalOem, bestConfidence, `v2_${resolvedBy}`, req);
  }

  const result = buildResult(finalOem, bestConfidence, allCandidates, resolvedBy, startTime);

  logger.info('[v2 Engine] ✅ Pipeline complete', {
    oem: finalOem || 'NOT_FOUND',
    confidence: Math.round(bestConfidence * 100) + '%',
    resolvedBy,
    candidateCount: allCandidates.length,
    aiCalls: resolvedBy === 'reverse_verified' ? 2 : 1,
    elapsed: Date.now() - startTime,
  });

  return result;
}

// ============================================================================
// Helpers
// ============================================================================

function deduplicateCandidates(candidates: OEMCandidate[]): OEMCandidate[] {
  const map = new Map<string, OEMCandidate>();

  for (const c of candidates) {
    const key = c.oem.replace(/[-\s.]/g, '').toUpperCase();
    const existing = map.get(key);

    if (!existing || c.confidence > existing.confidence) {
      map.set(key, c);
    } else if (existing && c.source !== existing.source) {
      // Same OEM from multiple sources → boost confidence
      const boosted = Math.min(
        existing.confidence + 0.05,
        Math.max(existing.confidence, c.confidence) + 0.10,
        0.99,
      );
      existing.confidence = boosted;
      existing.source = `${existing.source}+${c.source}`;
      existing.meta = {
        ...existing.meta,
        multiSource: true,
        sourceCount: (existing.meta?.sourceCount || 1) + 1,
      };
    }
  }

  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

function buildResult(
  oem: string | undefined,
  confidence: number,
  candidates: OEMCandidate[],
  resolvedBy: ResolutionLayer,
  startTime: number,
): OEMResolverResult {
  return {
    primaryOEM: oem,
    candidates,
    overallConfidence: oem ? confidence : 0,
    notes: oem
      ? `v2 Engine: ${resolvedBy} (${Math.round(confidence * 100)}%)`
      : `v2 Engine: No OEM found with sufficient confidence. Layer: ${resolvedBy}`,
  };
}
