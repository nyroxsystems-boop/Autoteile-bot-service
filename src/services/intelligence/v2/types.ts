/**
 * OEM Intelligence Engine v2 — Types
 *
 * Clean re-exports of existing types + v2-specific additions.
 * No breaking changes to the existing interface.
 */

// Re-export existing types (keeps backward compatibility)
export type {
  OEMResolverRequest,
  OEMResolverResult,
  OEMCandidate,
} from '../types';

// ============================================================================
// v2-specific Types
// ============================================================================

/** Which layer resolved the OEM */
export type ResolutionLayer = 'database' | 'ai_search' | 'reverse_verified' | 'not_found';

/** Internal pipeline result passed between layers */
export interface PipelineState {
  /** Original request */
  request: import('../types').OEMResolverRequest;
  /** All candidates collected so far */
  candidates: import('../types').OEMCandidate[];
  /** Best candidate (if any) */
  bestCandidate?: import('../types').OEMCandidate;
  /** Which layer resolved it */
  resolvedBy: ResolutionLayer;
  /** Pipeline start time for latency tracking */
  startTime: number;
  /** Whether to skip AI search (DB hit was good enough) */
  skipAiSearch: boolean;
  /** Whether to run reverse verification */
  needsReverseVerify: boolean;
}

/** Confidence scoring breakdown (for debugging/logging) */
export interface ConfidenceBreakdown {
  base: number;
  patternBonus: number;
  groundingBonus: number;
  trustedSourceBonus: number;
  selfConfidenceBonus: number;
  aftermarketPenalty: number;
  reverseVerifyBonus: number;
  final: number;
}

/** Accuracy tracking record */
export interface AccuracyRecord {
  timestamp: string;
  brand: string;
  model: string;
  part: string;
  expectedOem?: string;
  foundOem?: string;
  correct: boolean | null; // null = unknown (no ground truth)
  confidence: number;
  resolvedBy: ResolutionLayer;
  latencyMs: number;
}

/** Reverse verification result */
export interface ReverseVerifyResult {
  verified: boolean;
  matchScore: number;
  brandMatch: boolean;
  modelMatch: boolean;
  partMatch: boolean;
  confidenceAdjustment: number;
  reason: string;
}
