/**
 * 🏆 ENTERPRISE OEM DATA PARSER
 * Parses scraped HTML/TXT files and extracts OEM data
 * 
 * Input: Scraped files from web-scraper skill
 * Output: Structured OEMRecord objects for database
 */

import fs from 'fs';
import path from 'path';
import { logger } from '@utils/logger';
import { extractOEMsEnhanced, learnSupersessionsFromHTML, normalizeOEM } from './enhancedOemExtractor';
import { oemDatabase, OEMRecord } from './oemDatabase';

// ============================================================================
// Types
// ============================================================================

interface ParsedFile {
    url: string;
    title: string;
    content: string;
    scrapedAt: string;
}

interface ParseStats {
    filesProcessed: number;
    oemsExtracted: number;
    supersessionsLearned: number;
    errors: number;
}

// ============================================================================
// Brand Detection from URL/Content
// ============================================================================

const BRAND_PATTERNS: Record<string, RegExp[]> = {
    VW: [/volkswagen/i, /\bvw\b/i, /golf/i, /passat/i, /polo/i, /tiguan/i],
    AUDI: [/audi/i, /\ba[1-8]\b/i, /\bq[2-8]\b/i, /\btt\b/i, /\brs\b/i],
    BMW: [/bmw/i, /\b[1-8]er\b/i, /\bx[1-7]\b/i, /\bz[1-4]\b/i, /\bm[1-6]\b/i],
    MERCEDES: [/mercedes/i, /\bw[0-9]{3}\b/i, /\bc[0-9]{3}\b/i, /\bglc\b/i, /\bgle\b/i],
    SKODA: [/skoda/i, /octavia/i, /fabia/i, /superb/i, /kodiaq/i],
    SEAT: [/seat/i, /leon/i, /ibiza/i, /ateca/i, /tarraco/i],
    OPEL: [/opel/i, /astra/i, /corsa/i, /insignia/i, /mokka/i],
    FORD: [/ford/i, /focus/i, /fiesta/i, /mondeo/i, /kuga/i],
    TOYOTA: [/toyota/i, /corolla/i, /yaris/i, /rav4/i, /camry/i],
    HONDA: [/honda/i, /civic/i, /accord/i, /\bcr-?v\b/i],
    MAZDA: [/mazda/i, /\bmx-?[5-9]\b/i, /\bcx-?[3-9]\b/i],
    NISSAN: [/nissan/i, /qashqai/i, /juke/i, /leaf/i],
    HYUNDAI: [/hyundai/i, /tucson/i, /i[0-9]{2}/i],
    KIA: [/kia/i, /sportage/i, /ceed/i, /niro/i],
    PEUGEOT: [/peugeot/i, /\b[0-9]{3}\b.*peugeot/i],
    CITROEN: [/citroen/i, /citroën/i, /\bc[1-5]\b/i],
    RENAULT: [/renault/i, /clio/i, /megane/i, /captur/i],
    FIAT: [/fiat/i, /punto/i, /panda/i, /\b500\b/i],
    VOLVO: [/volvo/i, /\bxc[0-9]{2}\b/i, /\bv[0-9]{2}\b/i, /\bs[0-9]{2}\b/i],
    MINI: [/\bmini\b/i, /cooper/i],
};

function detectBrand(url: string, content: string): string | null {
    const text = `${url} ${content}`.toLowerCase();

    for (const [brand, patterns] of Object.entries(BRAND_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                return brand;
            }
        }
    }

    return null;
}

// ============================================================================
// Part Category Detection
// ============================================================================

const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
    brake: [/brems/i, /brake/i, /belag/i, /scheibe/i, /disc/i, /pad/i],
    filter: [/filter/i, /öl/i, /oil/i, /luft/i, /air/i, /kraftstoff/i, /fuel/i, /innenraum/i, /cabin/i],
    suspension: [/fahrwerk/i, /suspension/i, /stoßdämpfer/i, /shock/i, /feder/i, /spring/i, /querlenker/i, /control arm/i],
    cooling: [/kühl/i, /cool/i, /wasser/i, /water/i, /thermostat/i, /radiator/i, /kühler/i],
    engine: [/motor/i, /engine/i, /zylinder/i, /cylinder/i, /kolben/i, /piston/i, /zahnriemen/i, /timing/i],
    electrical: [/elektr/i, /electr/i, /batterie/i, /battery/i, /licht/i, /light/i, /sensor/i, /steuergerät/i],
    exhaust: [/auspuff/i, /exhaust/i, /katalysator/i, /catalyst/i, /abgas/i, /dpf/i, /partikel/i],
    clutch: [/kupplung/i, /clutch/i],
    steering: [/lenkung/i, /steering/i, /spurstange/i, /tie rod/i],
    transmission: [/getriebe/i, /transmission/i, /gear/i, /schalt/i],
};

function detectCategory(content: string): string {
    const text = content.toLowerCase();

    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                return category;
            }
        }
    }

    return 'unknown';
}

// ============================================================================
// File Parser
// ============================================================================

