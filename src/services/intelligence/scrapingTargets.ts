/**
 * 🕷️ OEM SCRAPING TARGETS
 * URL configuration for all brands and part categories
 * 
 * Priority:
 * - P0: High volume brands (VAG, BMW, Mercedes)
 * - P1: Volume brands (Opel, Ford, Peugeot)
 * - P2: Other brands
 */

export interface ScrapingTarget {
    id: string;
    brand: string;
    brandCode: string;
    urls: string[];
    priority: 0 | 1 | 2;
    maxPages: number;
    partCategories?: string[];
}

// ============================================================================
// Part Category URL Paths
// ============================================================================

const PART_PATHS = {
    brakes: ['bremsscheiben', 'bremsbelaege', 'bremsen', 'brake-discs', 'brake-pads'],
    filters: ['oelfilter', 'luftfilter', 'kraftstofffilter', 'innenraumfilter', 'oil-filter', 'air-filter'],
    suspension: ['stossdaempfer', 'federn', 'querlenker', 'spurstangen', 'shock-absorbers'],
    cooling: ['kuehler', 'thermostat', 'wasserpumpe', 'radiator', 'water-pump'],
    engine: ['zahnriemen', 'keilriemen', 'zuendkerzen', 'timing-belt', 'spark-plugs'],
    clutch: ['kupplung', 'schwungrad', 'clutch'],
};

// ============================================================================
// Autodoc.de Targets (Best OEM Data)
// ============================================================================

const AUTODOC_BASE = 'https://www.autodoc.de';

