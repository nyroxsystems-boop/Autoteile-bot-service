/**
 * 🔍 OEM Scraping Engine - Core Types
 * 
 * Type definitions for the automated OEM data acquisition system.
 */

// ============================================================================
// Scraped Data Types
// ============================================================================

export interface ScrapedOEMPart {
    /** The OEM part number (e.g., "5Q0615301H") */
    oem: string;

    /** Human-readable part name */
    name: string;

    /** Name in original language (if different) */
    nameOriginal?: string;

    /** Brand (VW, Audi, BMW, etc.) */
    brand: string;

    /** Model names this part fits */
    models: ModelApplicability[];

    /** Part category */
    category: OEMPartCategory;

    /** Subcategory for filtering */
    subcategory?: string;

    /** Supersession information */
    supersession?: {
        /** This OEM is replaced by */
        replacedBy?: string;
        /** This OEM replaces these older numbers */
        replaces?: string[];
    };

    /** Cross-references to aftermarket brands */
    crossReferences?: CrossReference[];

    /** Source where this data was scraped from */
    source: DataSource;

    /** When this was last scraped/updated */
    scrapedAt: Date;

    /** Confidence score 0-100 */
    confidence: number;
}

export interface ModelApplicability {
    /** Model name (e.g., "Golf 7") */
    model: string;

    /** Model code (e.g., "5G1") */
    code?: string;

    /** Production years */
    years?: [number, number];

    /** Compatible engines */
    engines?: string[];

    /** PR codes that require this part (VW/Audi) */
    prCodes?: string[];

    /** SA codes that require this part (Mercedes/BMW) */
    saCodes?: string[];

    /** Specific conditions/notes */
    condition?: string;
}

export interface CrossReference {
    /** Aftermarket brand name */
    brand: string;

    /** Brand's part number */
    number: string;

    /** Quality tier (OE, OEM, Aftermarket) */
    quality?: 'OE' | 'OEM' | 'AFTERMARKET';
}

export interface DataSource {
    /** Source type */
    type: 'SCRAPER' | 'API' | 'MANUAL';

    /** Source name */
    name: string;

    /** URL if web-scraped */
    url?: string;

    /** API name if from API */
    api?: string;
}

// ============================================================================
// Part Categories
// ============================================================================

export type OEMPartCategory =
    | 'BRAKES'
    | 'FILTERS'
    | 'ENGINE'
    | 'TRANSMISSION'
    | 'SUSPENSION'
    | 'STEERING'
    | 'COOLING'
    | 'ELECTRICAL'
    | 'BODY'
    | 'INTERIOR'
    | 'EXHAUST'
    | 'FUEL'
    | 'OTHER';

// ============================================================================
// Scraper Configuration
// ============================================================================

export interface ScraperConfig {
    /** Unique scraper identifier */
    id: string;

    /** Human-readable name */
    name: string;

    /** Target website */
    baseUrl: string;

    /** Which brands this scraper handles */
    brands: string[];

    /** Rate limiting */
    rateLimit: {
        requestsPerMinute: number;
        delayBetweenRequests: number; // ms
    };

    /** Proxy configuration */
    proxy?: {
        enabled: boolean;
        rotateAfter: number; // requests
    };

    /** CSS selectors for data extraction */
    selectors: Record<string, string>;

    /** Whether scraper is enabled */
    enabled: boolean;
}

// ============================================================================
// Scraper Results
// ============================================================================

export interface ScrapeResult {
    /** Was the scrape successful? */
    success: boolean;

    /** Parts found */
    parts: ScrapedOEMPart[];

    /** Number of parts scraped */
    count: number;

    /** Time taken in ms */
    duration: number;

    /** Errors encountered */
    errors?: string[];

    /** Scraper that produced this */
    scraperId: string;

    /** When this scrape ran */
    timestamp: Date;
}

export interface ScrapeJob {
    /** Job ID */
    id: string;

    /** Scraper to use */
    scraperId: string;

    /** Target (brand, model, category) */
    target: {
        brand?: string;
        model?: string;
        category?: OEMPartCategory;
    };

    /** Job status */
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

    /** Progress 0-100 */
    progress: number;

    /** Result when completed */
    result?: ScrapeResult;

    /** Created timestamp */
    createdAt: Date;

    /** Started timestamp */
    startedAt?: Date;

    /** Completed timestamp */
    completedAt?: Date;
}

// ============================================================================
// Cross-Reference Engine Types
// ============================================================================

export interface OEMLookup {
    /** OEM number to look up */
    oem: string;

    /** Optional: narrow by brand */
    brand?: string;

    /** Optional: narrow by model */
    model?: string;

    /** Include supersession chain? */
    includeSupersession?: boolean;

    /** Include cross-references? */
    includeCrossRef?: boolean;
}

export interface OEMLookupResult {
    /** Was the OEM found? */
    found: boolean;

    /** The requested OEM data */
    part?: ScrapedOEMPart;

    /** Current/latest OEM if superseded */
    currentOEM?: string;

    /** Full supersession chain */
    supersessionChain?: string[];

    /** Cross-references from all sources */
    crossReferences?: CrossReference[];

    /** Confidence score 0-100 */
    confidence: number;

    /** Sources that confirmed this OEM */
    sources: string[];
}

// ============================================================================
// VIN Resolution Types
// ============================================================================

export interface VINData {
    /** Full 17-character VIN */
    vin: string;

    /** Decoded vehicle info */
    vehicle: {
        brand: string;
        model: string;
        year: number;
        engine: string;
        transmission: string;
        bodyType: string;
    };

    /** Equipment codes from VIN */
    equipmentCodes: string[];

    /** Production date */
    productionDate?: Date;

    /** Factory */
    factory?: string;
}

export interface VINPartsResult {
    /** VIN data */
    vin: VINData;

    /** Parts grouped by category */
    partsByCategory: Map<OEMPartCategory, ScrapedOEMPart[]>;

    /** Total parts count */
    totalParts: number;

    /** Confidence in results */
    confidence: number;
}

// ============================================================================
// Database Models
// ============================================================================

export interface OEMDocument extends ScrapedOEMPart {
    /** MongoDB _id */
    _id?: string;

    /** Internal version for updates */
    version: number;

    /** When first created */
    createdAt: Date;

    /** When last updated */
    updatedAt: Date;

    /** Is this verified by multiple sources? */
    verified: boolean;

    /** How many sources confirm this? */
    sourceCount: number;
}

export interface SupersessionEdge {
    /** Old OEM number */
    from: string;

    /** New OEM number */
    to: string;

    /** When this supersession was detected */
    detectedAt: Date;

    /** Source of supersession info */
    source: string;
}
