import * as db from './database';

export interface ForensicsStats {
    lostRevenue: number;
    drivers: { label: string; value: number }[];
    hotspots: { sku: string; cause: string; abbruch: string; retouren: string; marge: string; note: string }[];
}

export interface ConversionStats {
    funnel: { stage: string; value: number }[];
    history: { date: string; val: number }[];
    reasons: { label: string; value: number }[];
}

export async function getForensics(): Promise<ForensicsStats> {
    // 1. Calculate Lost Revenue (Aborted Orders * Avg Ticket)
    const aborted = await db.all<any>("SELECT * FROM orders WHERE status = 'aborted'");
    const lostRevenue = aborted.length * 150; // Use 150 as fallback avg ticket if no offer data

    // 2. Analyze Reasons (Keyword Match on Messages)
    const reasons: Record<string, number> = { 'Preis zu hoch': 0, 'Lieferzeit': 0, 'Sonstiges': 0 };
    for (const order of aborted) {
        const lastMsg = await db.get<any>("SELECT content FROM messages WHERE order_id = ? AND direction = 'IN' ORDER BY created_at DESC LIMIT 1", [order.id]);
        const text = lastMsg?.content?.toLowerCase() || '';
        if (text.includes('teuer') || text.includes('preis')) reasons['Preis zu hoch']++;
        else if (text.includes('dauer') || text.includes('wann')) reasons['Lieferzeit']++;
        else reasons['Sonstiges']++;
    }
    const drivers = Object.entries(reasons).map(([k, v]) => ({ label: k, value: v }));

    // 3. Hotspots (Group by OEM)
    const hotspotsMap = new Map<string, number>();
    aborted.forEach(o => {
        if (o.oem_number) hotspotsMap.set(o.oem_number, (hotspotsMap.get(o.oem_number) || 0) + 1);
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

export async function getConversion(): Promise<ConversionStats> {
    // 1. Funnel
    const total = (await db.get<any>("SELECT COUNT(*) as c FROM orders"))?.c || 0;
    const offers = (await db.get<any>("SELECT COUNT(DISTINCT order_id) as c FROM shop_offers"))?.c || 0;
    const orders = (await db.get<any>("SELECT COUNT(*) as c FROM orders WHERE status = 'done'"))?.c || 0;

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
