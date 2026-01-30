#!/usr/bin/env npx ts-node
/**
 * 🏆 OEM Database Seeder
 * 
 * Converts all brand registries into SQLite database entries.
 * Run with: npx ts-node src/scripts/seedOemDatabase.ts
 */

import path from 'path';
import fs from 'fs';

// Import database
import { oemDatabase, OEMRecord } from '../services/intelligence/oemDatabase';

// Import all registries
import { ALL_REGISTRIES, getRegistryStats } from '../services/intelligence/oemRegistry';
import { PartType, ModelEntry, PartVariant } from '../services/intelligence/oemRegistry/types';

// ============================================================================
// Part Type Mapping
// ============================================================================

const PART_TYPE_MAP: Record<string, { category: string; field: string; description: string }> = {
    'discFront': { category: 'brake', field: 'discFront', description: 'Bremsscheibe vorne' },
    'discRear': { category: 'brake', field: 'discRear', description: 'Bremsscheibe hinten' },
    'padsFront': { category: 'brake', field: 'padsFront', description: 'Bremsbeläge vorne' },
    'padsRear': { category: 'brake', field: 'padsRear', description: 'Bremsbeläge hinten' },
    'caliper': { category: 'brake', field: 'caliper', description: 'Bremssattel' },
    'oil': { category: 'filter', field: 'oil', description: 'Ölfilter' },
    'air': { category: 'filter', field: 'air', description: 'Luftfilter' },
    'fuel': { category: 'filter', field: 'fuel', description: 'Kraftstofffilter' },
    'cabin': { category: 'filter', field: 'cabin', description: 'Innenraumfilter' },
    'waterPump': { category: 'cooling', field: 'waterPump', description: 'Wasserpumpe' },
    'thermostat': { category: 'cooling', field: 'thermostat', description: 'Thermostat' },
    'radiator': { category: 'cooling', field: 'radiator', description: 'Kühler' },
    'shockFront': { category: 'suspension', field: 'shockFront', description: 'Stoßdämpfer vorne' },
    'shockRear': { category: 'suspension', field: 'shockRear', description: 'Stoßdämpfer hinten' },
    'springFront': { category: 'suspension', field: 'springFront', description: 'Feder vorne' },
    'springRear': { category: 'suspension', field: 'springRear', description: 'Feder hinten' },
    'controlArm': { category: 'suspension', field: 'controlArm', description: 'Querlenker' },
    'tieRod': { category: 'suspension', field: 'tieRod', description: 'Spurstange' },
    'wheelBearing': { category: 'suspension', field: 'wheelBearing', description: 'Radlager' },
    'stabilizer': { category: 'suspension', field: 'stabilizer', description: 'Stabilisator' },
    'clutchKit': { category: 'drivetrain', field: 'clutchKit', description: 'Kupplungssatz' },
    'flywheel': { category: 'drivetrain', field: 'flywheel', description: 'Schwungrad' },
    'driveShaft': { category: 'drivetrain', field: 'driveShaft', description: 'Antriebswelle' },
    'timingKit': { category: 'engine', field: 'timingKit', description: 'Zahnriemensatz' },
    'sparkPlug': { category: 'engine', field: 'sparkPlug', description: 'Zündkerze' },
    'ignitionCoil': { category: 'engine', field: 'ignitionCoil', description: 'Zündspule' },
    'turbo': { category: 'engine', field: 'turbo', description: 'Turbolader' },
};

// ============================================================================
// Main Seeder
// ============================================================================

async function seedDatabase() {
    console.log('🏆 OEM Database Seeder');
    console.log('='.repeat(60));

    // Get registry stats first
    const stats = getRegistryStats();
    console.log(`📊 Registry Stats:`);
    console.log(`   Brands: ${stats.brands}`);
    console.log(`   Models: ${stats.models}`);
    console.log(`   OEM Numbers: ${stats.oemNumbers}`);
    console.log('');

    const allRecords: OEMRecord[] = [];
    let totalOems = 0;

    // Iterate all registries
    for (const registry of ALL_REGISTRIES) {
        console.log(`\n🚗 Processing ${registry.brand} (${registry.brandCode})...`);
        let brandOems = 0;

        // Iterate all models
        for (const model of registry.models) {
            const modelRecords = extractModelRecords(registry.brand, registry.brandCode, model);
            allRecords.push(...modelRecords);
            brandOems += modelRecords.length;
        }

        console.log(`   ✅ ${brandOems} OEMs extracted`);
        totalOems += brandOems;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📦 Total OEMs to insert: ${totalOems}`);

    // Bulk insert
    console.log('\n💾 Inserting into SQLite...');
    const startTime = Date.now();

    try {
        const insertedCount = oemDatabase.bulkInsert(allRecords);
        const duration = Date.now() - startTime;

        console.log(`✅ Inserted ${insertedCount} records in ${duration}ms`);
    } catch (err: any) {
        console.error(`❌ Insert failed: ${err.message}`);
        throw err;
    }

    // Verify
    console.log('\n📊 Verifying database...');
    const dbStats = oemDatabase.getStats();
    console.log(`   Total Records: ${dbStats.totalRecords}`);
    console.log(`   Brands: ${Object.keys(dbStats.brands).length}`);
    console.log(`   Top Brands:`);
    Object.entries(dbStats.brands)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([brand, count]) => {
            console.log(`     - ${brand}: ${count}`);
        });

    console.log('\n🎉 Seeding complete!');
    oemDatabase.close();
}

// ============================================================================
// Extract Records from Model
// ============================================================================

function extractModelRecords(brand: string, brandCode: string, model: ModelEntry): OEMRecord[] {
    const records: OEMRecord[] = [];
    const now = new Date().toISOString();

    // Iterate all part categories
    const partCategories = ['brakes', 'filters', 'cooling', 'suspension', 'drivetrain', 'engine'] as const;

    for (const categoryName of partCategories) {
        const category = model.parts[categoryName];
        if (!category) continue;

        // Iterate all part types within category
        for (const [fieldName, variants] of Object.entries(category)) {
            if (!Array.isArray(variants)) continue;

            const typeInfo = PART_TYPE_MAP[fieldName];
            if (!typeInfo) continue;

            for (const variant of variants as PartVariant[]) {
                records.push({
                    oem: variant.oem.toUpperCase().replace(/[-\s]/g, ''),
                    brand: brand.toUpperCase(),
                    model: model.name,
                    modelCode: model.code,
                    yearFrom: model.years[0],
                    yearTo: model.years[1],
                    partCategory: typeInfo.category,
                    partDescription: variant.description || typeInfo.description,
                    supersededBy: variant.supersededBy,
                    sources: ['registry', brandCode.toLowerCase()],
                    confidence: 0.95, // High confidence for registry data
                    lastVerified: now,
                    hitCount: 0,
                });
            }
        }
    }

    return records;
}

// ============================================================================
// Run
// ============================================================================

seedDatabase().catch(err => {
    console.error('❌ Seeder failed:', err);
    process.exit(1);
});
