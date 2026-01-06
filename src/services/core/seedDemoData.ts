/**
 * Seed Demo Data Script
 * Creates comprehensive demo data for all dashboard sections
 */

import * as db from './database';
import { randomUUID } from 'crypto';

// Admin-Account Merchant ID - linked to admin@autoteile-assistent.com
const MERCHANT_ID = 'admin-merchant-001';
const ADMIN_EMAIL = 'admin@autoteile-assistent.com';

// ============================================================================
// Demo Orders - Various car part requests with different statuses
// ============================================================================
const DEMO_ORDERS = [
    {
        customerContact: '+49171234567',
        customerName: 'Max Mustermann',
        requestedPartName: 'Bremsbeläge vorne',
        status: 'new',
        vehicle: { make: 'VW', model: 'Golf 7', year: 2018, engine: '2.0 TDI' },
        total: 89.90
    },
    {
        customerContact: '+49172345678',
        customerName: 'Anna Schmidt',
        requestedPartName: 'Ölfilter',
        status: 'confirmed',
        vehicle: { make: 'BMW', model: '320d F30', year: 2020, engine: '2.0d' },
        total: 34.50
    },
    {
        customerContact: '+49173456789',
        customerName: 'Peter Weber',
        requestedPartName: 'Luftfilter',
        status: 'offer_sent',
        vehicle: { make: 'Audi', model: 'A4 B9', year: 2019, engine: '2.0 TFSI' },
        total: 42.00
    },
    {
        customerContact: '+49174567890',
        customerName: 'Lisa Müller',
        requestedPartName: 'Zündkerzen Set',
        status: 'shipped',
        vehicle: { make: 'Mercedes', model: 'C220d W205', year: 2021, engine: '2.0d' },
        total: 68.00
    },
    {
        customerContact: '+49175678901',
        customerName: 'Thomas Klein',
        requestedPartName: 'Keilrippenriemen',
        status: 'new',
        vehicle: { make: 'VW', model: 'Passat B8', year: 2019, engine: '2.0 TDI' },
        total: 45.90
    },
    {
        customerContact: '+49176789012',
        customerName: 'Sarah Braun',
        requestedPartName: 'Bremsscheiben hinten',
        status: 'confirmed',
        vehicle: { make: 'Skoda', model: 'Octavia 3', year: 2020, engine: '1.5 TSI' },
        total: 156.00
    },
    {
        customerContact: '+49177890123',
        customerName: 'Michael Hoffmann',
        requestedPartName: 'Stoßdämpfer vorne',
        status: 'new',
        vehicle: { make: 'Seat', model: 'Leon 5F', year: 2018, engine: '1.4 TSI' },
        total: 189.00
    },
    {
        customerContact: '+49178901234',
        customerName: 'Julia Fischer',
        requestedPartName: 'Wasserpumpe',
        status: 'offer_sent',
        vehicle: { make: 'Opel', model: 'Astra K', year: 2019, engine: '1.6 CDTi' },
        total: 124.50
    },
    {
        customerContact: '+49179012345',
        customerName: 'Stefan Wagner',
        requestedPartName: 'Turbolader',
        status: 'done',
        vehicle: { make: 'VW', model: 'Tiguan 2', year: 2020, engine: '2.0 TDI' },
        total: 890.00
    },
    {
        customerContact: '+49170123456',
        customerName: 'Claudia Becker',
        requestedPartName: 'Zahnriemensatz',
        status: 'done',
        vehicle: { make: 'Audi', model: 'A3 8V', year: 2017, engine: '1.6 TDI' },
        total: 345.00
    }
];

