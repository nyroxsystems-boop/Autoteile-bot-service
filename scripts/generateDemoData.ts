/**
 * Demo Data Generator for WAWI System
 * Generates realistic dealer data for testing the complete system
 */

import * as db from '../src/services/database';
import { randomUUID } from 'crypto';

const DEALER_ID = 'dealer-demo-001';
const DEALER_NAME = 'AutoTeile Müller GmbH';
const DEALER_ADDRESS = 'Hauptstraße 123, 10115 Berlin';

// Realistic customer names
const CUSTOMER_NAMES = [
    'Thomas Schmidt', 'Maria Weber', 'Michael Becker', 'Anna Hoffmann',
    'Christian Meyer', 'Julia Fischer', 'Stefan Wagner', 'Laura Schulz',
    'Daniel Koch', 'Sarah Bauer', 'Markus Richter', 'Lisa Klein',
    'Andreas Wolf', 'Nina Schröder', 'Patrick Neumann', 'Jennifer Braun'
];

// Realistic vehicle data
const VEHICLES = [
    { make: 'VW', model: 'Golf VII', year: 2018, engine: '1.5 TSI' },
    { make: 'Audi', model: 'A4', year: 2019, engine: '2.0 TDI' },
    { make: 'BMW', model: '3er', year: 2020, engine: '2.0d' },
    { make: 'Mercedes', model: 'C-Klasse', year: 2017, engine: '2.2 CDI' },
    { make: 'Opel', model: 'Astra', year: 2016, engine: '1.6 CDTI' },
    { make: 'Ford', model: 'Focus', year: 2019, engine: '1.0 EcoBoost' },
    { make: 'Seat', model: 'Leon', year: 2018, engine: '1.4 TSI' },
    { make: 'Skoda', model: 'Octavia', year: 2020, engine: '2.0 TDI' },
    { make: 'Renault', model: 'Megane', year: 2017, engine: '1.5 dCi' },
    { make: 'Peugeot', model: '308', year: 2019, engine: '1.6 BlueHDi' }
];

// Realistic part requests
const PARTS = [
    { name: 'Bremsscheiben vorne', oem: '1K0615301AA', category: 'Bremsen' },
    { name: 'Bremsbeläge hinten', oem: '8V0698451B', category: 'Bremsen' },
    { name: 'Luftfilter', oem: '5Q0129620D', category: 'Filter' },
    { name: 'Ölfilter', oem: '03L115562', category: 'Filter' },
    { name: 'Stoßdämpfer vorne', oem: '5Q0413031BT', category: 'Fahrwerk' },
    { name: 'Keilrippenriemen', oem: '03L145933L', category: 'Motor' },
    { name: 'Zündkerzen', oem: '101905601B', category: 'Zündung' },
    { name: 'Scheibenwischer', oem: '5G1955425A', category: 'Karosserie' },
    { name: 'Kraftstofffilter', oem: '5Q0127177A', category: 'Filter' },
    { name: 'Kupplungssatz', oem: '02M141165MX', category: 'Antrieb' },
    { name: 'Wasserpumpe', oem: '06H121026BA', category: 'Kühlung' },
    { name: 'Thermostat', oem: '06L121111H', category: 'Kühlung' },
    { name: 'Lichtmaschine', oem: '06J903023H', category: 'Elektrik' },
    { name: 'Anlasser', oem: '02Z911024S', category: 'Elektrik' },
    { name: 'Batterie 70Ah', oem: 'JZW915105C', category: 'Elektrik' }
];

// Shop offers with realistic pricing
const SHOPS = [
    { name: 'Autodoc', baseMultiplier: 0.85, deliveryDays: 2 },
    { name: 'kfzteile24', baseMultiplier: 0.90, deliveryDays: 1 },
    { name: 'pkwteile.de', baseMultiplier: 0.88, deliveryDays: 3 },
    { name: 'Händler-Lager', baseMultiplier: 1.0, deliveryDays: 0 }
];

const ORDER_STATUSES = [
    'choose_language',
    'collect_vehicle',
    'collect_part',
    'oem_lookup',
    'show_offers',
    'done'
];

function genId(prefix = 'order'): string {
    return `${prefix}-${randomUUID().split('-')[0]}-${Date.now().toString(36)}`;
}

function randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function randomDate(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
    date.setHours(Math.floor(Math.random() * 24));
    date.setMinutes(Math.floor(Math.random() * 60));
    return date.toISOString();
}

function generatePhoneNumber(): string {
    const prefix = '+4915';
    const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return `${prefix}${suffix}`;
}

async function generateOrders(count: number) {
    console.log(`\n📦 Generating ${count} demo orders...`);
    const orders = [];

    for (let i = 0; i < count; i++) {
        const customerName = randomElement(CUSTOMER_NAMES);
        const customerContact = generatePhoneNumber();
        const vehicle = randomElement(VEHICLES);
        const part = randomElement(PARTS);
        const status = randomElement(ORDER_STATUSES);
        const createdAt = randomDate(30); // Last 30 days

        const orderId = genId('order');

        const orderData = {
            conversationStatus: status,
            vehicleDescription: `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
            partDescription: part.name,
            language: 'de',
            customerName
        };

        const vehicleData = JSON.stringify(vehicle);
        const orderDataJson = JSON.stringify(orderData);

        await db.run(
            `INSERT INTO orders (id, customer_contact, status, created_at, updated_at, oem_number, order_data, vehicle_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, customerContact, status, createdAt, createdAt, part.oem, orderDataJson, vehicleData]
        );

        orders.push({ orderId, part, vehicle, status });

        // Generate messages for this order
        await generateMessages(orderId, customerContact, part.name, 3 + Math.floor(Math.random() * 5));

        // Generate offers if status is show_offers or done
        if (status === 'show_offers' || status === 'done') {
            await generateOffers(orderId, part);
        }
    }

    console.log(`✅ Generated ${count} orders with messages and offers`);
    return orders;
}

