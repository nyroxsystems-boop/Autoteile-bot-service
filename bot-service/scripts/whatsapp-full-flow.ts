import "dotenv/config";
import fs from "fs";
import path from "path";
import { handleIncomingBotMessage } from "../src/services/botLogicService";
import { listMessagesByOrderId, listShopOffersByOrderId, getOrderById } from "../src/services/supabaseService";

async function run() {
  const imagePath = process.env.DEMO_IMAGE_PATH || path.join(__dirname, "..", "fahrzeugschein.jpeg");
  const partText = process.env.DEMO_PART_TEXT || "Bremsscheiben vorne";
  const fromBase = process.env.DEMO_CUSTOMER || "whatsapp:+491739999999";
  const from = `${fromBase}-${Date.now()}`; // unique per run to avoid reusing open orders

  const buf = fs.readFileSync(imagePath);
  const dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;

  console.log("[whatsapp-flow] sending WhatsApp-style payload with media + text");
  const payload = {
    from,
    text: partText,
    mediaUrls: [dataUrl],
    orderId: null
  } as any;

  const res = await handleIncomingBotMessage(payload);
  console.log("[whatsapp-flow] bot response:", res);

  const orderId = res.orderId;
  const order = await getOrderById(orderId);
  console.log("[whatsapp-flow] order snapshot:", {
    id: orderId,
    status: (order as any)?.status,
    oem: (order as any)?.oemNumber,
    oemStatus: (order as any)?.oem_status ?? (order as any)?.oemStatus,
    oemDataKeys: (order as any)?.oem_data ? Object.keys((order as any).oem_data) : []
  });

  const msgs = await listMessagesByOrderId(orderId);
  console.log(
    "[whatsapp-flow] messages:",
    msgs.map((m) => ({ dir: m.direction, text: m.content, created: m.createdAt }))
  );

  const offers = await listShopOffersByOrderId(orderId);
  console.log(
    "[whatsapp-flow] offers:",
    offers.map((o) => ({ shop: o.shopName, price: o.price, url: o.productUrl, oem: o.oemNumber }))
  );

  console.log("[whatsapp-flow] done");
}

run().catch((err) => {
  console.error("[whatsapp-flow] failed", err);
  process.exit(1);
});
