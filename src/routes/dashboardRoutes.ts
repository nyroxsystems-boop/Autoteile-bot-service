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
import { getDb } from '../services/core/database';

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
      const pool = getDb();

      // Count orders by status
      const ordersNew = orders.filter(o => o.status === 'new').length;
      const ordersInProgress = orders.filter(o =>
        o.status !== 'new' && o.status !== 'done' && o.status !== 'aborted'
      ).length;
      const ordersDone = orders.filter(o => o.status === 'done').length;

      // Get today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ordersToday = orders.filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= today;
      }).length;

      // Revenue from invoices (today)
      let revenueToday = 0;
      let invoicesDraft = 0;
      let invoicesIssued = 0;
      try {
        const invoiceStats = await pool.query(
          `SELECT 
            COALESCE(SUM(CASE WHEN created_at::date = CURRENT_DATE AND status != 'cancelled' THEN total_amount ELSE 0 END), 0) as revenue_today,
            COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) as drafts,
            COALESCE(SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END), 0) as issued
           FROM invoices`
        );
        if (invoiceStats.rows[0]) {
          revenueToday = parseFloat(invoiceStats.rows[0].revenue_today) || 0;
          invoicesDraft = parseInt(invoiceStats.rows[0].drafts) || 0;
          invoicesIssued = parseInt(invoiceStats.rows[0].issued) || 0;
        }
      } catch (err) {
        logger.debug('[Stats] Invoice query failed (table may not exist)', { error: err });
      }

      // Revenue history (last 30 days)
      let revenueHistory: { date: string; amount: number }[] = [];
      try {
        const historyResult = await pool.query(
          `SELECT created_at::date as day, COALESCE(SUM(total_amount), 0) as amount
           FROM invoices WHERE status != 'cancelled' AND created_at >= NOW() - INTERVAL '30 days'
           GROUP BY day ORDER BY day`
        );
        revenueHistory = historyResult.rows.map(r => ({
          date: r.day.toISOString().split('T')[0],
          amount: parseFloat(r.amount) || 0
        }));
      } catch (err) {
        logger.debug('[Stats] Revenue history query failed', { error: err });
      }

      // Top customers from orders (by order count)
      const customerMap = new Map<string, { name: string; orders: number; lastOrder: string }>();
      orders.forEach(o => {
        const contact = o.customerContact || o.customerPhone;
        if (!contact) return;
        const existing = customerMap.get(contact);
        if (existing) {
          existing.orders++;
          if (o.createdAt > existing.lastOrder) existing.lastOrder = o.createdAt;
        } else {
          customerMap.set(contact, {
            name: o.contact?.name || contact,
            orders: 1,
            lastOrder: o.createdAt || new Date().toISOString()
          });
        }
      });
      const topCustomers = Array.from(customerMap.entries())
        .sort((a, b) => b[1].orders - a[1].orders)
        .slice(0, 5)
        .map(([id, data]) => ({ id, name: data.name, orderCount: data.orders, lastOrder: data.lastOrder }));

      // Recent activities from latest orders
      const activities = orders.slice(0, 10).map(o => ({
        id: o.id,
        type: o.status === 'new' ? 'new_order' : o.status === 'done' ? 'order_completed' : 'order_updated',
        description: `${o.contact?.name || o.customerPhone || 'Kunde'}: ${o.part?.partText || o.requestedPartName || 'Anfrage'}`,
        timestamp: o.createdAt || new Date().toISOString(),
        status: o.status
      }));

      const stats = {
        ordersNew,
        ordersInProgress,
        ordersDone,
        ordersTotal: orders.length,
        ordersToday,
        invoicesDraft,
        invoicesIssued,
        revenueToday,
        lastSync: new Date().toISOString(),
        revenueHistory,
        topCustomers,
        activities
      };
      return res.status(200).json(stats);
    } catch (err: any) {
      logger.error('[Dashboard] Stats error', { error: err?.message });
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

  // Conversations endpoint — aggregates orders by customer
  router.get("/conversations", async (_req: Request, res: Response) => {
    try {
      const orders = await wawi.listOrders();
      
      // Group orders by customer contact to create "conversations"
      const conversationMap = new Map<string, any>();
      
      for (const order of orders) {
        const contactId = order.customerContact || order.customerPhone;
        if (!contactId) continue;
        
        if (!conversationMap.has(contactId)) {
          conversationMap.set(contactId, {
            id: order.id,
            contact: {
              name: order.contact?.name || contactId,
              wa_id: contactId,
            },
            state_json: {
              status: order.status,
              last_text: order.part?.partText || order.requestedPartName || '',
              oem_list: order.oem_number ? [order.oem_number] : [],
              history: [],
            },
            last_message_at: order.createdAt || new Date().toISOString(),
            orders_count: 1,
          });
        } else {
          const conv = conversationMap.get(contactId);
          conv.orders_count++;
          // Add OEM numbers
          if (order.oem_number && !conv.state_json.oem_list.includes(order.oem_number)) {
            conv.state_json.oem_list.push(order.oem_number);
          }
          // Use most recent order date
          if (order.createdAt > conv.last_message_at) {
            conv.last_message_at = order.createdAt;
            conv.state_json.status = order.status;
            conv.state_json.last_text = order.part?.partText || order.requestedPartName || conv.state_json.last_text;
          }
        }
      }
      
      const conversations = Array.from(conversationMap.values())
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      
      return res.status(200).json(conversations);
    } catch (err: any) {
      logger.error('[Dashboard] Conversations error', { error: err?.message });
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
