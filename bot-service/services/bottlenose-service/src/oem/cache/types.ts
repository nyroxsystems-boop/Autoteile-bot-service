export interface OemCacheEntryCandidate {
  oem: string;
  finalConfidence: number;
  sources: string[];
}

export interface OemCacheEntry {
  key: string;
  primaryOem: string;
  primaryConfidence: number;
  candidates: OemCacheEntryCandidate[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OemCacheRepository {
  get(key: string): Promise<OemCacheEntry | null>;
  set(entry: OemCacheEntry): Promise<void>;
}
