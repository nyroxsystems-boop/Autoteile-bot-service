import { Router, Request, Response } from "express";
import { resolveOEM } from "../services/oemService";
import { getOrderById, updateOrderOEM } from "../services/supabaseService";

const router = Router();

/**
 * POST /api/oem/resolve
 * Erwartet:
 * {
 *   "orderId": "...",
 *   "vehicle": {...},
 *   "part": "Bremssattel"
 * }
 */
router.post("/resolve", async (req: Request, res: Response) => {
  const { orderId, vehicle, part } = req.body ?? {};

  if (!orderId || !part) {
    return res.status(400).json({ error: "orderId and part required" });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  const result = await resolveOEM(vehicle ?? {}, part);

  if (!result.success) {
    await updateOrderOEM(orderId, {
      oemStatus: "failed",
      oemError: result.message,
      oemData: { requiredFields: result.requiredFields }
    });

    return res.json({
      success: false,
      message: result.message,
      requiredFields: result.requiredFields
    });
  }

  // OEM erfolgreich
  await updateOrderOEM(orderId, {
    oemStatus: "resolved",
    oemData: { oem: result.oemNumber }
  });

  res.json({
    success: true,
    oem: result.oemNumber
  });
});

export default router;
