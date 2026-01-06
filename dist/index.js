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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const supabaseService_1 = require("./services/adapters/supabaseService");
const orders_1 = __importDefault(require("./routes/orders"));
const orderScraping_1 = __importDefault(require("./routes/orderScraping"));
const simulateWhatsapp_1 = __importDefault(require("./routes/simulateWhatsapp"));
const botMessage_1 = __importDefault(require("./routes/botMessage"));
const oem_1 = __importDefault(require("./routes/oem"));
const orderAutoSelect_1 = __importDefault(require("./routes/orderAutoSelect"));
const orderAutoOrder_1 = __importDefault(require("./routes/orderAutoOrder"));
const whatsappWebhook_1 = __importDefault(require("./routes/whatsappWebhook"));
const dashboardRoutes_1 = require("./routes/dashboardRoutes");
const internalRoutes_1 = require("./routes/internalRoutes");
const database_1 = require("./services/core/database");
// Queue Worker - nur starten wenn Redis verfügbar
if (process.env.REDIS_URL) {
    Promise.resolve().then(() => __importStar(require("./queue/botWorker"))).then(() => {
        console.log("Queue worker started");
    }).catch(err => {
        console.error("Failed to start queue worker:", err);
    });
}
else {
    console.log("Skipping queue worker - REDIS_URL not set");
}
const botHealth_1 = require("./routes/botHealth");
const suppliers_1 = require("./routes/suppliers");
const stockMovements_1 = __importDefault(require("./routes/stockMovements"));
const purchaseOrders_1 = __importDefault(require("./routes/purchaseOrders"));
const offers_1 = require("./routes/offers");
const wwsConnections_1 = require("./routes/wwsConnections");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const app = (0, express_1.default)();
// Middleware
const corsOptions = {
    origin: process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [
            'https://autoteile-dashboard.onrender.com',
            'https://crm-system.onrender.com',
            'https://admin-dashboard.onrender.com',
            'https://admin-dashboard-ufau.onrender.com',
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5174'
        ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Device-ID', 'X-Tenant-ID'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions)); // Use same options for preflight
app.use(express_1.default.json());
// Einfacher Healthcheck – Service läuft?
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
// Root Route - Visual Confirmation
app.get("/", (_req, res) => {
    res.send("🚀 AutoTeile Bot Service is running!");
});
// Datenbank-Healthcheck – Verbindung funktioniert?
app.get("/health/db", async (_req, res) => {
    const result = await (0, supabaseService_1.testDbConnection)();
    if (result) {
        res.json({ status: "ok" });
    }
    else {
        res.status(500).json({
            status: "error",
            error: "DB connection failed"
        });
    }
});
// Orders-API für das spätere Dashboard
app.use("/api/orders", orders_1.default);
// Scraping-API: Angebote für eine Order & OEM aus Shops holen
app.use("/api/orders", orderScraping_1.default);
// Auto-Select & Auto-Order Workflows
app.use("/api/orders", orderAutoSelect_1.default);
app.use("/api/orders", orderAutoOrder_1.default);
// OEM-Ermittlung (Mock)
app.use("/api/oem", oem_1.default);
// Bot-Pipeline für eingehende Nachrichten
app.use("/bot/message", botMessage_1.default);
// Twilio WhatsApp Webhook (receives form-encoded payloads)
app.use("/webhook/whatsapp", whatsappWebhook_1.default);
// Auth API (no auth middleware - handles login)
app.use("/api/auth", authRoutes_1.default);
// User Management API (requires auth)
app.use("/api/users", userRoutes_1.default);
// Dashboard API
(0, dashboardRoutes_1.registerDashboardRoutes)(app);
// Bot Health API
app.use("/api/bot", (0, botHealth_1.createBotHealthRouter)());
// Suppliers API
app.use("/api/suppliers", (0, suppliers_1.createSuppliersRouter)());
// Stock Movements API (WAWI)
app.use("/api/stock", stockMovements_1.default);
// Purchase Orders API (WAWI)
app.use("/api/purchase-orders", purchaseOrders_1.default);
// Offers API  
app.use("/api/offers", (0, offers_1.createOffersRouter)());
// WWS Connections API
app.use("/api/wws-connections", (0, wwsConnections_1.createWwsConnectionsRouter)());
// Internal API
app.use("/internal", (0, internalRoutes_1.createInternalRouter)());
// Admin / Sales API
const adminRoutes_1 = require("./routes/adminRoutes");
app.use("/api/admin", (0, adminRoutes_1.createAdminRouter)());
// Billing API
const billingRoutes_1 = require("./routes/billingRoutes");
app.use("/api/billing", (0, billingRoutes_1.createBillingRouter)());
// CRM Integration API (Leads -> InvenTree)
const crmRoutes_1 = require("./routes/crmRoutes");
app.use("/api/crm", (0, crmRoutes_1.createCrmRouter)());
// External Shop Integration (Phase 10)
const shopIntegrationRoutes_1 = __importDefault(require("./routes/shopIntegrationRoutes"));
app.use("/api/integrations", shopIntegrationRoutes_1.default);
// Simulations-Endpoint für eingehende WhatsApp-Nachrichten
// Dient nur für lokale Entwicklung und Tests – hier wird noch keine echte
// WhatsApp-API angesprochen.
// Product Management API (Secure Tenant Isolation)
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
app.use("/api/products", productRoutes_1.default);
// Simulations-Endpoint für eingehende WhatsApp-Nachrichten
app.use("/simulate/whatsapp", simulateWhatsapp_1.default);
// Serverstart
(0, database_1.initDb)().then(() => {
    app.listen(env_1.env.port, () => {
        console.log(`Bot service listening on port ${env_1.env.port}`);
    });
}).catch(err => {
    console.error("Failed to init database", err);
    process.exit(1);
});
