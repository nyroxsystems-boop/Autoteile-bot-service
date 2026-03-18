/**
 * OEM Database Auto-Update Pipeline
 * 
 * Fetches new parts mapping from external storage/CSV
 * Performs a delta import into the SQLite generic_oem_database.
 * Only processes new or modified records.
 */

import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import sqlite3 from 'better-sqlite3';
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../services/core/activityLogger';

const DB_PATH = path.join(__dirname, '../../data/generic_oem_database.sqlite');

interface OemRecord {
    oem: string;
    brand: string;
    part_category: string;
    part_description: string;
    model: string;
}

/**
 * Downloads the latest OEM CSV file from a configurable source.
 * In a real-world scenario, this might download from an S3 bucket or FTP.
 * For this prototype, we'll assume the file is placed in a /data/updates folder.
 */
async function getLatestUpdateFile(): Promise<string | null> {
    const updateDir = path.join(__dirname, '../../data/updates');
    
    if (!fs.existsSync(updateDir)) {
        fs.mkdirSync(updateDir, { recursive: true });
        logger.info('[OEM Updater] Created updates directory at ' + updateDir);
        return null;
    }

    const files = fs.readdirSync(updateDir)
        .filter(f => f.endsWith('.csv'))
        .sort() // Sort alphabetically (assuming YYYY-MM-DD format)
        .reverse(); // Newest first

    if (files.length === 0) {
        return null; // No updates available
    }

    return path.join(updateDir, files[0]);
}

/**
 * Parses a CSV file and yields records.
 */
async function parseCsv(filePath: string): Promise<OemRecord[]> {
    const results: OemRecord[] = [];
    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let isHeader = true;
    let headers: string[] = [];

    for await (const line of rl) {
        if (!line.trim()) continue;
        
        const cols = line.split(',').map(c => c.trim());
        
        if (isHeader) {
            headers = cols;
            isHeader = false;
            continue;
        }

        const record: Partial<OemRecord> = {};
        for (let i = 0; i < headers.length; i++) {
            if (i < cols.length) {
                record[headers[i] as keyof OemRecord] = cols[i];
            }
        }
        
        if (record.oem && record.brand) {
             results.push(record as OemRecord);
        }
    }

    return results;
}

/**
 * Processes the delta import into the database.
 */
export async function runOemAutoUpdate(): Promise<{ success: boolean; added: number; updated: number; message: string }> {
    logger.info('[OEM Updater] Pipeline gestartet');
    
    try {
        const fileToProcess = await getLatestUpdateFile();
        
        if (!fileToProcess) {
            logger.info('[OEM Updater] Keine neuen Updates gefunden');
            return { success: true, added: 0, updated: 0, message: 'Keine neuen Dateien' };
        }
        
        logger.info(`[OEM Updater] Verarbeite Update-Datei: ${path.basename(fileToProcess)}`);
        
        const records = await parseCsv(fileToProcess);
        if (records.length === 0) {
            return { success: true, added: 0, updated: 0, message: 'CSV war leer' };
        }
        
        const db = new sqlite3(DB_PATH);
        let addedCount = 0;
        let updatedCount = 0;
        
        // Use a transaction for the entire update
        db.exec('BEGIN TRANSACTION');
        
        const existingStmt = db.prepare('SELECT id FROM generic_oem_database WHERE oem = ? AND brand = ? AND model = ?');
        const updateStmt = db.prepare(`UPDATE generic_oem_database 
                     SET part_category = ?, part_description = ?
                     WHERE id = ?`);
        const insertStmt = db.prepare(`INSERT INTO generic_oem_database 
                     (oem, brand, part_category, part_description, model, confidence, sources) 
                     VALUES (?, ?, ?, ?, ?, 1.0, 'auto-import')`);

        for (const record of records) {
            // Check if OEM already exists for this brand and model
            const existing = existingStmt.get(record.oem, record.brand, record.model) as any;
            
            if (existing) {
                // Update existing record
                updateStmt.run(record.part_category, record.part_description, existing.id);
                updatedCount++;
            } else {
                // Insert new record
                insertStmt.run(record.oem, record.brand, record.part_category, record.part_description, record.model);
                addedCount++;
            }
        }
        
        db.exec('COMMIT');
        db.close();
        
        // Rename the file so it's not processed again
        const processedPath = `${fileToProcess}.processed.${Date.now()}`;
        fs.renameSync(fileToProcess, processedPath);
        
        logger.info(`[OEM Updater] Erfolgreich abgeschlossen. Hinzugefügt: ${addedCount}, Aktualisiert: ${updatedCount}`);
        
        // Log to audit trail
        await logActivity({
            adminUsername: 'System',
            actionType: 'OEM_DB_UPDATE',
            entityType: 'OEM_DATABASE',
            newValue: { added: addedCount, updated: updatedCount, file: path.basename(fileToProcess) }
        });

        return { 
            success: true, 
            added: addedCount, 
            updated: updatedCount, 
            message: `Hinzugefügt: ${addedCount}, Aktualisiert: ${updatedCount}` 
        };
        
    } catch (error: any) {
        logger.error('[OEM Updater] Kritischer Fehler:', error);
        // Attempt to rollback if in transaction
        try {
            const db = new sqlite3(DB_PATH);
            db.exec('ROLLBACK');
            db.close();
        } catch (e) {
            // Ignore rollback errors
        }
        
        await logActivity({
            adminUsername: 'System',
            actionType: 'OEM_DB_UPDATE_FAILED',
            entityType: 'OEM_DATABASE',
            newValue: { error: error.message }
        });

        return { success: false, added: 0, updated: 0, message: `Fehler: ${error.message}` };
    }
}

// Run if executed directly
if (require.main === module) {
    runOemAutoUpdate().then(res => {
        console.log(res);
        process.exit(res.success ? 0 : 1);
    });
}