// ============================================================================
// Demo Products - Auto parts for WAWI product search testing
// ============================================================================
const DEMO_PRODUCTS = [
    // Bremsen
    { name: 'Bremsbeläge vorne VW/Audi', oem_number: 'JZW698151A', manufacturer: 'Brembo', category: 'Bremsen', stock: 24 },
    { name: 'Bremsbeläge hinten VW/Audi', oem_number: 'JZW698451', manufacturer: 'Brembo', category: 'Bremsen', stock: 18 },
    { name: 'Bremsscheiben vorne BMW', oem_number: '34116864906', manufacturer: 'Zimmermann', category: 'Bremsen', stock: 8 },
    { name: 'Bremsscheiben hinten Mercedes', oem_number: 'A2054230012', manufacturer: 'ATE', category: 'Bremsen', stock: 12 },
    { name: 'Bremssattel vorne links', oem_number: '8K0615123F', manufacturer: 'TRW', category: 'Bremsen', stock: 4 },

    // Filter
    { name: 'Ölfilter VW/Audi/Skoda', oem_number: '03L115562', manufacturer: 'Mann-Filter', category: 'Filter', stock: 45 },
    { name: 'Luftfilter BMW 3er/5er', oem_number: '13718511668', manufacturer: 'Mahle', category: 'Filter', stock: 32 },
    { name: 'Kraftstofffilter Diesel', oem_number: '7N0127177B', manufacturer: 'Bosch', category: 'Filter', stock: 28 },
    { name: 'Innenraumfilter Aktivkohle', oem_number: '1K1819653B', manufacturer: 'Mann-Filter', category: 'Filter', stock: 55 },
    { name: 'Ölfilter Mercedes CDI', oem_number: 'A6511800109', manufacturer: 'Hengst', category: 'Filter', stock: 22 },

    // Zündung
    { name: 'Zündkerzen 4er Set NGK', oem_number: 'PZFR5D-11', manufacturer: 'NGK', category: 'Zündung', stock: 36 },
    { name: 'Zündspule VW/Audi', oem_number: '07K905715G', manufacturer: 'Bosch', category: 'Zündung', stock: 14 },
    { name: 'Glühkerzen Diesel 4er Set', oem_number: '059963319E', manufacturer: 'Bosch', category: 'Zündung', stock: 20 },

    // Fahrwerk
    { name: 'Stoßdämpfer vorne Mercedes', oem_number: 'A2043200630', manufacturer: 'Sachs', category: 'Fahrwerk', stock: 6 },
    { name: 'Stoßdämpfer hinten BMW', oem_number: '33526789381', manufacturer: 'Bilstein', category: 'Fahrwerk', stock: 8 },
    { name: 'Querlenker vorne VW/Audi', oem_number: '8K0407151D', manufacturer: 'Lemförder', category: 'Fahrwerk', stock: 10 },
    { name: 'Koppelstange vorne', oem_number: '1K0411315R', manufacturer: 'Meyle', category: 'Fahrwerk', stock: 24 },

    // Motor/Antrieb
    { name: 'Keilrippenriemen 6PK', oem_number: '03L903137K', manufacturer: 'Continental', category: 'Motor', stock: 18 },
    { name: 'Wasserpumpe VW/Audi', oem_number: '06H121026DD', manufacturer: 'INA', category: 'Kühlsystem', stock: 7 },
    { name: 'Thermostat mit Gehäuse', oem_number: '03L121111AD', manufacturer: 'Wahler', category: 'Kühlsystem', stock: 12 },
    { name: 'Zahnriemensatz mit Wasserpumpe', oem_number: '03L198119F', manufacturer: 'Gates', category: 'Motor', stock: 5 },
    { name: 'Turbolader Garrett', oem_number: '03L253016TX', manufacturer: 'Garrett', category: 'Motor', stock: 2 }
];

// ============================================================================
// Demo Customers (Companies)
// ============================================================================
const DEMO_CUSTOMERS = [
    { name: 'Autohaus Müller GmbH', email: 'kontakt@autohaus-mueller.de', phone: '+49891234567', is_customer: true },
    { name: 'KFZ-Werkstatt Schmidt', email: 'info@kfz-schmidt.de', phone: '+49301234567', is_customer: true },
    { name: 'Fahrzeugservice Weber', email: 'service@weber-kfz.de', phone: '+49211234567', is_customer: true },
    { name: 'Premium Cars Berlin', email: 'parts@premium-cars.de', phone: '+49301111222', is_customer: true },
    { name: 'Auto-Expert Frankfurt', email: 'bestellung@auto-expert.de', phone: '+49691234567', is_customer: true }
];