function parseScrapedFile(filePath: string): ParsedFile | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse header from scraped file format:
        // URL: https://...
        // Title: ...
        // Scraped: 2025-...
        // ================...
        // [content]

        const lines = content.split('\n');
        const urlLine = lines.find(l => l.startsWith('URL:'));
        const titleLine = lines.find(l => l.startsWith('Title:'));
        const scrapedLine = lines.find(l => l.startsWith('Scraped:'));

        const separatorIndex = lines.findIndex(l => l.startsWith('====='));
        const textContent = separatorIndex > 0
            ? lines.slice(separatorIndex + 1).join('\n')
            : content;

        return {
            url: urlLine?.replace('URL:', '').trim() || filePath,
            title: titleLine?.replace('Title:', '').trim() || '',
            content: textContent,
            scrapedAt: scrapedLine?.replace('Scraped:', '').trim() || new Date().toISOString(),
        };
    } catch (error) {
        logger.warn(`[OEMParser] Failed to parse ${filePath}`, { error });
        return null;
    }
}

// ============================================================================
// Main Parser
// ============================================================================

export async function parseOEMDataDirectory(
    inputDir: string,
    options: {
        saveToDb?: boolean;
        batchSize?: number;
        verbose?: boolean;
    } = {}
): Promise<ParseStats> {
    const { saveToDb = true, batchSize = 100, verbose = false } = options;

    const stats: ParseStats = {
        filesProcessed: 0,
        oemsExtracted: 0,
        supersessionsLearned: 0,
        errors: 0,
    };

    // Find all .txt files recursively
    const files: string[] = [];

    function findFiles(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                findFiles(fullPath);
            } else if (entry.name.endsWith('.txt') && !entry.name.startsWith('_')) {
                files.push(fullPath);
            }
        }
    }

    findFiles(inputDir);
    logger.info(`[OEMParser] Found ${files.length} files to process`);

    // Parse files in batches
    const oemRecords: OEMRecord[] = [];

    for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const parsed = parseScrapedFile(filePath);

        if (!parsed) {
            stats.errors++;
            continue;
        }

        stats.filesProcessed++;

        // Detect brand and category
        const brand = detectBrand(parsed.url, parsed.content);
        const category = detectCategory(parsed.content);

        if (!brand) {
            if (verbose) logger.debug(`[OEMParser] No brand detected for ${filePath}`);
            continue;
        }

        // Extract OEMs using enhanced extractor
        const result = extractOEMsEnhanced(parsed.content, brand);

        // Learn supersessions
        if (result.supersessions.size > 0) {
            stats.supersessionsLearned += result.supersessions.size;
            for (const [oldOem, newOem] of result.supersessions) {
                if (saveToDb) {
                    oemDatabase.registerSupersession(oldOem, newOem, brand, parsed.url);
                }
            }
        }

        // Create records for each extracted OEM
        for (const candidate of result.candidates) {
            if (candidate.confidence < 0.5) continue; // Skip low confidence

            const record: OEMRecord = {
                oem: candidate.oem,
                brand,
                partCategory: category,
                partDescription: parsed.title || candidate.context?.substring(0, 100) || '',
                sources: [parsed.url],
                confidence: candidate.confidence,
                lastVerified: parsed.scrapedAt,
                hitCount: 0,
                supersededBy: candidate.supersededBy,
            };

            oemRecords.push(record);
            stats.oemsExtracted++;
        }

        // Batch insert
        if (saveToDb && oemRecords.length >= batchSize) {
            oemDatabase.bulkInsert(oemRecords);
            if (verbose) logger.info(`[OEMParser] Inserted batch of ${oemRecords.length} records`);
            oemRecords.length = 0;
        }

        // Progress logging
        if (stats.filesProcessed % 100 === 0) {
            logger.info(`[OEMParser] Progress: ${stats.filesProcessed}/${files.length} files, ${stats.oemsExtracted} OEMs`);
        }
    }

    // Insert remaining records
    if (saveToDb && oemRecords.length > 0) {
        oemDatabase.bulkInsert(oemRecords);
    }

    logger.info(`[OEMParser] Complete: ${stats.filesProcessed} files, ${stats.oemsExtracted} OEMs, ${stats.supersessionsLearned} supersessions`);

    return stats;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log('Usage: ts-node oemDataParser.ts <input-directory>');
        console.log('Example: ts-node oemDataParser.ts ./oem-data/7zap-vag/');
        process.exit(1);
    }

    const inputDir = args[0];

    parseOEMDataDirectory(inputDir, { saveToDb: true, verbose: true })
        .then(stats => {
            console.log('\n=== Parse Complete ===');
            console.log(`Files processed: ${stats.filesProcessed}`);
            console.log(`OEMs extracted: ${stats.oemsExtracted}`);
            console.log(`Supersessions learned: ${stats.supersessionsLearned}`);
            console.log(`Errors: ${stats.errors}`);

            // Print DB stats
            const dbStats = oemDatabase.getStats();
            console.log('\n=== Database Stats ===');
            console.log(`Total records: ${dbStats.totalRecords}`);
            console.log('Brands:', dbStats.brands);
            console.log('Categories:', dbStats.categories);
        })
        .catch(err => {
            console.error('Parse failed:', err);
            process.exit(1);
        });
}

export default { parseOEMDataDirectory };
