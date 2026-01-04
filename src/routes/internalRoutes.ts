import { Router, Request, Response } from "express";
import { refreshOffersForOrder } from '../services/intelligence/productResolutionService';
import { getOrderById } from '../services/adapters/supabaseService';
import { runSeeding } from '../services/core/seedingService';

export function createInternalRouter(): Router {
  const router = Router();

  router.post("/orders/:id/refresh-offers", async (req: Request, res: Response) => {
    const orderId = req.params.id;
    console.log("[InternalAPI] POST /internal/orders/:id/refresh-offers", { orderId });

    try {
      const { offers } = await refreshOffersForOrder(orderId);
      console.log("[InternalAPI] Offers refreshed for order", orderId, { count: offers.length });
      return res.status(200).json({ success: true, offers });
    } catch (err: any) {
      console.error("[InternalAPI] Failed to refresh offers for order", orderId, err);
      return res.status(500).json({ success: false, error: err?.message || "Unknown error" });
    }
  });

  // Debug Route
  router.get("/ping", (req, res) => {
    res.json({ status: "alive", time: new Date().toISOString() });
  });

  // Seeding Route (Renamed to force update)
  router.post("/seed-db", async (req: Request, res: Response) => {
    console.log("[InternalAPI] POST /internal/seed-db requested");
    try {
      const { runSeeding } = await import("../services/core/seedingService");
      const result = await runSeeding(50);
      return res.status(200).json({ success: true, result });
    } catch (err: any) {
      console.error("[InternalAPI] Seeding failed", err);
      return res.status(500).json({ success: false, error: err?.message });
    }
  });

  return router;
}

export default createInternalRouter;
