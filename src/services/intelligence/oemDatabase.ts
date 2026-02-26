/**
 * 🏆 ENTERPRISE OEM DATABASE
 * SQLite-based OEM storage for instant lookups
 * 
 * Features:
 * - ~500k+ OEM records
 * - <10ms lookup time
 * - Full-text search on descriptions
 * - Indexed on brand+model+category
 */

import Database from 'better-sqlite3';
import { logger } from '@utils/logger';
import path from 'path';
import fs from 'fs';

// ============================================================================
// Types
// ============================================================================

export interface OEMRecord {
    id?: number;
    oem: string;                    // Normalized OEM number
    brand: string;                  // VW, BMW, Mercedes...
    model?: string;                 // Golf 7, 3er F30...
    modelCode?: string;             // 5G, F30, W205...
    yearFrom?: number;
    yearTo?: number;
    partCategory: string;           // brake, filter, suspension...
    partDescription: string;        // Bremsscheibe vorne 340mm
    supersededBy?: string;          // Successor OEM
    supersedes?: string;            // Predecessor OEM
    sources: string[];              // Where scraped from
    confidence: number;             // 0-1
    lastVerified: string;           // ISO date
    hitCount: number;               // Query count
}

export interface OEMLookupParams {
    brand?: string;
    model?: string;
    modelCode?: string;
    category?: string;
    year?: number;
    searchText?: string;
    limit?: number;
}

export interface OEMLookupResult {
    oem: string;
    confidence: number;
    source: string;
    description: string;
    supersededBy?: string;
}

// ============================================================================
// Database Path
// ============================================================================

const DB_PATH = path.join(
    process.env.OEM_DATA_PATH ||
    path.join(__dirname, '../../../../oem-data'),
    'oem-database.sqlite'
);

// ============================================================================
// Database Class
// ============================================================================

class OEMDatabase {
    private db: Database.Database | null = null;
    private initialized = false;

    constructor() {
        // Lazy init
    }

    private ensureInit(): Database.Database {
        if (this.db && this.initialized) return this.db;

        // Ensure directory exists
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(DB_PATH);
        this.db.pragma('journal_mode = WAL'); // Fast writes
        this.db.pragma('synchronous = NORMAL');

        this.createTables();
        this.initialized = true;

        // Auto-seed if database is empty (first run)
        this.autoSeedIfEmpty();

        logger.info(`[OEMDatabase] Initialized at ${DB_PATH}`);
        return this.db;
    }

    /**
     * Auto-seeds verified OEM data on first run.
     * Checks if DB is empty, then bulk-inserts all verified OEMs.
     * This ensures the 300+ curated entries are always available.
     */
    private autoSeedIfEmpty(): void {
        try {
            const countStmt = this.db!.prepare('SELECT COUNT(*) as count FROM oem_records');
            const { count } = countStmt.get() as any;

            if (count > 0) {
                logger.info(`[OEMDatabase] Already seeded (${count} records)`);
                return;
            }

            logger.info('[OEMDatabase] 🌱 Empty database detected — auto-seeding verified OEM data...');

            // Inline require to avoid circular dependency with oemDataSeeder
            const { ALL_VERIFIED_OEMS } = require('./verifiedOemData');

            const insert = this.db!.prepare(`
                INSERT OR IGNORE INTO oem_records (
                    oem, brand, model, model_code, year_from, year_to,
                    part_category, part_description, superseded_by, supersedes,
                    sources, confidence, last_verified, hit_count
                ) VALUES (
                    @oem, @brand, @model, @modelCode, @yearFrom, @yearTo,
                    @partCategory, @partDescription, @supersededBy, @supersedes,
                    @sources, @confidence, @lastVerified, @hitCount
                )
            `);

            const insertMany = this.db!.transaction((records: any[]) => {
                let seeded = 0;
                for (const record of records) {
                    insert.run({
                        oem: record.oem,
                        brand: record.brand.toUpperCase(),
                        model: record.model || null,
                        modelCode: record.modelCode || null,
                        yearFrom: record.yearFrom || null,
                        yearTo: record.yearTo || null,
                        partCategory: record.partCategory,
                        partDescription: record.partDescription || '',
                        supersededBy: record.supersededBy || null,
                        supersedes: record.supersedes || null,
                        sources: JSON.stringify(record.sources || []),
                        confidence: record.confidence || 0.5,
                        lastVerified: record.lastVerified || new Date().toISOString(),
                        hitCount: record.hitCount || 0,
                    });
                    seeded++;
                }
                return seeded;
            });

            const seeded = insertMany(ALL_VERIFIED_OEMS);
            logger.info(`[OEMDatabase] ✅ Auto-seeded ${seeded} verified OEM records`);

        } catch (err: any) {
            // Non-fatal — system works without seed data, just slower
            logger.warn('[OEMDatabase] Auto-seed failed (non-fatal)', { error: err?.message });
        }
    }

