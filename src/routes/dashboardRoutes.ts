import { Router, type Application, type Request, type Response } from "express";
import * as wawi from "../services/inventreeAdapter";
import {
  mapOfferRowToDashboardShopOffer,
  mapOrderRowToDashboardOrder
} from "../mappers/dashboardMappers";
import { logger } from "../utils/logger";

import { authMiddleware } from "../middleware/authMiddleware";

export function createDashboardRouter(): Router {
  const router = Router();

  // Apply auth to all dashboard routes
  router.use(authMiddleware);

  router.get("/orders", async (_req: Request, res: Response) => {
    try {
      const orders = await wawi.listOrders();
      // For each order, find vehicle if it exists
      const mapped = await Promise.all(orders.map(async (o) => {
        const vehicle = await wawi.getVehicleForOrder(o.id);
        return mapOrderRowToDashboardOrder(o, vehicle);
      }));
      return res.status(200).json(mapped);
    } catch (err: any) {
      logger.error("Dashboard error fetching orders", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  router.get("/orders/:id", async (req: Request, res: Response) => {
    try {
      const order = await wawi.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      const vehicle = await wawi.getVehicleForOrder(order.id);
      const mapped = mapOrderRowToDashboardOrder(order, vehicle);
      return res.status(200).json(mapped);
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  router.get("/stats", async (req: Request, res: Response) => {
    try {
      const orders = await wawi.listOrders();
      const stats = {
        ordersCount: orders.length,
        incomingMessages: orders.reduce((sum, o) => sum + (o.message_count || 5), 0),
        abortedOrders: orders.filter(o => o.status === "aborted").length,
        averageMargin: 25, // Mocked for now
      };
      return res.status(200).json(stats);
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  router.get('/merchant/settings/:merchantId', async (req: Request, res: Response) => {
    const settings = await wawi.getMerchantSettings(req.params.merchantId);
    return res.status(200).json(settings);
  });

  return router;
}

export function registerDashboardRoutes(app: Application) {
  app.use("/api/dashboard", createDashboardRouter());
}

export default registerDashboardRoutes;
