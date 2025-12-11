import 'dotenv/config';
import { insertShopOffers, listShopOffersByOrderId } from '../src/services/supabaseService';

async function run() {
  const orderId = process.argv[2] || '41e8a1ab-9d43-4b14-a19f-ce74e967d4a7';
  console.log('[insertDemoOffers] inserting demo offers for order', orderId);

  const demoOffers = [
    {
      shopName: 'Autodoc',
      brand: 'ATE',
      price: 89.99,
      currency: 'EUR',
      availability: 'In stock',
      deliveryTimeDays: 2,
      productUrl: `https://autodoc.example.com/parts/OEM-DEMO-1`,
      rating: 4.7,
      isRecommended: true
    },
    {
      shopName: 'KFZTeile24',
      brand: 'Brembo',
      price: 94.5,
      currency: 'EUR',
      availability: 'In stock',
      deliveryTimeDays: 1,
      productUrl: `https://kfzteile24.example.com/search?q=OEM-DEMO-1`,
      rating: 4.6,
      isRecommended: false
    }
  ];

  try {
    const inserted = await insertShopOffers(orderId, 'OEM-DEMO-1', demoOffers as any);
    console.log('[insertDemoOffers] inserted:', inserted.map((s) => ({ shop: s.shopName, price: s.price })));

    const listed = await listShopOffersByOrderId(orderId);
    console.log('[insertDemoOffers] listed after insert:', listed.map((s) => ({ shop: s.shopName, price: s.price, url: s.productUrl })));
  } catch (err: any) {
    console.error('[insertDemoOffers] failed:', err?.message ?? err);
    process.exit(1);
  }
}

run();
