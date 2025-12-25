import { Router, type Request, type Response } from "express";
import { refreshOffersForOrder } from "../services/productResolutionService";

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

  return router;
}

export default createInternalRouter;
