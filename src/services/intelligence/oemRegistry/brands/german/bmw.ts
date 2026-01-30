/**
 * 🚗 BMW OEM Registry
 * 
 * Comprehensive OEM parts database for major BMW models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// 3 Series F30/F31 (2012-2019)
// ============================================================================

const SERIES_3_F30: ModelEntry = {
    name: '3 Series F30',
    code: 'F30',
    generation: 'F30',
    years: [2012, 2019],
    platform: 'F3x',
    engines: ['N20', 'N47', 'B47', 'B48', 'N55', 'B58'],
    parts: {
        brakes: {
            discFront: [
                { oem: '34116792219', description: '312x24mm Standard', condition: '320i/320d/328d' },
                { oem: '34116792223', description: '330x24mm High Output', condition: '328i/330i/335i' },
                { oem: '34116792227', description: '340x30mm M Sport (Blue Caliper)', condition: 'M Sport S2NH' },
                { oem: '34106797602', description: '370mm M Performance', condition: 'M Performance S2NH' },
            ],
            discRear: [
                { oem: '34216792227', description: '300x20mm Standard', condition: '320i/320d' },
                { oem: '34216864899', description: '330x20mm', condition: '328i/330i' },
                { oem: '34206797605', description: '345x24mm M Sport', condition: 'M Sport' },
            ],
            padsFront: [
                { oem: '34116850568', description: 'Brake Pads Front Standard' },
                { oem: '34116872632', description: 'Brake Pads Front M Sport' },
            ],
            padsRear: [
                { oem: '34216873061', description: 'Brake Pads Rear Standard' },
                { oem: '34216872632', description: 'Brake Pads Rear M Sport' },
            ],
        },
        filters: {
            oil: [
                // B47/B48
                { oem: '11428575211', description: 'Oil Filter B47/B48', condition: 'LCI (2015+)' },
                // N47/N57
                { oem: '11427802756', description: 'Oil Filter N47/N57 Diesel', condition: 'Pre-LCI Diesel' },
                // N20
                { oem: '11427640862', description: 'Oil Filter N20/N26 Petrol', condition: 'Pre-LCI Petrol' },
            ],
            air: [
                { oem: '13718577170', description: 'Air Filter B47/B57', condition: 'Diesel 2015+' },
                { oem: '13718605164', description: 'Air Filter B48', condition: 'Petrol 2015+' },
                { oem: '13717597586', description: 'Air Filter N20' },
                { oem: '13717800151', description: 'Air Filter N47 Diesel' },
            ],
            fuel: [
                { oem: '13328511053', description: 'Fuel Filter Diesel', condition: 'Diesel Engines' },
            ],
            cabin: [
                { oem: '64119237555', description: 'Cabin Filter Set' },
            ],
        },
    },
};

// ============================================================================
// 5 Series G30/G31 (2017-2023)
// ============================================================================

const SERIES_5_G30: ModelEntry = {
    name: '5 Series G30',
    code: 'G30',
    generation: 'G30',
    years: [2017, 2023],
    platform: 'CLAR',
    engines: ['B47', 'B48', 'B57', 'B58'],
    parts: {
        brakes: {
            discFront: [
                { oem: '34116860907', description: '330x24mm Standard', condition: '520i/520d' },
                { oem: '34116860911', description: '348x30mm 530i/540i', condition: '530i/540i Standard' },
                { oem: '34116860912', description: '374x36mm M Sport', condition: 'M Sport Brakes' },
            ],
            discRear: [
                { oem: '34216860925', description: '330x20mm Standard', condition: '520d/530i' },
                { oem: '34216860926', description: '345x24mm', condition: '540i/M Sport' },
            ],
            padsFront: [
                { oem: '34116883469', description: 'Brake Pads Front Standard' },
                { oem: '34116885547', description: 'Brake Pads Front M Sport' },
            ],
        },
        filters: {
            oil: [
                { oem: '11428575211', description: 'Oil Filter B47/B48/B57/B58' },
            ],
            air: [
                { oem: '13718577170', description: 'Air Filter B47/B57 Diesel' },
                { oem: '13718691835', description: 'Air Filter B48 Petrol' },
            ],
            fuel: [
                { oem: '13328594135', description: 'Fuel Filter Diesel' },
            ],
            cabin: [
                { oem: '64119366403', description: 'Cabin Filter Set' },
            ],
        },
    },
};

// ============================================================================
// 1 Series F20/F21 (2011-2019)
// ============================================================================

const SERIES_1_F20: ModelEntry = {
    name: '1 Series F20',
    code: 'F20',
    generation: 'F20',
    years: [2011, 2019],
    platform: 'F20',
    engines: ['N13', 'N47', 'B37', 'B38', 'B47', 'B48'],
    parts: {
        brakes: {
            discFront: [
                { oem: '34116792217', description: '300x22mm Standard', condition: '116i/118i/118d' },
                { oem: '34116792219', description: '312x24mm', condition: '120d/125i' },
                { oem: '34116792223', description: '330x24mm M135i/M140i', condition: 'M135i/M140i' },
            ],
            discRear: [
                { oem: '34216792225', description: '290x11mm Standard' },
                { oem: '34216792227', description: '300x20mm Vented' },
            ],
            padsFront: [
                { oem: '34116850567', description: 'Brake Pads Front Standard' },
            ],
        },
        filters: {
            oil: [
                { oem: '11428575211', description: 'Oil Filter B38/B48/B37/B47' },
                { oem: '11427640862', description: 'Oil Filter N13 Petrol' },
            ],
            air: [
                { oem: '13718577170', description: 'Air Filter Diesel 2015+' },
                { oem: '13717630911', description: 'Air Filter N13 Petrol' },
            ],
            fuel: [
                { oem: '13328511053', description: 'Fuel Filter Diesel' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const BMW_REGISTRY: OEMRegistry = {
    brand: 'BMW',
    brandCode: 'BMW',
    group: 'BMW',
    models: [
        SERIES_3_F30,
        SERIES_5_G30,
        SERIES_1_F20,
    ],
};

export default BMW_REGISTRY;
