import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { handleIncomingBotMessage } from "../src/services/botLogicService";
import { listShopOffersByOrderId } from "../src/services/supabaseService";

dotenv.config();

async function main() {
  const imagePath = process.argv[2] || process.env.TEST_IMAGE_PATH;
  if (!imagePath) {
    console.error("Usage: npx ts-node scripts/run-realistic-whatsapp.ts <path-to-fahrzeugschein-image> [teilbeschreibung]");
    process.exit(1);
  }

  const resolved = path.resolve(imagePath);
  const part = process.argv[3] || process.env.TEST_PART || "Zündkerzen";
  const from = process.env.TEST_FROM || "whatsapp:+49123456789";

  const buf = await fs.readFile(resolved);
  const dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;

  const payload = {
    from,
    text: `Ich brauche ${part}`,
    mediaUrls: [dataUrl]
  } as any;

  console.log("Running realistic WhatsApp flow with:", { from, part, imagePath: resolved });
  const res = await handleIncomingBotMessage(payload);
  console.log("Bot response:", res);

  if (res?.orderId) {
    const offers = await listShopOffersByOrderId(res.orderId);
    console.log(`Found ${offers?.length || 0} shop offers for order ${res.orderId}:`, offers);
  }
}

main().catch((err) => {
  console.error("Flow failed:", err?.message ?? err);
  process.exit(1);
});
