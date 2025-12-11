import 'dotenv/config';
import { getSupabaseClient } from '../src/services/supabaseService';

async function run() {
  const client = getSupabaseClient();
  const orderId = process.argv[2] || '41e8a1ab-9d43-4b14-a19f-ce74e967d4a7';
  try {
    const payload = [{ order_id: orderId, oem_number: 'OEM-RAW', shop_name: 'RAW-SHOP', price: 11.11 }];
    const { data, error } = await client.from('shop_offers').insert(payload).select('*');
    if (error) {
      console.error('[insertRawOffer] error:', error.message);
      process.exit(1);
    }
    console.log('[insertRawOffer] inserted:', data);
  } catch (err: any) {
    console.error('[insertRawOffer] unexpected error:', err?.message ?? err);
    process.exit(1);
  }
}

run();