async function generateMessages(orderId: string, customerContact: string, partName: string, count: number) {
    const messages = [
        { direction: 'IN', content: `Hallo, ich brauche ${partName}` },
        { direction: 'OUT', content: 'Guten Tag! Für welches Fahrzeug benötigen Sie das Teil?' },
        { direction: 'IN', content: 'Für meinen Golf 7 von 2018' },
        { direction: 'OUT', content: 'Vielen Dank! Ich suche passende Angebote für Sie.' },
        { direction: 'OUT', content: 'Ich habe mehrere Angebote für Sie gefunden.' },
        { direction: 'IN', content: 'Welches ist am günstigsten?' },
        { direction: 'OUT', content: 'Das günstigste Angebot ist von Autodoc für 45,99 EUR.' },
        { direction: 'IN', content: 'Perfekt, das nehme ich!' }
    ];

    for (let i = 0; i < Math.min(count, messages.length); i++) {
        const msg = messages[i];
        const msgId = genId('msg');
        const createdAt = randomDate(30);

        await db.run(
            `INSERT INTO messages (id, order_id, direction, content, created_at) VALUES (?, ?, ?, ?, ?)`,
            [msgId, orderId, msg.direction, msg.content, createdAt]
        );
    }
}

async function generateOffers(orderId: string, part: any) {
    const basePrice = 30 + Math.random() * 150; // €30-180

    for (const shop of SHOPS) {
        const price = basePrice * shop.baseMultiplier;
        const finalPrice = price * 1.25; // 25% margin

        const offerData = {
            shopName: shop.name,
            brand: randomElement(['OEM', 'Bosch', 'Brembo', 'Mann', 'Sachs', 'Bilstein']),
            productName: part.name,
            price: parseFloat(price.toFixed(2)),
            finalPrice: parseFloat(finalPrice.toFixed(2)),
            currency: 'EUR',
            availability: shop.deliveryDays === 0 ? 'Sofort verfügbar' : `${shop.deliveryDays}-3 Tage`,
            deliveryTimeDays: shop.deliveryDays,
            rating: 4 + Math.random(),
            isRecommended: shop.name === 'Autodoc'
        };

        const insertedAt = randomDate(30);

        await db.run(
            `INSERT INTO shop_offers (order_id, oem, data, inserted_at) VALUES (?, ?, ?, ?)`,
            [orderId, part.oem, JSON.stringify(offerData), insertedAt]
        );
    }
}

async function generateMerchantSettings() {
    console.log('\n⚙️  Generating merchant settings...');

    const settings = {
        selectedShops: ['Autodoc', 'kfzteile24', 'pkwteile.de'],
        marginPercent: 25,
        allowDirectDelivery: true,
        dealerAddress: DEALER_ADDRESS,
        dealerName: DEALER_NAME,
        deliveryTimeBufferDays: 1,
        supportedLanguages: ['de', 'en', 'tr', 'ku', 'pl']
    };

    await db.run(
        `INSERT OR REPLACE INTO merchant_settings (merchant_id, settings) VALUES (?, ?)`,
        [DEALER_ID, JSON.stringify(settings)]
    );

    console.log(`✅ Merchant settings created for ${DEALER_NAME}`);
}

async function printStatistics() {
    console.log('\n📊 Database Statistics:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const orderCount = await db.get<any>('SELECT COUNT(*) as count FROM orders');
    console.log(`📦 Orders: ${orderCount.count}`);

    const messageCount = await db.get<any>('SELECT COUNT(*) as count FROM messages');
    console.log(`💬 Messages: ${messageCount.count}`);

    const offerCount = await db.get<any>('SELECT COUNT(*) as count FROM shop_offers');
    console.log(`🏪 Shop Offers: ${offerCount.count}`);

    const statusBreakdown = await db.all<any>('SELECT status, COUNT(*) as count FROM orders GROUP BY status');
    console.log('\n📈 Orders by Status:');
    statusBreakdown.forEach(row => {
        console.log(`   ${row.status}: ${row.count}`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function clearExistingData() {
    console.log('🗑️  Clearing existing demo data...');
    await db.run('DELETE FROM shop_offers');
    await db.run('DELETE FROM messages');
    await db.run('DELETE FROM orders');
    console.log('✅ Existing data cleared');
}

async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   WAWI Demo Data Generator                 ║');
    console.log('║   Autoteile Assistent System               ║');
    console.log('╚════════════════════════════════════════════╝');

    try {
        // Initialize database first
        const { initDb } = await import('../src/services/database');
        await initDb();
        console.log('✅ Database initialized\n');

        // Clear existing data
        await clearExistingData();

        // Generate merchant settings
        await generateMerchantSettings();

        // Generate orders with different statuses
        await generateOrders(50); // 50 realistic orders

        // Print statistics
        await printStatistics();

        console.log('✅ Demo data generation completed successfully!');
        console.log('\n🚀 You can now test the dashboard at: http://localhost:5173');
        console.log(`📊 Dealer: ${DEALER_NAME}`);
        console.log(`📍 Address: ${DEALER_ADDRESS}`);

    } catch (error) {
        console.error('❌ Error generating demo data:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

export { main as generateDemoData };
