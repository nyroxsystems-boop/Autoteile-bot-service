"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getForensics = getForensics;
exports.getConversion = getConversion;
const db = __importStar(require("./database"));
async function getForensics() {
    // 1. Calculate Lost Revenue (Aborted Orders * Avg Ticket)
    const aborted = await db.all("SELECT * FROM orders WHERE status = 'aborted'");
    const lostRevenue = aborted.length * 150; // Use 150 as fallback avg ticket if no offer data
    // 2. Analyze Reasons (Keyword Match on Messages)
    const reasons = { 'Preis zu hoch': 0, 'Lieferzeit': 0, 'Sonstiges': 0 };
    for (const order of aborted) {
        const lastMsg = await db.get("SELECT content FROM messages WHERE order_id = ? AND direction = 'IN' ORDER BY created_at DESC LIMIT 1", [order.id]);
        const text = lastMsg?.content?.toLowerCase() || '';
        if (text.includes('teuer') || text.includes('preis'))
            reasons['Preis zu hoch']++;
        else if (text.includes('dauer') || text.includes('wann'))
            reasons['Lieferzeit']++;
        else
            reasons['Sonstiges']++;
    }
    const drivers = Object.entries(reasons).map(([k, v]) => ({ label: k, value: v }));
    // 3. Hotspots (Group by OEM)
    const hotspotsMap = new Map();
    aborted.forEach(o => {
        if (o.oem_number)
            hotspotsMap.set(o.oem_number, (hotspotsMap.get(o.oem_number) || 0) + 1);
    });
    // Top 5 Hotspots
    const hotspots = Array.from(hotspotsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([oem, count]) => ({
        sku: oem,
        cause: 'Analyse läuft',
        abbruch: `${count} orders`,
        retouren: '0%',
        marge: 'N/A',
        note: 'Automatisch erkannt'
    }));
    return { lostRevenue, drivers, hotspots };
}
async function getConversion() {
    // 1. Funnel
    const total = (await db.get("SELECT COUNT(*) as c FROM orders"))?.c || 0;
    const offers = (await db.get("SELECT COUNT(DISTINCT order_id) as c FROM shop_offers"))?.c || 0;
    const orders = (await db.get("SELECT COUNT(*) as c FROM orders WHERE status = 'done'"))?.c || 0;
    // 2. History (Last 7 Days)
    const history = []; // TODO: Implement daily grouping SQL
    return {
        funnel: [
            { stage: 'Anfragen', value: total },
            { stage: 'Angebote', value: offers },
            { stage: 'Bestellungen', value: orders }
        ],
        history: [],
        reasons: []
    };
}
