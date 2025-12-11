import "dotenv/config";
import fs from "fs";
import path from "path";
import { extractVehicleDataFromImage } from "../src/services/botLogicService";
import {
  findOrCreateOrder,
  updateOrder,
  updateOrderData,
  upsertVehicleForOrderFromPartial,
  updateOrderOEM,
  listShopOffersByOrderId
} from "../src/services/supabaseService";
import { resolveOEMForOrder } from "../src/services/oemService";
import { scrapeOffersForOrder } from "../src/services/scrapingService";

async function run() {
  const imagePath =
    process.env.DEMO_IMAGE_PATH || path.join(__dirname, "..", "fahrzeugschein.jpeg");
  const partText = process.env.DEMO_PART_TEXT || "Bremsscheiben vorne";
  const from = process.env.DEMO_CUSTOMER || "whatsapp:+491739999999";

  console.log("[full-flow] reading image from", imagePath);
  const imageBuffer = fs.readFileSync(imagePath);

  console.log("[full-flow] running OCR via OpenAI Vision...");
  const ocr = await extractVehicleDataFromImage(imageBuffer);
  console.log("[full-flow] OCR result:", ocr);

  // Create/find order
  const order = await findOrCreateOrder(from, null);
  console.log("[full-flow] using order", order.id);

  // Set language/status and attach vehicle + part info
  await updateOrder(order.id, { language: "de", status: "collect_part" });
  await upsertVehicleForOrderFromPartial(order.id, {
    make: ocr.make,
    model: ocr.model,
    year: ocr.year,
    engineCode: ocr.vin ? undefined : null,
    engineKw: ocr.engineKw,
    fuelType: ocr.fuelType,
    emissionClass: ocr.emissionClass,
    vin: ocr.vin,
    hsn: ocr.hsn,
    tsn: ocr.tsn
  });
  await updateOrderData(order.id, {
    requestedPart: partText,
    partText,
    ocrRawText: ocr.rawText,
    conversationStatus: "oem_lookup"
  });

  // Resolve OEM (TecDoc + PartSouq -> fallback resolver)
  console.log("[full-flow] resolving OEM...");
  const oemResult = await resolveOEMForOrder(
    order.id,
    {
      make: ocr.make,
      model: ocr.model,
      year: ocr.year,
      engine: null,
      engineKw: ocr.engineKw,
      vin: ocr.vin,
      hsn: ocr.hsn,
      tsn: ocr.tsn
    },
    partText
  );
  console.log("[full-flow] OEM result:", {
    primaryOEM: oemResult.primaryOEM,
    confidence: oemResult.overallConfidence,
    notes: oemResult.notes,
    tecdocStatus: oemResult.tecdocPartsouqResult?.status
  });

  try {
    await updateOrderOEM(order.id, {
      oemStatus: oemResult.primaryOEM ? "resolved" : "failed",
      oemError: oemResult.primaryOEM ? null : oemResult.notes ?? "not_found",
      oemData: oemResult,
      oemNumber: oemResult.primaryOEM ?? null
    });
  } catch (err: any) {
    console.warn("[full-flow] updateOrderOEM skipped due to schema mismatch:", err?.message ?? err);
  }

  // Scrape offers (mock adapters or Apify, depending on env)
  if (oemResult.primaryOEM) {
    console.log("[full-flow] scraping offers with OEM", oemResult.primaryOEM);
    await scrapeOffersForOrder(order.id, oemResult.primaryOEM);
  } else {
    console.warn("[full-flow] no OEM found, skipping scrape");
  }

  // Show dashboard-facing data
  const offers = await listShopOffersByOrderId(order.id);
  console.log(
    "[full-flow] offers stored:",
    offers.map((o) => ({
      shop: o.shopName,
      price: o.price,
      url: o.productUrl,
      oem: o.oemNumber
    }))
  );
  console.log("[full-flow] done");
}

run().catch((err) => {
  console.error("[full-flow] failed", err);
  process.exit(1);
});
