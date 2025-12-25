import 'dotenv/config';
import { handleIncomingBotMessage } from '../src/services/botLogicService';
import { listOrders, listMessagesByOrderId, listShopOffersByOrderId, insertShopOffers } from '../src/services/supabaseService';

async function run() {
  console.log('[demoFlow] starting demo run');
  const payload = {
    from: 'whatsapp:+491701234567',
    text: 'Bremsscheiben vorne',
    mediaUrls: [],
    orderId: null
  } as any;

  try {
    const res = await handleIncomingBotMessage(payload);
    console.log('[demoFlow] bot replied:', res);

    const orders = await listOrders(10);
    console.log('[demoFlow] recent orders (top 10):', orders.map((o) => ({ id: o.id, from: o.customerContact, status: o.status, oem: o.oemNumber })));

    const orderId = res.orderId;
    const messages = await listMessagesByOrderId(orderId);
    console.log('[demoFlow] messages for order', orderId, messages.map((m) => ({ id: m.id, dir: m.direction, content: m.content })));

    let offers = [] as any[];
    try {
      offers = await listShopOffersByOrderId(orderId);
      console.log('[demoFlow] shop offers for order', orderId, offers.map((s) => ({ shop: s.shopName, price: s.price, url: s.productUrl })));
    } catch (err: any) {
      console.warn('[demoFlow] listing shop offers failed, attempting to insert demo offers to simulate scrape:', err?.message ?? err);
      // Insert demo offers directly to simulate a completed scrape
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
          isRecommended: true
        }
      ];
      try {
        const inserted = await insertShopOffers(orderId, 'OEM-DEMO-1', demoOffers as any);
        console.log('[demoFlow] inserted demo offers:', inserted.map((s) => ({ shop: s.shopName, price: s.price })));
        offers = await listShopOffersByOrderId(orderId);
        console.log('[demoFlow] shop offers after insert', orderId, offers.map((s) => ({ shop: s.shopName, price: s.price, url: s.productUrl })));
      } catch (insertErr: any) {
        console.error('[demoFlow] failed to insert demo offers', insertErr?.message ?? insertErr);
      }
    }

    console.log('[demoFlow] done');
  } catch (err: any) {
    console.error('[demoFlow] failed:', err?.message ?? err);
    process.exit(1);
  }
}

run();