const AUTODOC_TARGETS: ScrapingTarget[] = [
    // P0: VAG
    {
        id: 'autodoc-vw',
        brand: 'Volkswagen',
        brandCode: 'VW',
        urls: [
            `${AUTODOC_BASE}/autoteile/volkswagen/golf-7-5g`,
            `${AUTODOC_BASE}/autoteile/volkswagen/golf-6-1k`,
            `${AUTODOC_BASE}/autoteile/volkswagen/passat-b8-3g`,
            `${AUTODOC_BASE}/autoteile/volkswagen/tiguan-5n`,
            `${AUTODOC_BASE}/autoteile/volkswagen/polo-6r`,
        ],
        priority: 0,
        maxPages: 500,
    },
    {
        id: 'autodoc-audi',
        brand: 'Audi',
        brandCode: 'AUDI',
        urls: [
            `${AUTODOC_BASE}/autoteile/audi/a4-8k-b8`,
            `${AUTODOC_BASE}/autoteile/audi/a3-8v`,
            `${AUTODOC_BASE}/autoteile/audi/a6-4g-c7`,
            `${AUTODOC_BASE}/autoteile/audi/q5-8r`,
            `${AUTODOC_BASE}/autoteile/audi/q7-4m`,
        ],
        priority: 0,
        maxPages: 400,
    },
    {
        id: 'autodoc-skoda',
        brand: 'Skoda',
        brandCode: 'SKODA',
        urls: [
            `${AUTODOC_BASE}/autoteile/skoda/octavia-5e`,
            `${AUTODOC_BASE}/autoteile/skoda/fabia-nj`,
            `${AUTODOC_BASE}/autoteile/skoda/superb-3v`,
            `${AUTODOC_BASE}/autoteile/skoda/kodiaq-ns`,
        ],
        priority: 0,
        maxPages: 300,
    },
    {
        id: 'autodoc-seat',
        brand: 'Seat',
        brandCode: 'SEAT',
        urls: [
            `${AUTODOC_BASE}/autoteile/seat/leon-5f`,
            `${AUTODOC_BASE}/autoteile/seat/ibiza-6j`,
            `${AUTODOC_BASE}/autoteile/seat/ateca-kh`,
        ],
        priority: 0,
        maxPages: 200,
    },

    // P0: German Premium
    {
        id: 'autodoc-bmw',
        brand: 'BMW',
        brandCode: 'BMW',
        urls: [
            `${AUTODOC_BASE}/autoteile/bmw/3er-f30-f31`,
            `${AUTODOC_BASE}/autoteile/bmw/5er-f10-f11`,
            `${AUTODOC_BASE}/autoteile/bmw/1er-f20-f21`,
            `${AUTODOC_BASE}/autoteile/bmw/x3-f25`,
            `${AUTODOC_BASE}/autoteile/bmw/x5-e70`,
        ],
        priority: 0,
        maxPages: 400,
    },
    {
        id: 'autodoc-mercedes',
        brand: 'Mercedes-Benz',
        brandCode: 'MERCEDES',
        urls: [
            `${AUTODOC_BASE}/autoteile/mercedes-benz/c-klasse-w205`,
            `${AUTODOC_BASE}/autoteile/mercedes-benz/e-klasse-w213`,
            `${AUTODOC_BASE}/autoteile/mercedes-benz/a-klasse-w176`,
            `${AUTODOC_BASE}/autoteile/mercedes-benz/glc-x253`,
        ],
        priority: 0,
        maxPages: 400,
    },

    // P1: Volume Brands
    {
        id: 'autodoc-opel',
        brand: 'Opel',
        brandCode: 'OPEL',
        urls: [
            `${AUTODOC_BASE}/autoteile/opel/astra-k`,
            `${AUTODOC_BASE}/autoteile/opel/corsa-e`,
            `${AUTODOC_BASE}/autoteile/opel/insignia-b`,
            `${AUTODOC_BASE}/autoteile/opel/mokka-x`,
        ],
        priority: 1,
        maxPages: 300,
    },
    {
        id: 'autodoc-ford',
        brand: 'Ford',
        brandCode: 'FORD',
        urls: [
            `${AUTODOC_BASE}/autoteile/ford/focus-mk3`,
            `${AUTODOC_BASE}/autoteile/ford/fiesta-mk7`,
            `${AUTODOC_BASE}/autoteile/ford/kuga-mk2`,
            `${AUTODOC_BASE}/autoteile/ford/mondeo-mk5`,
        ],
        priority: 1,
        maxPages: 300,
    },
    {
        id: 'autodoc-peugeot',
        brand: 'Peugeot',
        brandCode: 'PEUGEOT',
        urls: [
            `${AUTODOC_BASE}/autoteile/peugeot/308-t9`,
            `${AUTODOC_BASE}/autoteile/peugeot/208`,
            `${AUTODOC_BASE}/autoteile/peugeot/3008-p84`,
        ],
        priority: 1,
        maxPages: 200,
    },
    {
        id: 'autodoc-renault',
        brand: 'Renault',
        brandCode: 'RENAULT',
        urls: [
            `${AUTODOC_BASE}/autoteile/renault/clio-4`,
            `${AUTODOC_BASE}/autoteile/renault/megane-3`,
            `${AUTODOC_BASE}/autoteile/renault/captur`,
        ],
        priority: 1,
        maxPages: 200,
    },

    // P2: Other Brands
    {
        id: 'autodoc-toyota',
        brand: 'Toyota',
        brandCode: 'TOYOTA',
        urls: [
            `${AUTODOC_BASE}/autoteile/toyota/corolla-e210`,
            `${AUTODOC_BASE}/autoteile/toyota/yaris`,
            `${AUTODOC_BASE}/autoteile/toyota/rav4`,
        ],
        priority: 2,
        maxPages: 200,
    },
    {
        id: 'autodoc-hyundai',
        brand: 'Hyundai',
        brandCode: 'HYUNDAI',
        urls: [
            `${AUTODOC_BASE}/autoteile/hyundai/tucson`,
            `${AUTODOC_BASE}/autoteile/hyundai/i30`,
        ],
        priority: 2,
        maxPages: 150,
    },
    {
        id: 'autodoc-kia',
        brand: 'Kia',
        brandCode: 'KIA',
        urls: [
            `${AUTODOC_BASE}/autoteile/kia/sportage`,
            `${AUTODOC_BASE}/autoteile/kia/ceed`,
        ],
        priority: 2,
        maxPages: 150,
    },
    {
        id: 'autodoc-volvo',
        brand: 'Volvo',
        brandCode: 'VOLVO',
        urls: [
            `${AUTODOC_BASE}/autoteile/volvo/xc60`,
            `${AUTODOC_BASE}/autoteile/volvo/v60`,
        ],
        priority: 2,
        maxPages: 150,
    },
    {
        id: 'autodoc-fiat',
        brand: 'Fiat',
        brandCode: 'FIAT',
        urls: [
            `${AUTODOC_BASE}/autoteile/fiat/500`,
            `${AUTODOC_BASE}/autoteile/fiat/panda`,
        ],
        priority: 2,
        maxPages: 100,
    },
];

