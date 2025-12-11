import 'dotenv/config';
import { getSupabaseClient } from '../src/services/supabaseService';

async function run() {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.from('shop_offers').select('*').limit(1);
    if (error) {
      console.error('[describeShopOffers] error:', error.message);
      process.exit(1);
    }
    console.log('[describeShopOffers] sample row:', data);
  } catch (err: any) {
    console.error('[describeShopOffers] unexpected error:', err?.message ?? err);
    process.exit(1);
  }
}

run();
