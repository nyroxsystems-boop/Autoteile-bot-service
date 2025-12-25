import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import { logger } from '../utils/logger';

const DB_PATH = path.join(process.cwd(), 'crm.db');

let db: Database;

export function initDb(): Promise<void> {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                logger.error('Could not connect to database', err);
                reject(err);
            } else {
                logger.info('Connected to SQLite database at ' + DB_PATH);
                createTables().then(resolve).catch(reject);
            }
        });
    });
}

function createTables(): Promise<void> {
    const queries = [
        `CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            customer_contact TEXT,
            status TEXT,
            created_at TEXT,
            updated_at TEXT,
            oem_number TEXT,
            order_data TEXT, 
            vehicle_data TEXT,
            scrape_result TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            order_id TEXT,
            direction TEXT,
            content TEXT,
            created_at TEXT,
            channel TEXT,
            raw_payload TEXT,
            FOREIGN KEY(order_id) REFERENCES orders(id)
        )`,
        `CREATE TABLE IF NOT EXISTS shop_offers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT,
            oem TEXT,
            data TEXT,
            inserted_at TEXT,
            FOREIGN KEY(order_id) REFERENCES orders(id)
        )`,
        `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT,
            role TEXT,
            created_at TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS merchant_settings (
            merchant_id TEXT PRIMARY KEY,
            settings TEXT
        )`
    ];

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            let completed = 0;
            queries.forEach((query) => {
                db.run(query, (err) => {
                    if (err) {
                        logger.error('Error creating table', err);
                        reject(err);
                        return;
                    }
                    completed++;
                    if (completed === queries.length) {
                        resolve();
                    }
                });
            });
        });
    });
}

export function getDb(): Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDb() first.');
    }
    return db;
}

// Helper for Promisified running
export function run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        getDb().run(sql, params, function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

export function get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        getDb().get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row as T);
        });
    });
}

export function all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        getDb().all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows as T[]);
        });
    });
}
