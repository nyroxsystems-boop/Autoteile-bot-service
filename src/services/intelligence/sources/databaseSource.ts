/**
 * 🏆 DATABASE OEM SOURCE
 * Highest priority source - instant lookups from SQLite
 * 
 * This is the Enterprise-level data source that provides:
 * - <10ms response time
 * - 0.95+ confidence for verified OEMs
 * - No network latency
 * - Works offline
 */

import { OEMCandidate, OEMResolverRequest } from "../types";
import { OEMSource } from "./baseSource";
import { oemDatabase } from "../oemDatabase";
import { logger } from "@utils/logger";

/**
 * Map part query categories to database categories
 */
function mapCategory(partQuery: string): string | undefined {
    const query = partQuery.toLowerCase();

    if (/brems|brake|scheibe|belag|disc|pad/i.test(query)) return 'brake';
    if (/filter|öl|oil|luft|air|kraftstoff|fuel|innenraum|cabin|pollen/i.test(query)) return 'filter';
    if (/fahrwerk|suspension|stoßdämpfer|shock|feder|spring|querlenker/i.test(query)) return 'suspension';
    if (/kühl|cool|wasser|water|thermostat|radiator/i.test(query)) return 'cooling';
    if (/motor|engine|zylinder|kolben|zahnriemen|timing|turbo/i.test(query)) return 'engine';
    if (/elektr|batterie|licht|light|sensor|steuer/i.test(query)) return 'electrical';
    if (/auspuff|exhaust|katalysator|catalyst|dpf/i.test(query)) return 'exhaust';
    if (/kupplung|clutch/i.test(query)) return 'clutch';
    if (/lenkung|steering|spurstange/i.test(query)) return 'steering';
    if (/getriebe|transmission|gear/i.test(query)) return 'transmission';

    return undefined;
}

/**
 * Extract useful parts from brand/model
 */
function extractModelCode(model?: string): string | undefined {
    if (!model) return undefined;

    const modelUpper = model.toUpperCase();

    // VAG codes
    const vagMatch = modelUpper.match(/\b([0-9][A-Z]|[A-Z][0-9])\b/);
    if (vagMatch) return vagMatch[1];

    // BMW codes
    const bmwMatch = modelUpper.match(/\b([EFG][0-9]{2})\b/);
    if (bmwMatch) return bmwMatch[1];

    // Mercedes codes
    const mbMatch = modelUpper.match(/\b([WVCSV][0-9]{3})\b/i);
    if (mbMatch) return mbMatch[1].toUpperCase();

    return undefined;
}

export const databaseSource: OEMSource = {
    name: "enterprise-database",

    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        try {
            const brand = req.vehicle.make?.toUpperCase();
            const model = req.vehicle.model;
            const modelCode = extractModelCode(model);
            const category = mapCategory(req.partQuery.normalizedCategory || req.partQuery.rawText);
            const year = req.vehicle.year;

            logger.debug('[DatabaseSource] Querying', { brand, model, modelCode, category, year });

            // Try exact lookup first
            const results = oemDatabase.lookup({
                brand,
                model: modelCode || model,
                category,
                year,
                limit: 10,
            });

            if (results.length > 0) {
                logger.info(`[DatabaseSource] Found ${results.length} candidates in database`);

                return results.map(r => ({
                    oem: r.oem,
                    brand: brand,
                    source: 'enterprise-database',
                    confidence: r.confidence,
                    meta: {
                        description: r.description,
                        supersededBy: r.supersededBy,
                        fromDatabase: true,
                        priority: 8,
                    }
                }));
            }

            // Fallback: Full-text search on the query
            const searchQuery = [brand, model, req.partQuery.rawText]
                .filter(Boolean)
                .join(' ');

            const ftsResults = oemDatabase.search(searchQuery, 5);

            if (ftsResults.length > 0) {
                logger.info(`[DatabaseSource] FTS found ${ftsResults.length} candidates`);

                return ftsResults.map(r => ({
                    oem: r.oem,
                    brand: brand,
                    source: 'enterprise-database-fts',
                    confidence: r.confidence * 0.9, // Slightly lower for FTS matches
                    meta: {
                        description: r.description,
                        supersededBy: r.supersededBy,
                        fromDatabase: true,
                        priority: 8,
                    }
                }));
            }

            logger.debug('[DatabaseSource] No matches found in database');
            return [];

        } catch (err: any) {
            logger.warn('[DatabaseSource] Database lookup failed', { error: err?.message });
            return [];
        }
    }
};

export default databaseSource;
