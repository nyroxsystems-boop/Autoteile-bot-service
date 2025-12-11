import { OemCacheEntry, OemCacheRepository } from "./types";

export class InMemoryOemCacheRepository implements OemCacheRepository {
  private store = new Map<string, OemCacheEntry>();

  async get(key: string): Promise<OemCacheEntry | null> {
    return this.store.get(key) || null;
  }

  async set(entry: OemCacheEntry): Promise<void> {
    const now = new Date();
    const existing = this.store.get(entry.key);
    this.store.set(entry.key, {
      ...entry,
      createdAt: existing?.createdAt || entry.createdAt || now,
      updatedAt: now
    });
  }

  clear(): void {
    this.store.clear();
  }
}
