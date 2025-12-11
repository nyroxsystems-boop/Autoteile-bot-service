import 'dotenv/config';
import { getSupabaseClient } from '../src/services/supabaseService';

async function run() {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'shop_offers')
      .order('ordinal_position', { ascending: true });

    if (error) {
      console.error('[listShopColumns] error:', error.message);
      process.exit(1);
    }
    console.log('[listShopColumns] columns:', data?.map((r:any) => r.column_name));
  } catch (err: any) {
    console.error('[listShopColumns] unexpected error:', err?.message ?? err);
    process.exit(1);
  }
}

run();
