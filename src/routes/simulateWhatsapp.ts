import { Router, Request, Response } from "express";
import { insertOrder, insertMessage } from "../services/supabaseService";

const router = Router();

/**
 * POST /simulate/whatsapp
 *
 * Simuliert eine eingehende WhatsApp-Nachricht und legt:
 * 1) eine Order an
 * 2) eine Message in der messages-Tabelle an
 *
 * Erwarteter Request-Body (JSON):
 * {
 *   "from": "whatsapp:+49123456789",   // Pflicht
 *   "text": "Bremssattel vorne links", // Pflicht
 *   "customerName": "Max Mustermann"   // optional
 * }
 */
router.post("/", async (req: Request, res: Response) => {
  const { from, text, customerName } = req.body ?? {};

  if (!from || typeof from !== "string") {
    return res.status(400).json({
      error: '"from" is required and must be a string, e.g. "whatsapp:+49123456789"'
    });
  }

  if (!text || typeof text !== "string") {
    return res.status(400).json({
      error: '"text" is required and must be a string, e.g. "Bremssattel vorne links"'
    });
  }

  try {
    // 1) Order anlegen
    const order = await insertOrder({
      customerName: customerName ?? null,
      customerContact: from,
      requestedPartName: text,
      vehicleId: null
    });

    // 2) Message speichern (eingehende WhatsApp-Nachricht)
    const message = await insertMessage(from, text, "IN" as any);

    return res.status(201).json({
      message: "Simulated WhatsApp message processed. Order and message created.",
      order,
      chatMessage: message
    });
  } catch (error: any) {
    console.error("Error in POST /simulate/whatsapp:", error);
    return res.status(500).json({
      error: "Failed to process simulated WhatsApp message",
      details: error?.message ?? String(error)
    });
  }
});

export default router;