// Demo Suppliers
const DEMO_SUPPLIERS = [
    { name: 'PKW-Teile24 GmbH', email: 'einkauf@pkw-teile24.de', phone: '+49401234567', is_supplier: true, website: 'https://pkw-teile24.de' },
    { name: 'Autodoc SE', email: 'partner@autodoc.de', phone: '+49301234568', is_supplier: true, website: 'https://autodoc.de' },
    { name: 'KFZTeile24 GmbH', email: 'haendler@kfzteile24.de', phone: '+49301234569', is_supplier: true, website: 'https://kfzteile24.de' },
    { name: 'Oscaro Deutschland', email: 'b2b@oscaro.de', phone: '+4989111222', is_supplier: true, website: 'https://oscaro.de' }
];

// ============================================================================
// Shop Offers for orders
// ============================================================================
const SHOPS = ['PKW-Teile24', 'Autodoc', 'Kfzteile24', 'Oscaro'];
const BRANDS = ['Bosch', 'Brembo', 'Mann-Filter', 'TRW', 'Sachs', 'Lemförder'];

function generateOffers(orderId: string, partName: string) {
    const numOffers = 2 + Math.floor(Math.random() * 3); // 2-4 offers
    const offers = [];

    for (let i = 0; i < numOffers; i++) {
        const basePrice = 20 + Math.random() * 180;
        offers.push({
            id: randomUUID(),
            order_id: orderId,
            shop_name: SHOPS[i % SHOPS.length],
            brand: BRANDS[Math.floor(Math.random() * BRANDS.length)],
            product_name: partName,
            base_price: Math.round(basePrice * 100) / 100,
            price: Math.round(basePrice * 1.25 * 100) / 100,
            currency: 'EUR',
            delivery_time_days: 1 + Math.floor(Math.random() * 5),
            margin_percent: 25,
            tier: i === 0 ? 'recommended' : 'standard',
            status: 'active',
            oem_number: 'OEM-' + Math.random().toString(36).substring(7).toUpperCase(),
            is_recommended: i === 0
        });
    }
    return offers;
}

// Demo Messages for orders
function generateMessages(orderId: string, customerName: string) {
    const now = new Date();
    return [
        {
            direction: 'IN',
            content: `Hallo, ich suche das Teil für mein Auto. Können Sie mir helfen?`,
            created_at: new Date(now.getTime() - 3600000 * 3).toISOString()
        },
        {
            direction: 'OUT',
            content: `Guten Tag ${customerName}, natürlich! Ich habe mehrere Angebote für Sie gefunden.`,
            created_at: new Date(now.getTime() - 3600000 * 2).toISOString()
        },
        {
            direction: 'IN',
            content: `Super, das günstigste Angebot nehme ich!`,
            created_at: new Date(now.getTime() - 3600000).toISOString()
        }
    ];
}

