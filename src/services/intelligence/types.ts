// tecdocPartsouqFlow type not present in repo; use `any` for now to avoid missing import

export interface OEMResolverRequest {
  orderId: string;
  vehicle: {
    vin?: string;
    hsn?: string;
    tsn?: string;
    make?: string;
    model?: string;
    kw?: number;
    year?: number;
    month?: number;           // Production month (for facelift detection)
    motorcode?: string;       // Engine code (e.g., "CJSA", "CRLB")
    prCodes?: string[];       // VAG PR-Codes (e.g., ["1ZD", "1BH"])
    faceliftStatus?: 'PRE_FL' | 'POST_FL' | 'LCI' | 'MOPF' | 'UNKNOWN';
  };
  partQuery: {
    rawText: string; // e.g. "Zündkerzen vorne BMW 316ti"
    normalizedCategory?: string; // e.g. "spark_plug" (LLM-normalized)
    suspectedNumber?: string | null; // optional OE/Artikelnummer aus User-Text
    partCategory?: string; // Detected category for PR/Motor-based lookup
  };
}

export interface OEMCandidate {
  oem: string;
  brand?: string | null;
  source: string; // e.g. "tecdoc_light", "shop_autodoc", "llm_inferred"
  confidence: number; // 0.0–1.0
  meta?: Record<string, any>;
}

export interface OEMResolverResult {
  primaryOEM?: string;
  candidates: OEMCandidate[];
  overallConfidence: number;
  notes?: string;
  tecdocPartsouqResult?: any;

  // Deep OEM Resolution (10/10 Premium)
  deepResolution?: {
    vinDecoded?: boolean;
    prCodeUsed?: string;
    motorcodeUsed?: string;
    faceliftStatus?: string;
    supersessionApplied?: boolean;
    originalOEM?: string; // If superseded, this was the original
  };
}
