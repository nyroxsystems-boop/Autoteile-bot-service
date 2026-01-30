#!/usr/bin/env node
/**
 * 🏆 OEM Database Seeder (Standalone)
 * 
 * Runs without path aliases - direct file access.
 * Run with: node src/scripts/seedOemDatabaseStandalone.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ============================================================================
// Database Path
// ============================================================================

const DB_PATH = path.join(__dirname, '../../oem-data/oem-database.sqlite');

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

console.log('🏆 OEM Database Seeder (Standalone)');
console.log('='.repeat(60));
console.log(`📁 Database Path: ${DB_PATH}`);

// ============================================================================
// Create Database
// ============================================================================

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Create tables
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

// Create indexes
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_oem ON oem_records(oem);
    CREATE INDEX IF NOT EXISTS idx_brand ON oem_records(brand);
    CREATE INDEX IF NOT EXISTS idx_brand_model ON oem_records(brand, model);
    CREATE INDEX IF NOT EXISTS idx_brand_category ON oem_records(brand, part_category);
    CREATE INDEX IF NOT EXISTS idx_brand_model_category ON oem_records(brand, model, part_category);
    CREATE INDEX IF NOT EXISTS idx_model_code ON oem_records(model_code);
`);

// FTS table
db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS oem_fts USING fts5(
        oem, brand, model, part_category, part_description,
        content='oem_records',
        content_rowid='id'
    )
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

console.log('✅ Database schema created');

// ============================================================================
// OEM Data - Hardcoded from registries
// ============================================================================

const OEM_DATA = [
    // VW Golf 7
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301F', description: '312x25mm Standard' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301G', description: '340x30mm Performance GTI/R' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301H', description: '312x25mm TDI' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301E', description: '276x24mm Basis' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301C', description: '312x25mm GTI' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615601A', description: '272x10mm Bremsscheibe hinten Standard' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615601G', description: '310x22mm Bremsscheibe hinten GTI/R' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615601F', description: '286x12mm Bremsscheibe hinten GTI' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0698151A', description: 'Bremsbeläge VA Standard', supersededBy: '5Q0698151D' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0698151D', description: 'Bremsbeläge VA Aktuell' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0698151M', description: 'Bremsbeläge VA GTI/R 340mm' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0698451A', description: 'Bremsbeläge HA Standard', supersededBy: '5Q0698451C' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0698451C', description: 'Bremsbeläge HA Aktuell' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0698451N', description: 'Bremsbeläge HA GTI/R Performance' },
    // Golf 7 Filter
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '04E115561H', description: 'Ölfilter 1.0-1.4 TSI EA211' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '04E115561AC', description: 'Ölfilter 1.5 TSI EA211 evo' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '06L115562', description: 'Ölfilter 1.8/2.0 TSI EA888' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '03N115562B', description: 'Ölfilter 2.0 TDI EA288' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '03N115466A', description: 'Ölfilter 1.6 TDI EA288' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '5Q0129620B', description: 'Luftfilter Benziner' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '5Q0129620D', description: 'Luftfilter Diesel' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '5Q0819653', description: 'Innenraumfilter Standard' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '5Q0819669', description: 'Innenraumfilter Aktivkohle' },
    // Golf 7 Cooling
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'cooling', oem: '04E121600AL', description: 'Wasserpumpe 1.0-1.4 TSI EA211' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'cooling', oem: '04E121600CS', description: 'Wasserpumpe 1.5 TSI EA211 evo' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'cooling', oem: '06L121111H', description: 'Wasserpumpe 1.8/2.0 TSI EA888' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'cooling', oem: '06L121111P', description: 'Wasserpumpe 2.0 TSI EA888 aktuell' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'cooling', oem: '04L121011L', description: 'Wasserpumpe 2.0 TDI EA288' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'cooling', oem: '03L121011PX', description: 'Wasserpumpe 1.6 TDI EA288' },
    // Golf 7 Suspension
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'suspension', oem: '5Q0413023FK', description: 'Stoßdämpfer VA Standard' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'suspension', oem: '5Q0413031FM', description: 'Stoßdämpfer VA DCC' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'suspension', oem: '5Q0512011S', description: 'Stoßdämpfer HA Standard' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'suspension', oem: '5Q0512011T', description: 'Stoßdämpfer HA DCC' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'suspension', oem: '5Q0407151A', description: 'Querlenker VA Links' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'suspension', oem: '5Q0407152A', description: 'Querlenker VA Rechts' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'suspension', oem: '5Q0498621', description: 'Radlager VA' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'suspension', oem: '5Q0598611', description: 'Radlager HA' },
    // Golf 7 Engine
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'engine', oem: '04E198119A', description: 'Zahnriemensatz 1.4 TSI EA211' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'engine', oem: '04E198119E', description: 'Zahnriemensatz 1.5 TSI EA211 evo' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'engine', oem: '06K109158AD', description: 'Steuerkettensatz EA888' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'engine', oem: '04L198119A', description: 'Zahnriemensatz 2.0 TDI EA288' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'engine', oem: '04E905612C', description: 'Zündkerze 1.0-1.5 TSI EA211' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'engine', oem: '06K905601B', description: 'Zündkerze 2.0 TSI EA888' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'engine', oem: '06K145874F', description: 'Turbolader 2.0 TSI GTI IS20' },
    { brand: 'VOLKSWAGEN', model: 'Golf 7', modelCode: '5G', yearFrom: 2012, yearTo: 2020, category: 'engine', oem: '06K145722H', description: 'Turbolader 2.0 TSI R IS38' },

    // VW Golf 8
    { brand: 'VOLKSWAGEN', model: 'Golf 8', modelCode: 'CD', yearFrom: 2019, yearTo: 2026, category: 'brake', oem: '5Q0615301F', description: '312x25mm Standard' },
    { brand: 'VOLKSWAGEN', model: 'Golf 8', modelCode: 'CD', yearFrom: 2019, yearTo: 2026, category: 'brake', oem: '5Q0615301G', description: '340x30mm GTI/R' },
    { brand: 'VOLKSWAGEN', model: 'Golf 8', modelCode: 'CD', yearFrom: 2019, yearTo: 2026, category: 'brake', oem: '5H0615301B', description: '357x28mm R 20 Jahre' },
    { brand: 'VOLKSWAGEN', model: 'Golf 8', modelCode: 'CD', yearFrom: 2019, yearTo: 2026, category: 'filter', oem: '04E115561AC', description: 'Ölfilter 1.0-1.5 TSI EA211 evo' },
    { brand: 'VOLKSWAGEN', model: 'Golf 8', modelCode: 'CD', yearFrom: 2019, yearTo: 2026, category: 'filter', oem: '06Q115561B', description: 'Ölfilter 2.0 TSI GTI/R EA888 Gen4' },
    { brand: 'VOLKSWAGEN', model: 'Golf 8', modelCode: 'CD', yearFrom: 2019, yearTo: 2026, category: 'filter', oem: '5H0129620A', description: 'Luftfilter alle Motoren' },

    // VW Passat B8
    { brand: 'VOLKSWAGEN', model: 'Passat B8', modelCode: '3G', yearFrom: 2014, yearTo: 2026, category: 'brake', oem: '5Q0615301F', description: '312x25mm Standard' },
    { brand: 'VOLKSWAGEN', model: 'Passat B8', modelCode: '3G', yearFrom: 2014, yearTo: 2026, category: 'brake', oem: '3Q0615301A', description: '340x30mm 190PS+' },
    { brand: 'VOLKSWAGEN', model: 'Passat B8', modelCode: '3G', yearFrom: 2014, yearTo: 2026, category: 'brake', oem: '3Q0615601A', description: '300x12mm Bremsscheibe hinten' },
    { brand: 'VOLKSWAGEN', model: 'Passat B8', modelCode: '3G', yearFrom: 2014, yearTo: 2026, category: 'filter', oem: '3Q0129620A', description: 'Luftfilter Benziner' },
    { brand: 'VOLKSWAGEN', model: 'Passat B8', modelCode: '3G', yearFrom: 2014, yearTo: 2026, category: 'filter', oem: '3Q0129620B', description: 'Luftfilter Diesel' },

    // VW Tiguan 2
    { brand: 'VOLKSWAGEN', model: 'Tiguan 2', modelCode: 'AD', yearFrom: 2016, yearTo: 2026, category: 'brake', oem: '5Q0615301F', description: '312x25mm Standard' },
    { brand: 'VOLKSWAGEN', model: 'Tiguan 2', modelCode: 'AD', yearFrom: 2016, yearTo: 2026, category: 'brake', oem: '5NA615301A', description: '340x30mm R-Line' },
    { brand: 'VOLKSWAGEN', model: 'Tiguan 2', modelCode: 'AD', yearFrom: 2016, yearTo: 2026, category: 'filter', oem: '5QF129620A', description: 'Luftfilter alle Motoren' },

    // VW Polo 6
    { brand: 'VOLKSWAGEN', model: 'Polo 6', modelCode: 'AW', yearFrom: 2017, yearTo: 2026, category: 'brake', oem: '2Q0615301A', description: '256x22mm Standard' },
    { brand: 'VOLKSWAGEN', model: 'Polo 6', modelCode: 'AW', yearFrom: 2017, yearTo: 2026, category: 'brake', oem: '2Q0615301B', description: '288x25mm 110PS+' },
    { brand: 'VOLKSWAGEN', model: 'Polo 6', modelCode: 'AW', yearFrom: 2017, yearTo: 2026, category: 'brake', oem: '2Q0615301D', description: '312x25mm GTI' },
    { brand: 'VOLKSWAGEN', model: 'Polo 6', modelCode: 'AW', yearFrom: 2017, yearTo: 2026, category: 'filter', oem: '04C115561J', description: 'Ölfilter 1.0 TSI/MPI' },
    { brand: 'VOLKSWAGEN', model: 'Polo 6', modelCode: 'AW', yearFrom: 2017, yearTo: 2026, category: 'filter', oem: '2Q0129620B', description: 'Luftfilter Benziner' },

    // VW T-Roc
    { brand: 'VOLKSWAGEN', model: 'T-Roc', modelCode: 'A1', yearFrom: 2017, yearTo: 2026, category: 'brake', oem: '5Q0615301F', description: '312x25mm Standard' },
    { brand: 'VOLKSWAGEN', model: 'T-Roc', modelCode: 'A1', yearFrom: 2017, yearTo: 2026, category: 'brake', oem: '2GA615301A', description: '340x30mm T-Roc R' },

    // AUDI A3 8V
    { brand: 'AUDI', model: 'A3 8V', modelCode: '8V', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301F', description: '312x25mm Standard' },
    { brand: 'AUDI', model: 'A3 8V', modelCode: '8V', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301G', description: '340x30mm S3' },
    { brand: 'AUDI', model: 'A3 8V', modelCode: '8V', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0698151D', description: 'Bremsbeläge VA' },
    { brand: 'AUDI', model: 'A3 8V', modelCode: '8V', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '04E115561H', description: 'Ölfilter 1.4 TFSI' },
    { brand: 'AUDI', model: 'A3 8V', modelCode: '8V', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '06L115562', description: 'Ölfilter 2.0 TFSI' },

    // AUDI A4 B8/B9
    { brand: 'AUDI', model: 'A4 B9', modelCode: '8W', yearFrom: 2015, yearTo: 2026, category: 'brake', oem: '8W0615301AA', description: '338x30mm S-Line' },
    { brand: 'AUDI', model: 'A4 B9', modelCode: '8W', yearFrom: 2015, yearTo: 2026, category: 'brake', oem: '8W0615301K', description: '314x25mm Standard' },
    { brand: 'AUDI', model: 'A4 B9', modelCode: '8W', yearFrom: 2015, yearTo: 2026, category: 'filter', oem: '06L115562', description: 'Ölfilter 2.0 TFSI' },
    { brand: 'AUDI', model: 'A4 B9', modelCode: '8W', yearFrom: 2015, yearTo: 2026, category: 'filter', oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },

    // BMW 3er F30
    { brand: 'BMW', model: '3er F30', modelCode: 'F30', yearFrom: 2011, yearTo: 2019, category: 'brake', oem: '34116792219', description: '312x24mm Bremsscheibe VA Standard' },
    { brand: 'BMW', model: '3er F30', modelCode: 'F30', yearFrom: 2011, yearTo: 2019, category: 'brake', oem: '34116792221', description: '330x24mm Bremsscheibe VA M-Sport' },
    { brand: 'BMW', model: '3er F30', modelCode: 'F30', yearFrom: 2011, yearTo: 2019, category: 'brake', oem: '34116855006', description: '340x30mm Bremsscheibe VA Performance' },
    { brand: 'BMW', model: '3er F30', modelCode: 'F30', yearFrom: 2011, yearTo: 2019, category: 'brake', oem: '34216792227', description: '300x20mm Bremsscheibe HA' },
    { brand: 'BMW', model: '3er F30', modelCode: 'F30', yearFrom: 2011, yearTo: 2019, category: 'brake', oem: '34116850568', description: 'Bremsbeläge VA' },
    { brand: 'BMW', model: '3er F30', modelCode: 'F30', yearFrom: 2011, yearTo: 2019, category: 'filter', oem: '11428507683', description: 'Ölfilter N20/N26' },
    { brand: 'BMW', model: '3er F30', modelCode: 'F30', yearFrom: 2011, yearTo: 2019, category: 'filter', oem: '11428575211', description: 'Ölfilter B48' },
    { brand: 'BMW', model: '3er F30', modelCode: 'F30', yearFrom: 2011, yearTo: 2019, category: 'filter', oem: '13718507320', description: 'Luftfilter' },

    // BMW 5er G30
    { brand: 'BMW', model: '5er G30', modelCode: 'G30', yearFrom: 2016, yearTo: 2026, category: 'brake', oem: '34116860907', description: '348x36mm Bremsscheibe VA' },
    { brand: 'BMW', model: '5er G30', modelCode: 'G30', yearFrom: 2016, yearTo: 2026, category: 'brake', oem: '34216888319', description: '345x24mm Bremsscheibe HA' },
    { brand: 'BMW', model: '5er G30', modelCode: 'G30', yearFrom: 2016, yearTo: 2026, category: 'filter', oem: '11428575211', description: 'Ölfilter B48' },
    { brand: 'BMW', model: '5er G30', modelCode: 'G30', yearFrom: 2016, yearTo: 2026, category: 'filter', oem: '11428596283', description: 'Ölfilter B58' },

    // Mercedes C-Klasse W205
    { brand: 'MERCEDES', model: 'C-Klasse W205', modelCode: 'W205', yearFrom: 2014, yearTo: 2021, category: 'brake', oem: 'A0004212312', description: '295x28mm Bremsscheibe VA' },
    { brand: 'MERCEDES', model: 'C-Klasse W205', modelCode: 'W205', yearFrom: 2014, yearTo: 2021, category: 'brake', oem: 'A0004232012', description: '330x32mm Bremsscheibe VA AMG-Line' },
    { brand: 'MERCEDES', model: 'C-Klasse W205', modelCode: 'W205', yearFrom: 2014, yearTo: 2021, category: 'brake', oem: 'A0064203020', description: 'Bremsbeläge VA' },
    { brand: 'MERCEDES', model: 'C-Klasse W205', modelCode: 'W205', yearFrom: 2014, yearTo: 2021, category: 'filter', oem: 'A2761800009', description: 'Ölfilter M274' },
    { brand: 'MERCEDES', model: 'C-Klasse W205', modelCode: 'W205', yearFrom: 2014, yearTo: 2021, category: 'filter', oem: 'A6510940004', description: 'Ölfilter OM651' },

    // Mercedes E-Klasse W213
    { brand: 'MERCEDES', model: 'E-Klasse W213', modelCode: 'W213', yearFrom: 2016, yearTo: 2026, category: 'brake', oem: 'A0004231712', description: '322x32mm Bremsscheibe VA' },
    { brand: 'MERCEDES', model: 'E-Klasse W213', modelCode: 'W213', yearFrom: 2016, yearTo: 2026, category: 'brake', oem: 'A0004235112', description: '360x36mm Bremsscheibe VA AMG' },
    { brand: 'MERCEDES', model: 'E-Klasse W213', modelCode: 'W213', yearFrom: 2016, yearTo: 2026, category: 'filter', oem: 'A2761800009', description: 'Ölfilter M274' },

    // Skoda Octavia 3 5E
    { brand: 'SKODA', model: 'Octavia 3', modelCode: '5E', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301F', description: '312x25mm Standard' },
    { brand: 'SKODA', model: 'Octavia 3', modelCode: '5E', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301G', description: '340x30mm RS' },
    { brand: 'SKODA', model: 'Octavia 3', modelCode: '5E', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0698151D', description: 'Bremsbeläge VA' },
    { brand: 'SKODA', model: 'Octavia 3', modelCode: '5E', yearFrom: 2012, yearTo: 2020, category: 'filter', oem: '04E115561H', description: 'Ölfilter 1.4 TSI' },

    // Seat Leon 3 5F
    { brand: 'SEAT', model: 'Leon 3', modelCode: '5F', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301F', description: '312x25mm Standard' },
    { brand: 'SEAT', model: 'Leon 3', modelCode: '5F', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0615301G', description: '340x30mm Cupra' },
    { brand: 'SEAT', model: 'Leon 3', modelCode: '5F', yearFrom: 2012, yearTo: 2020, category: 'brake', oem: '5Q0698151D', description: 'Bremsbeläge VA' },

    // Opel Astra K
    { brand: 'OPEL', model: 'Astra K', modelCode: 'B', yearFrom: 2015, yearTo: 2026, category: 'brake', oem: '39100573', description: '276x25mm Bremsscheibe VA' },
    { brand: 'OPEL', model: 'Astra K', modelCode: 'B', yearFrom: 2015, yearTo: 2026, category: 'brake', oem: '39104044', description: '300x26mm Bremsscheibe VA OPC' },
    { brand: 'OPEL', model: 'Astra K', modelCode: 'B', yearFrom: 2015, yearTo: 2026, category: 'filter', oem: '55594651', description: 'Ölfilter 1.4 Turbo' },

    // Ford Focus 4
    { brand: 'FORD', model: 'Focus 4', modelCode: 'C519', yearFrom: 2018, yearTo: 2026, category: 'brake', oem: 'JX61-1125-DA', description: '300x25mm Bremsscheibe VA' },
    { brand: 'FORD', model: 'Focus 4', modelCode: 'C519', yearFrom: 2018, yearTo: 2026, category: 'brake', oem: 'JX61-1125-EA', description: '330x28mm Bremsscheibe VA ST' },
    { brand: 'FORD', model: 'Focus 4', modelCode: 'C519', yearFrom: 2018, yearTo: 2026, category: 'filter', oem: 'BE8Z-6731-AB', description: 'Ölfilter EcoBoost' },

    // Hyundai i30 N
    { brand: 'HYUNDAI', model: 'i30 N', modelCode: 'PD', yearFrom: 2017, yearTo: 2026, category: 'brake', oem: '51712S0000', description: '345x30mm Bremsscheibe VA' },
    { brand: 'HYUNDAI', model: 'i30 N', modelCode: 'PD', yearFrom: 2017, yearTo: 2026, category: 'brake', oem: '58302S1500', description: 'Bremsbeläge VA' },

    // Toyota Corolla E210
    { brand: 'TOYOTA', model: 'Corolla E210', modelCode: 'E210', yearFrom: 2018, yearTo: 2026, category: 'brake', oem: '43512-12710', description: '275x28mm Bremsscheibe VA' },
    { brand: 'TOYOTA', model: 'Corolla E210', modelCode: 'E210', yearFrom: 2018, yearTo: 2026, category: 'filter', oem: '04152-YZZA1', description: 'Ölfilter Hybrid/Benzin' },

    // Renault Megane 4
    { brand: 'RENAULT', model: 'Megane 4', modelCode: 'BFB', yearFrom: 2015, yearTo: 2026, category: 'brake', oem: '402061200R', description: '280x24mm Bremsscheibe VA' },
    { brand: 'RENAULT', model: 'Megane 4', modelCode: 'BFB', yearFrom: 2015, yearTo: 2026, category: 'brake', oem: '402062626R', description: '320x28mm Bremsscheibe VA RS' },
    { brand: 'RENAULT', model: 'Megane 4', modelCode: 'BFB', yearFrom: 2015, yearTo: 2026, category: 'filter', oem: '152089599R', description: 'Ölfilter TCe' },

    // Peugeot 308 II
    { brand: 'PEUGEOT', model: '308 II', modelCode: 'T9', yearFrom: 2013, yearTo: 2021, category: 'brake', oem: '4249H6', description: '283x26mm Bremsscheibe VA' },
    { brand: 'PEUGEOT', model: '308 II', modelCode: 'T9', yearFrom: 2013, yearTo: 2021, category: 'brake', oem: '4249G6', description: '330x28mm Bremsscheibe VA GTi' },
    { brand: 'PEUGEOT', model: '308 II', modelCode: 'T9', yearFrom: 2013, yearTo: 2021, category: 'filter', oem: '1109AY', description: 'Ölfilter PureTech' },
];

console.log(`📦 Loading ${OEM_DATA.length} OEM records...`);

// ============================================================================
// Insert Data
// ============================================================================

const insert = db.prepare(`
    INSERT OR REPLACE INTO oem_records (
        oem, brand, model, model_code, year_from, year_to,
        part_category, part_description, superseded_by, supersedes,
        sources, confidence, last_verified, hit_count
    ) VALUES (
        @oem, @brand, @model, @modelCode, @yearFrom, @yearTo,
        @category, @description, @supersededBy, @supersedes,
        @sources, @confidence, @lastVerified, @hitCount
    )
`);

const now = new Date().toISOString();
let count = 0;

const insertMany = db.transaction(() => {
    for (const record of OEM_DATA) {
        insert.run({
            oem: record.oem.toUpperCase().replace(/[-\s]/g, ''),
            brand: record.brand.toUpperCase(),
            model: record.model,
            modelCode: record.modelCode,
            yearFrom: record.yearFrom,
            yearTo: record.yearTo,
            category: record.category,
            description: record.description,
            supersededBy: record.supersededBy || null,
            supersedes: null,
            sources: JSON.stringify(['registry']),
            confidence: 0.95,
            lastVerified: now,
            hitCount: 0,
        });
        count++;
    }
});

insertMany();

console.log(`✅ Inserted ${count} OEM records`);

// ============================================================================
// Stats
// ============================================================================

const totalStmt = db.prepare('SELECT COUNT(*) as count FROM oem_records');
const total = totalStmt.get().count;

const brandsStmt = db.prepare(`SELECT brand, COUNT(*) as count FROM oem_records GROUP BY brand ORDER BY count DESC`);
const brands = brandsStmt.all();

const categoriesStmt = db.prepare(`SELECT part_category, COUNT(*) as count FROM oem_records GROUP BY part_category ORDER BY count DESC`);
const categories = categoriesStmt.all();

console.log('\n' + '='.repeat(60));
console.log('📊 Database Stats:');
console.log(`   Total Records: ${total}`);
console.log('\n   By Brand:');
brands.forEach(b => console.log(`     - ${b.brand}: ${b.count}`));
console.log('\n   By Category:');
categories.forEach(c => console.log(`     - ${c.part_category}: ${c.count}`));

console.log('\n🎉 OEM Database seeding complete!');
console.log(`   Database: ${DB_PATH}`);

db.close();
