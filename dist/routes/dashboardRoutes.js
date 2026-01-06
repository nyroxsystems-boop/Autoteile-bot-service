"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDashboardRouter = createDashboardRouter;
exports.registerDashboardRoutes = registerDashboardRoutes;
const express_1 = require("express");
const crypto_1 = require("crypto");
const wawi = __importStar(require("../services/adapters/inventreeAdapter"));
const dashboardMappers_1 = require("../mappers/dashboardMappers");
const logger_1 = require("../utils/logger");
const authMiddleware_1 = require("../middleware/authMiddleware");
const analytics = __importStar(require("../services/core/analyticsService"));
function createDashboardRouter() {
    const router = (0, express_1.Router)();
    // Apply auth to all dashboard routes
    router.use(authMiddleware_1.authMiddleware);
    router.get("/orders", async (_req, res) => {
        try {
            const orders = await wawi.listOrders();
            // For each order, find vehicle if it exists
            const mapped = await Promise.all(orders.map(async (o) => {
                const vehicle = await wawi.getVehicleForOrder(o.id);
                return (0, dashboardMappers_1.mapOrderRowToDashboardOrder)(o, vehicle);
            }));
            return res.status(200).json(mapped);
        }
        catch (err) {
            logger_1.logger.error("Dashboard error fetching orders", { error: err.message });
            return res.status(500).json({ error: "Failed to fetch orders" });
        }
    });
    router.get("/orders/:id", async (req, res) => {
        try {
            const order = await wawi.getOrderById(req.params.id);
            if (!order)
                return res.status(404).json({ error: "Order not found" });
            const vehicle = await wawi.getVehicleForOrder(order.id);
            const mapped = (0, dashboardMappers_1.mapOrderRowToDashboardOrder)(order, vehicle);
            return res.status(200).json(mapped);
        }
        catch (err) {
            return res.status(500).json({ error: "Failed to fetch order" });
        }
    });
    router.post('/orders/:id/offers', authMiddleware_1.authMiddleware, async (req, res) => {
        const orderId = req.params.id;
        const { price, supplierName, deliveryTime } = req.body;
        if (!orderId) {
            return res.status(400).json({ error: 'Invalid order ID' });
        }
        try {
            // Logic to save offer...
            // For now, we return a mock offer
            const mockOffer = {
                id: (0, crypto_1.randomUUID)(),
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
        }
        catch (error) {
            logger_1.logger.error('Error creating offer:', error);
            return res.status(500).json({ error: 'Failed to create offer' });
        }
    });
    router.get("/orders/:id/messages", async (req, res) => {
        try {
            const orderId = req.params.id;
            const msgs = await wawi.listMessagesByOrderId(orderId);
            const mapped = msgs.map((m) => (0, dashboardMappers_1.mapMessageRowToDashboardMessage)(m));
            return res.status(200).json(mapped);
        }
        catch (err) {
            logger_1.logger.error("Error fetching messages:", err);
            return res.status(500).json({ error: "Failed to fetch messages" });
        }
    });
    router.post("/orders/:id/messages", async (req, res) => {
        try {
            const orderId = req.params.id;
            const { content } = req.body;
            if (!content)
                return res.status(400).json({ error: "Content is required" });
            // We need the customer contact (WA ID) to use insertMessage
            const order = await wawi.getOrderById(orderId);
            if (!order || !order.customerContact) {
                return res.status(404).json({ error: "Order or customer contact not found" });
            }
            // Insert OUTBOUND message
            const result = await wawi.insertMessage(order.customerContact, content, 'OUT');
            return res.status(201).json((0, dashboardMappers_1.mapMessageRowToDashboardMessage)({
                id: result.id,
                direction: 'OUT',
                content: content,
                created_at: new Date().toISOString()
            }));
        }
        catch (err) {
            logger_1.logger.error("Error sending message:", err);
            return res.status(500).json({ error: "Failed to send message" });
        }
    });
    router.get("/stats", async (req, res) => {
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
        }
        catch (err) {
            return res.status(500).json({ error: "Failed to fetch stats" });
        }
    });
    router.get('/merchant/settings/:merchantId', async (req, res) => {
        const settings = await wawi.getMerchantSettings(req.params.merchantId);
        return res.status(200).json(settings);
    });
    router.get("/suppliers", async (_req, res) => {
        try {
            const suppliers = await wawi.listSuppliers();
            return res.status(200).json(suppliers);
        }
        catch (err) {
            return res.status(500).json({ error: "Failed to fetch suppliers" });
        }
    });
    router.get("/offers", async (req, res) => {
        try {
            const orderId = req.query.orderId;
            const offers = await wawi.listOffers(orderId);
            return res.status(200).json(offers);
        }
        catch (err) {
            return res.status(500).json({ error: "Failed to fetch offers" });
        }
    });
    router.get("/analytics/forensics", async (_req, res) => {
        try {
            const stats = await analytics.getForensics();
            return res.status(200).json(stats);
        }
        catch (err) {
            logger_1.logger.error("Analytics Error", err);
            return res.status(500).json({ error: "Failed to calc forensics" });
        }
    });
    router.get("/analytics/conversion", async (_req, res) => {
        try {
            const stats = await analytics.getConversion();
            return res.status(200).json(stats);
        }
        catch (err) {
            return res.status(500).json({ error: "Failed to calc conversion" });
        }
    });
    // Conversations endpoint
    router.get("/conversations", async (_req, res) => {
        try {
            // Return empty array for now - conversations are tracked via order messages
            return res.status(200).json([]);
        }
        catch (err) {
            return res.status(500).json({ error: "Failed to fetch conversations" });
        }
    });
    // Customers endpoint
    router.get("/customers", async (_req, res) => {
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
                }
                else if (order.customerContact) {
                    const existing = customersMap.get(order.customerContact);
                    existing.orders_count++;
                }
            });
            return res.status(200).json(Array.from(customersMap.values()));
        }
        catch (err) {
            return res.status(500).json({ error: "Failed to fetch customers" });
        }
    });
    return router;
}
function registerDashboardRoutes(app) {
    app.use("/api/dashboard", createDashboardRouter());
}
exports.default = registerDashboardRoutes;