// ============================================================================
// Main Seed Function
// ============================================================================
export async function seedDemoData(): Promise<void> {
    console.log('[SEED] Starting comprehensive demo data seeding...');

    try {
        // Check if already seeded (look for existing demo orders)
        const existingOrders = await db.all<any>(
            `SELECT id FROM orders WHERE merchant_id = $1 LIMIT 1`,
            [MERCHANT_ID]
        );

        if (existingOrders.length > 0) {
            console.log('[SEED] Demo data already exists, skipping...');
            return;
        }

        // 0. Update admin user merchant_id if exists
        await db.run(
            `UPDATE users SET merchant_id = $1 WHERE email = $2`,
            [MERCHANT_ID, ADMIN_EMAIL]
        );
        console.log(`[SEED] Updated admin user merchant_id to ${MERCHANT_ID}`);

        // 1. Insert Demo Customers (Companies)
        console.log('[SEED] Creating demo customers...');
        for (const customer of DEMO_CUSTOMERS) {
            await db.run(
                `INSERT INTO companies (id, name, email, phone, is_customer, is_supplier, active, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [randomUUID(), customer.name, customer.email, customer.phone, true, false, true, new Date().toISOString()]
            );
        }
        console.log(`[SEED] Created ${DEMO_CUSTOMERS.length} customers`);

        // 2. Insert Demo Suppliers
        console.log('[SEED] Creating demo suppliers...');
        for (const supplier of DEMO_SUPPLIERS) {
            await db.run(
                `INSERT INTO companies (id, name, email, phone, website, is_customer, is_supplier, active, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [randomUUID(), supplier.name, supplier.email, supplier.phone, supplier.website, false, true, true, new Date().toISOString()]
            );
        }
        console.log(`[SEED] Created ${DEMO_SUPPLIERS.length} suppliers`);

        // 3. Insert Demo Orders with Vehicles, Messages, and Offers
        console.log('[SEED] Creating demo orders...');
        for (let i = 0; i < DEMO_ORDERS.length; i++) {
            const order = DEMO_ORDERS[i];
            const orderId = `order-${randomUUID().substring(0, 8)}`;
            const now = new Date();
            // Vary creation dates for realistic dashboard display
            const createdAt = new Date(now.getTime() - (i * 86400000 * 2)).toISOString(); // Each 2 days apart

            // Insert order
            await db.run(
                `INSERT INTO orders (id, customer_contact, customer_name, customer_phone, requested_part_name, status, merchant_id, vehicle_data, total, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [orderId, order.customerContact, order.customerName, order.customerContact, order.requestedPartName, order.status, MERCHANT_ID, JSON.stringify(order.vehicle), order.total, createdAt, createdAt]
            );

            // Insert vehicle
            await db.run(
                `INSERT INTO vehicles (id, order_id, make, model, year, engine_code, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [randomUUID(), orderId, order.vehicle.make, order.vehicle.model, order.vehicle.year, order.vehicle.engine, createdAt]
            );

            // Insert messages for this order
            const messages = generateMessages(orderId, order.customerName);
            for (const msg of messages) {
                await db.run(
                    `INSERT INTO messages (id, order_id, direction, content, phone, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [randomUUID(), orderId, msg.direction, msg.content, order.customerContact, msg.created_at]
                );
            }

            // Generate and insert shop offers
            const offers = generateOffers(orderId, order.requestedPartName);
            for (const offer of offers) {
                await db.run(
                    `INSERT INTO shop_offers (id, order_id, shop_name, brand, product_name, base_price, price, currency, delivery_time_days, margin_percent, tier, status, oem_number, is_recommended, inserted_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                    [offer.id, offer.order_id, offer.shop_name, offer.brand, offer.product_name, offer.base_price, offer.price, offer.currency, offer.delivery_time_days, offer.margin_percent, offer.tier, offer.status, offer.oem_number, offer.is_recommended, createdAt]
                );
            }

            console.log(`[SEED] Created order: ${orderId} - ${order.requestedPartName} (${order.status})`);
        }

        // 4. Insert Demo Products
        console.log('[SEED] Creating demo products...');
        for (const product of DEMO_PRODUCTS) {
            await db.run(
                `INSERT INTO parts (id, name, oem_number, manufacturer, category, stock, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [randomUUID(), product.name, product.oem_number, product.manufacturer, product.category, product.stock, new Date().toISOString()]
            );
        }
        console.log(`[SEED] Created ${DEMO_PRODUCTS.length} products`);

        // 5. Insert Merchant Settings for admin
        console.log('[SEED] Creating merchant settings...');
        const merchantSettings = {
            selectedShops: ['PKW-Teile24', 'Autodoc', 'Kfzteile24', 'Oscaro'],
            marginPercent: 25,
            allowDirectDelivery: true,
            dealerName: 'Autoteile Admin',
            dealerAddress: 'Musterstraße 1, 10115 Berlin',
            supportedLanguages: ['de', 'en'],
            deliveryTimeBufferDays: 1
        };
        await db.run(
            `INSERT INTO merchant_settings (merchant_id, settings, created_at, updated_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (merchant_id) DO UPDATE SET settings = $2, updated_at = $4`,
            [MERCHANT_ID, JSON.stringify(merchantSettings), new Date().toISOString(), new Date().toISOString()]
        );
        console.log('[SEED] Created merchant settings');

        console.log('[SEED] ✅ Comprehensive demo data seeding complete!');
        console.log(`[SEED] Summary:`);
        console.log(`  - ${DEMO_ORDERS.length} orders with vehicles, messages & offers`);
        console.log(`  - ${DEMO_PRODUCTS.length} products`);
        console.log(`  - ${DEMO_CUSTOMERS.length} customers`);
        console.log(`  - ${DEMO_SUPPLIERS.length} suppliers`);
        console.log(`  - Merchant settings configured`);

    } catch (error) {
        console.error('[SEED] Error seeding demo data:', error);
        throw error;
    }
}

export default seedDemoData;
