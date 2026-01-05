import { Router, Request, Response, Application } from "express";
import { randomUUID } from "crypto";
import * as wawi from "@adapters/inventreeAdapter";
import {
  mapOfferRowToDashboardShopOffer,
  mapOrderRowToDashboardOrder,
  mapMessageRowToDashboardMessage
} from "../mappers/dashboardMappers";
import { logger } from "@utils/logger";
import { authMiddleware } from "../middleware/authMiddleware";
import { resolveOEM } from '../services/intelligence/oemService';
import { getOrderById, updateOrderOEM } from '../services/adapters/supabaseService';
import * as analytics from '@core/analyticsService';
import * as inventree from '@adapters/inventreeAdapter';

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

  router.post('/orders/:id/offers', authMiddleware, async (req, res) => {
    const orderId = req.params.id;
    const { price, supplierName, deliveryTime } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    try {
      // Logic to save offer...
      // For now, we return a mock offer
      const mockOffer = {
        id: randomUUID(),
        orderId: orderId,
        shopName: supplierName || 'Best Parts GmbH',
        basePrice: parseFloat(price) || 120.00,
        currency: 'EUR',
        deliveryTimeDays: deliveryTime || 2,
        matchQuality: 98,
        brand: 'Bosch',
        productName: 'Mock Product',
        oemNumber: 'MOCK-123',
        status: 'draft',
        marginPercent: 25,
        tier: 'medium',
        createdAt: new Date().toISOString()
      };

      // Persist to DB using the adapter
      await wawi.insertShopOffers(orderId, mockOffer.oemNumber, [mockOffer]);

      // Update order status so it appears in "Angebote bereit"
      await wawi.updateOrderStatus(orderId, 'new');

      return res.status(201).json(mockOffer);
    } catch (error) {
      logger.error('Error creating offer:', error);
      return res.status(500).json({ error: 'Failed to create offer' });
    }
  });

  router.get("/orders/:id/messages", async (req: Request, res: Response) => {
    try {
      const orderId = req.params.id;
      const msgs = await wawi.listMessagesByOrderId(orderId);
      const mapped = msgs.map((m: any) => mapMessageRowToDashboardMessage(m));
      return res.status(200).json(mapped);
    } catch (err: any) {
      logger.error("Error fetching messages:", err);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  router.post("/orders/:id/messages", async (req: Request, res: Response) => {
    try {
      const orderId = req.params.id;
      const { content } = req.body;

      if (!content) return res.status(400).json({ error: "Content is required" });

      // We need the customer contact (WA ID) to use insertMessage
      const order = await wawi.getOrderById(orderId);
      if (!order || !order.customerContact) {
        return res.status(404).json({ error: "Order or customer contact not found" });
      }

      // Insert OUTBOUND message
      const result = await wawi.insertMessage(order.customerContact, content, 'OUT');

      return res.status(201).json(mapMessageRowToDashboardMessage({
        id: result.id,
        direction: 'OUT',
        content: content,
        created_at: new Date().toISOString()
      }));

    } catch (err: any) {
      logger.error("Error sending message:", err);
      return res.status(500).json({ error: "Failed to send message" });
    }
  });


  router.get("/stats", async (req: Request, res: Response) => {
    try {
      const orders = await wawi.listOrders();
      const stats = {
        ordersNew: orders.filter(o => o.status === 'new').length,
        ordersInProgress: orders.filter(o => o.status !== 'new' && o.status !== 'done' && o.status !== 'aborted').length,
        invoicesDraft: 0,
        invoicesIssued: 0,
        revenueToday: 1250.50, // Mocked
        lastSync: new Date().toISOString(),

        // Optional arrays empty for now (safe)
        revenueHistory: [
          { date: '2025-01-01', revenue: 1200, orders: 5 },
          { date: '2025-01-02', revenue: 850, orders: 3 },
          { date: '2025-01-03', revenue: 2100, orders: 8 }
        ],
        topCustomers: [],
        activities: []
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

  router.get("/suppliers", async (_req: Request, res: Response) => {
    try {
      const suppliers = await wawi.listSuppliers();
      return res.status(200).json(suppliers);
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  router.get("/offers", async (req: Request, res: Response) => {
    try {
      const orderId = req.query.orderId as string;
      const offers = await wawi.listOffers(orderId);
      return res.status(200).json(offers);
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to fetch offers" });
    }
  });

  router.get("/analytics/forensics", async (_req: Request, res: Response) => {
    try {
      const stats = await analytics.getForensics();
      return res.status(200).json(stats);
    } catch (err: any) {
      logger.error("Analytics Error", err);
      return res.status(500).json({ error: "Failed to calc forensics" });
    }
  });

  router.get("/analytics/conversion", async (_req: Request, res: Response) => {
    try {
      const stats = await analytics.getConversion();
      return res.status(200).json(stats);
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to calc conversion" });
    }
  });

  // Conversations endpoint
  router.get("/conversations", async (_req: Request, res: Response) => {
    try {
      // Return empty array for now - conversations are tracked via order messages
      return res.status(200).json([]);
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Customers endpoint
  router.get("/customers", async (_req: Request, res: Response) => {
    try {
      // Get unique customers from orders
      const orders = await wawi.listOrders();
      const customersMap = new Map();

      orders.forEach(order => {
        if (order.customerContact && !customersMap.has(order.customerContact)) {
          customersMap.set(order.customerContact, {
            id: order.customerContact,
            phone: order.customerContact,
            name: order.customerContact,
            orders_count: 1,
            total_revenue: 0,
            created_at: order.createdAt
          });
        } else if (order.customerContact) {
          const existing = customersMap.get(order.customerContact);
          existing.orders_count++;
        }
      });

      return res.status(200).json(Array.from(customersMap.values()));
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  return router;
}

export function registerDashboardRoutes(app: Application) {
  app.use("/api/dashboard", createDashboardRouter());
}

export default registerDashboardRoutes;
