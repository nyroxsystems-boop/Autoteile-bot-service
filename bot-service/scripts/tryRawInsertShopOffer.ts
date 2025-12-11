#!/usr/bin/env ts-node
import { getSupabaseClient } from "../src/services/supabaseService";

const ORDER_ID = "41e8a1ab-9d43-4b14-a19f-ce74e967d4a7";
const OEM = "TEST-OEM-RAW";

async function run() {
  const client = getSupabaseClient();

  // initial payload with all expected fields
  let payload: any = {
    order_id: ORDER_ID,
    oem_number: OEM,
    shop_name: "Demo Shop",
    brand: "DemoBrand",
    price: 123.45,
    currency: "EUR",
    availability: "in_stock",
    delivery_time_days: 3,
    product_url: "https://example.com/demo-product",
    rating: 4.5,
    is_recommended: false
  };

  let attempts = 0;
  let lastErr: any = null;

  while (attempts < 6) {
    attempts += 1;
    try {
      console.log(`[tryRawInsert] attempt ${attempts} inserting payload keys: ${Object.keys(payload).join(",")}`);
      const { data, error } = await client.from("shop_offers").insert([payload]).select("*");
      if (error) throw error;
      console.log("[tryRawInsert] insert succeeded, returned:", data);

      // list rows for order
      const { data: rows, error: listErr } = await client
        .from("shop_offers")
        .select("*")
        .eq("order_id", ORDER_ID)
        .order("created_at", { ascending: false })
        .limit(10);
      if (listErr) {
        console.error("[tryRawInsert] listing failed:", listErr.message);
      } else {
        console.log("[tryRawInsert] shop_offers rows for order:", rows);
      }
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
      const msg = (err?.message || "") as string;
      console.error(`[tryRawInsert] insert failed (attempt ${attempts}):`, msg);

      // Try to parse missing column from message like:
      // "Could not find the 'shop_name' column of 'shop_offers' in the schema cache"
      const m = msg.match(/'([^']+)' column of 'shop_offers'|Could not find the '([^']+)' column|column "?([^\s"]+)"? does not exist/i);
      let col: string | null = null;
      if (m) {
        col = m[1] || m[2] || m[3] || null;
      }

      if (col) {
        console.log(`[tryRawInsert] detected missing column '${col}', removing from payload and retrying`);
        // remove both snake_case and camelCase variants
        delete payload[col];
        const camel = col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        delete payload[camel];
        // continue loop to retry
        continue;
      }

      // If we can't detect a column, break and report the error
      break;
    }
  }

  if (lastErr) {
    console.error("[tryRawInsert] giving up after attempts; last error:", lastErr.message || lastErr);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("[tryRawInsert] uncaught:", e?.message || e);
  process.exit(1);
});