// ============================================================================
// KFZteile24.de Targets
// ============================================================================

const KFZTEILE24_BASE = 'https://www.kfzteile24.de';

const KFZTEILE24_TARGETS: ScrapingTarget[] = [
    {
        id: 'kfz24-vw',
        brand: 'Volkswagen',
        brandCode: 'VW',
        urls: [`${KFZTEILE24_BASE}/ersatzteile/volkswagen`],
        priority: 0,
        maxPages: 300,
    },
    {
        id: 'kfz24-bmw',
        brand: 'BMW',
        brandCode: 'BMW',
        urls: [`${KFZTEILE24_BASE}/ersatzteile/bmw`],
        priority: 0,
        maxPages: 300,
    },
    {
        id: 'kfz24-mercedes',
        brand: 'Mercedes-Benz',
        brandCode: 'MERCEDES',
        urls: [`${KFZTEILE24_BASE}/ersatzteile/mercedes-benz`],
        priority: 0,
        maxPages: 300,
    },
];

// ============================================================================
// Daparto.de Targets
// ============================================================================

const DAPARTO_BASE = 'https://www.daparto.de';

const DAPARTO_TARGETS: ScrapingTarget[] = [
    {
        id: 'daparto-vw',
        brand: 'Volkswagen',
        brandCode: 'VW',
        urls: [`${DAPARTO_BASE}/ersatzteile/vw`],
        priority: 1,
        maxPages: 200,
    },
    {
        id: 'daparto-bmw',
        brand: 'BMW',
        brandCode: 'BMW',
        urls: [`${DAPARTO_BASE}/ersatzteile/bmw`],
        priority: 1,
        maxPages: 200,
    },
];

// ============================================================================
// All Targets Combined
// ============================================================================

export const ALL_SCRAPING_TARGETS: ScrapingTarget[] = [
    ...AUTODOC_TARGETS,
    ...KFZTEILE24_TARGETS,
    ...DAPARTO_TARGETS,
];

// Get targets by priority
export function getTargetsByPriority(priority: 0 | 1 | 2): ScrapingTarget[] {
    return ALL_SCRAPING_TARGETS.filter(t => t.priority === priority);
}

// Get targets by brand
export function getTargetsByBrand(brandCode: string): ScrapingTarget[] {
    return ALL_SCRAPING_TARGETS.filter(t => t.brandCode === brandCode.toUpperCase());
}

// Get total expected pages
export function getTotalPages(): number {
    return ALL_SCRAPING_TARGETS.reduce((sum, t) => sum + t.maxPages, 0);
}

// ============================================================================
// Export Summary
// ============================================================================

export const SCRAPING_SUMMARY = {
    totalTargets: ALL_SCRAPING_TARGETS.length,
    totalUrls: ALL_SCRAPING_TARGETS.reduce((sum, t) => sum + t.urls.length, 0),
    totalMaxPages: getTotalPages(),
    byPriority: {
        p0: getTargetsByPriority(0).length,
        p1: getTargetsByPriority(1).length,
        p2: getTargetsByPriority(2).length,
    },
};

export default {
    ALL_SCRAPING_TARGETS,
    getTargetsByPriority,
    getTargetsByBrand,
    getTotalPages,
    SCRAPING_SUMMARY,
};
