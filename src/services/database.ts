// MOCK DATABASE SERVICE - SQLite removed for stability on Render
// The real database is managed via WAWI/Postgres elsewhere.

export function initDb(): Promise<void> {
    console.log("[DB] Mock database initialized (no-op)");
    return Promise.resolve();
}

export function getDb(): any {
    return null;
}

// Helper for Promisified running
export function run(sql: string, params: any[] = []): Promise<void> {
    return Promise.resolve();
}

export function get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return Promise.resolve(undefined);
}

export function all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return Promise.resolve([]);
}