    private createTables(): void {
        const db = this.db!;

        // Main OEM table
        db.exec(`
            CREATE TABLE IF NOT EXISTS oem_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                oem TEXT NOT NULL,
                brand TEXT NOT NULL,
                model TEXT,
                model_code TEXT,
                year_from INTEGER,
                year_to INTEGER,
                part_category TEXT NOT NULL,
                part_description TEXT,
                superseded_by TEXT,
                supersedes TEXT,
                sources TEXT,
                confidence REAL DEFAULT 0.5,
                last_verified TEXT,
                hit_count INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Indexes for fast lookup
        db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_oem_brand_category ON oem_records(oem, brand, part_category);
            CREATE INDEX IF NOT EXISTS idx_oem ON oem_records(oem);
            CREATE INDEX IF NOT EXISTS idx_brand ON oem_records(brand);
            CREATE INDEX IF NOT EXISTS idx_brand_model ON oem_records(brand, model);
            CREATE INDEX IF NOT EXISTS idx_brand_category ON oem_records(brand, part_category);
            CREATE INDEX IF NOT EXISTS idx_brand_model_category ON oem_records(brand, model, part_category);
            CREATE INDEX IF NOT EXISTS idx_model_code ON oem_records(model_code);
        `);

        // Full-text search on descriptions
        db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS oem_fts USING fts5(
                oem, brand, model, part_category, part_description,
                content='oem_records',
                content_rowid='id'
            )
        `);

        // Triggers to keep FTS in sync
        db.exec(`
            CREATE TRIGGER IF NOT EXISTS oem_ai AFTER INSERT ON oem_records BEGIN
                INSERT INTO oem_fts(rowid, oem, brand, model, part_category, part_description)
                VALUES (new.id, new.oem, new.brand, new.model, new.part_category, new.part_description);
            END;
            
            CREATE TRIGGER IF NOT EXISTS oem_ad AFTER DELETE ON oem_records BEGIN
                INSERT INTO oem_fts(oem_fts, rowid, oem, brand, model, part_category, part_description)
                VALUES ('delete', old.id, old.oem, old.brand, old.model, old.part_category, old.part_description);
            END;
            
            CREATE TRIGGER IF NOT EXISTS oem_au AFTER UPDATE ON oem_records BEGIN
                INSERT INTO oem_fts(oem_fts, rowid, oem, brand, model, part_category, part_description)
                VALUES ('delete', old.id, old.oem, old.brand, old.model, old.part_category, old.part_description);
                INSERT INTO oem_fts(rowid, oem, brand, model, part_category, part_description)
                VALUES (new.id, new.oem, new.brand, new.model, new.part_category, new.part_description);
            END;
        `);

        // Supersession table
        db.exec(`
            CREATE TABLE IF NOT EXISTS supersessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                old_oem TEXT NOT NULL,
                new_oem TEXT NOT NULL,
                brand TEXT,
                source TEXT,
                verified INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(old_oem, new_oem)
            )
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_super_old ON supersessions(old_oem);
            CREATE INDEX IF NOT EXISTS idx_super_new ON supersessions(new_oem);
        `);

        logger.info('[OEMDatabase] Tables and indexes created');
    }

    // ========================================================================
    // CRUD Operations
    // ========================================================================

    /**
     * Insert or update an OEM record
     */
    upsert(record: OEMRecord): number {
        const db = this.ensureInit();

        const stmt = db.prepare(`
            INSERT INTO oem_records (
                oem, brand, model, model_code, year_from, year_to,
                part_category, part_description, superseded_by, supersedes,
                sources, confidence, last_verified, hit_count
            ) VALUES (
                @oem, @brand, @model, @modelCode, @yearFrom, @yearTo,
                @partCategory, @partDescription, @supersededBy, @supersedes,
                @sources, @confidence, @lastVerified, @hitCount
            )
            ON CONFLICT(oem, brand, part_category) DO UPDATE SET
                model = COALESCE(@model, model),
                model_code = COALESCE(@modelCode, model_code),
                part_description = COALESCE(@partDescription, part_description),
                superseded_by = COALESCE(@supersededBy, superseded_by),
                sources = @sources,
                confidence = MAX(confidence, @confidence),
                last_verified = @lastVerified,
                hit_count = hit_count + 1,
                updated_at = CURRENT_TIMESTAMP
        `);

        const result = stmt.run({
            oem: record.oem,
            brand: record.brand.toUpperCase(),
            model: record.model || null,
            modelCode: record.modelCode || null,
            yearFrom: record.yearFrom || null,
            yearTo: record.yearTo || null,
            partCategory: record.partCategory,
            partDescription: record.partDescription || '',
            supersededBy: record.supersededBy || null,
            supersedes: record.supersedes || null,
            sources: JSON.stringify(record.sources || []),
            confidence: record.confidence || 0.5,
            lastVerified: record.lastVerified || new Date().toISOString(),
            hitCount: record.hitCount || 0,
        });

        return result.lastInsertRowid as number;
    }

    /**
     * Bulk insert records (much faster)
     */
    bulkInsert(records: OEMRecord[]): number {
        const db = this.ensureInit();

        const insert = db.prepare(`
            INSERT OR REPLACE INTO oem_records (
                oem, brand, model, model_code, year_from, year_to,
                part_category, part_description, superseded_by, supersedes,
                sources, confidence, last_verified, hit_count
            ) VALUES (
                @oem, @brand, @model, @modelCode, @yearFrom, @yearTo,
                @partCategory, @partDescription, @supersededBy, @supersedes,
                @sources, @confidence, @lastVerified, @hitCount
            )
        `);

        const insertMany = db.transaction((recs: OEMRecord[]) => {
            let count = 0;
            for (const record of recs) {
                insert.run({
                    oem: record.oem,
                    brand: record.brand.toUpperCase(),
                    model: record.model || null,
                    modelCode: record.modelCode || null,
                    yearFrom: record.yearFrom || null,
                    yearTo: record.yearTo || null,
                    partCategory: record.partCategory,
                    partDescription: record.partDescription || '',
                    supersededBy: record.supersededBy || null,
                    supersedes: record.supersedes || null,
                    sources: JSON.stringify(record.sources || []),
                    confidence: record.confidence || 0.5,
                    lastVerified: record.lastVerified || new Date().toISOString(),
                    hitCount: record.hitCount || 0,
                });
                count++;
            }
            return count;
        });

        return insertMany(records);
    }

    /**
     * Look up OEM by criteria
     */
    lookup(params: OEMLookupParams): OEMLookupResult[] {
        const db = this.ensureInit();

        const conditions: string[] = [];
        const bindings: Record<string, any> = {};

        if (params.brand) {
            conditions.push('brand = @brand');
            bindings.brand = params.brand.toUpperCase();
        }
        if (params.model) {
            conditions.push('(model LIKE @model OR model_code = @modelCode)');
            bindings.model = `%${params.model}%`;
            bindings.modelCode = params.model.toUpperCase();
        }
        if (params.category) {
            conditions.push('part_category = @category');
            bindings.category = params.category;
        }
        if (params.year) {
            conditions.push('(year_from IS NULL OR year_from <= @year)');
            conditions.push('(year_to IS NULL OR year_to >= @year)');
            bindings.year = params.year;
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const limit = params.limit || 20;

        const stmt = db.prepare(`
            SELECT oem, brand, model, part_category, part_description, 
                   superseded_by, sources, confidence
            FROM oem_records
            ${whereClause}
            ORDER BY confidence DESC, hit_count DESC
            LIMIT @limit
        `);

        const rows = stmt.all({ ...bindings, limit }) as any[];

        // Increment hit count for returned results
        if (rows.length > 0) {
            const updateHits = db.prepare(`
                UPDATE oem_records SET hit_count = hit_count + 1 
                WHERE oem IN (${rows.map(() => '?').join(',')})
            `);
            updateHits.run(rows.map(r => r.oem));
        }

        return rows.map(row => ({
            oem: row.oem,
            confidence: row.confidence,
            source: 'database',
            description: row.part_description,
            supersededBy: row.superseded_by,
        }));
    }

    /**
     * Full-text search
     */
    search(query: string, limit: number = 20): OEMLookupResult[] {
        const db = this.ensureInit();

        const stmt = db.prepare(`
            SELECT r.oem, r.brand, r.model, r.part_category, r.part_description,
                   r.superseded_by, r.sources, r.confidence
            FROM oem_fts f
            JOIN oem_records r ON f.rowid = r.id
            WHERE oem_fts MATCH @query
            ORDER BY rank, r.confidence DESC
            LIMIT @limit
        `);

        const rows = stmt.all({ query, limit }) as any[];

        return rows.map(row => ({
            oem: row.oem,
            confidence: row.confidence,
            source: 'database-fts',
            description: row.part_description,
            supersededBy: row.superseded_by,
        }));
    }

    /**
     * Get exact OEM by number
     */
    getByOEM(oem: string): OEMRecord | null {
        const db = this.ensureInit();

        const stmt = db.prepare(`
            SELECT * FROM oem_records WHERE oem = @oem LIMIT 1
        `);

        const row = stmt.get({ oem: oem.toUpperCase() }) as any;
        if (!row) return null;

        return {
            id: row.id,
            oem: row.oem,
            brand: row.brand,
            model: row.model,
            modelCode: row.model_code,
            yearFrom: row.year_from,
            yearTo: row.year_to,
            partCategory: row.part_category,
            partDescription: row.part_description,
            supersededBy: row.superseded_by,
            supersedes: row.supersedes,
            sources: JSON.parse(row.sources || '[]'),
            confidence: row.confidence,
            lastVerified: row.last_verified,
            hitCount: row.hit_count,
        };
    }

    /**
     * Register supersession
     */
    registerSupersession(oldOem: string, newOem: string, brand?: string, source?: string): void {
        const db = this.ensureInit();

        const stmt = db.prepare(`
            INSERT OR IGNORE INTO supersessions (old_oem, new_oem, brand, source)
            VALUES (@oldOem, @newOem, @brand, @source)
        `);

        stmt.run({
            oldOem: oldOem.toUpperCase(),
            newOem: newOem.toUpperCase(),
            brand: brand?.toUpperCase() || null,
            source: source || 'auto-learned',
        });

        // Also update the main record
        const update = db.prepare(`
            UPDATE oem_records SET superseded_by = @newOem 
            WHERE oem = @oldOem AND superseded_by IS NULL
        `);
        update.run({ oldOem: oldOem.toUpperCase(), newOem: newOem.toUpperCase() });
    }

    /**
     * Resolve supersession chain
     */
    resolveSupersession(oem: string, maxDepth: number = 5): string {
        const db = this.ensureInit();

        let currentOem = oem.toUpperCase();
        let depth = 0;

        while (depth < maxDepth) {
            const stmt = db.prepare(`
                SELECT new_oem FROM supersessions WHERE old_oem = @oem
            `);
            const row = stmt.get({ oem: currentOem }) as any;

            if (!row) break;
            currentOem = row.new_oem;
            depth++;
        }

        return currentOem;
    }

    /**
     * Get database stats
     */
    getStats(): { totalRecords: number; brands: Record<string, number>; categories: Record<string, number> } {
        const db = this.ensureInit();

        const totalStmt = db.prepare('SELECT COUNT(*) as count FROM oem_records');
        const total = (totalStmt.get() as any).count;

        const brandsStmt = db.prepare(`
            SELECT brand, COUNT(*) as count FROM oem_records GROUP BY brand ORDER BY count DESC
        `);
        const brandsRows = brandsStmt.all() as any[];
        const brands: Record<string, number> = {};
        brandsRows.forEach(r => brands[r.brand] = r.count);

        const categoriesStmt = db.prepare(`
            SELECT part_category, COUNT(*) as count FROM oem_records 
            GROUP BY part_category ORDER BY count DESC
        `);
        const catRows = categoriesStmt.all() as any[];
        const categories: Record<string, number> = {};
        catRows.forEach(r => categories[r.part_category] = r.count);

        return { totalRecords: total, brands, categories };
    }

    /**
     * Close database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.initialized = false;
        }
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const oemDatabase = new OEMDatabase();
export default oemDatabase;
