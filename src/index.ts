import express from "express";
import cors from "cors";

import { env } from "./config/env";
import { testDbConnection } from "./services/adapters/supabaseService";
import ordersRouter from "./routes/orders";
import orderScrapingRouter from "./routes/orderScraping";
import simulateWhatsappRouter from "./routes/simulateWhatsapp";
import botMessageRouter from "./routes/botMessage";
import oemRouter from "./routes/oem";
import orderAutoSelectRouter from "./routes/orderAutoSelect";
import orderAutoOrderRouter from "./routes/orderAutoOrder";
import whatsappWebhookRouter from "./routes/whatsappWebhook";
import { registerDashboardRoutes } from "./routes/dashboardRoutes";
import { createInternalRouter } from "./routes/internalRoutes";
import { initDb } from "./services/core/database";

// Queue Worker - nur starten wenn Redis verfügbar
if (process.env.REDIS_URL) {
  import("./queue/botWorker").then(() => {
    console.log("Queue worker started");
  }).catch(err => {
    console.error("Failed to start queue worker:", err);
  });
} else {
  console.log("Skipping queue worker - REDIS_URL not set");
}

import { createBotHealthRouter } from "./routes/botHealth";
import { createSuppliersRouter } from "./routes/suppliers";
import stockMovementsRouter from "./routes/stockMovements";
import purchaseOrdersRouter from "./routes/purchaseOrders";
import { createOffersRouter } from "./routes/offers";
import { createWwsConnectionsRouter } from "./routes/wwsConnections";
import authRouter from "./routes/authRoutes";
import userRouter from "./routes/userRoutes";
import taxRouter from "./routes/taxRoutes";
import invoiceRouter from "./routes/invoiceRoutes";
import b2bRouter from "./routes/b2bRoutes";
import healthRouter from "./routes/healthRoutes";
import settingsRouter from "./routes/settingsRoutes";
import { authMiddleware } from "./middleware/authMiddleware";


const app = express();

// Middleware
// Always include these critical domains
const alwaysAllowedOrigins = [
  'https://admin.partsunion.de',
  'https://app.partsunion.de',
  'https://partsunion.de',
  'https://www.partsunion.de',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174'
];

// Additional origins from env (if any)
const envOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
    'https://autoteile-dashboard.onrender.com',
    'https://crm-system.onrender.com',
    'https://admin-dashboard.onrender.com',
    'https://admin-dashboard-ufau.onrender.com'
  ];

// Merge and deduplicate
const allowedOrigins = [...new Set([...alwaysAllowedOrigins, ...envOrigins])];

console.log('[CORS] Allowed origins:', allowedOrigins);

const corsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Device-ID', 'X-Tenant-ID'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Use same options for preflight
app.use(express.json());

// Rate Limiting - Apply globally to all API routes
import { apiLimiter, authLimiter, webhookLimiter } from "./middleware/rateLimiter";
app.use("/api/", apiLimiter);        // Standard API limit: 60 req/min
app.use("/api/auth", authLimiter);   // Strict auth limit: 5 req/15min

// Root Route - Visual Confirmation
app.get("/", (_req, res) => {
  res.send("🚀 AutoTeile Bot Service is running!");
});

// Orders-API für das spätere Dashboard
app.use("/api/orders", ordersRouter);

// Scraping-API: Angebote für eine Order & OEM aus Shops holen
app.use("/api/orders", orderScrapingRouter);

// Auto-Select & Auto-Order Workflows
app.use("/api/orders", orderAutoSelectRouter);
app.use("/api/orders", orderAutoOrderRouter);

// OEM-Ermittlung (Mock)
app.use("/api/oem", oemRouter);

// Bot-Pipeline für eingehende Nachrichten
app.use("/bot/message", botMessageRouter);

// Twilio WhatsApp Webhook (receives form-encoded payloads)
app.use("/webhook/whatsapp", whatsappWebhookRouter);

// Auth API (no auth middleware - handles login)
app.use("/api/auth", authRouter);

// User Management API (requires auth)
app.use("/api/users", userRouter);

// Health Check API (extended diagnostics)
app.use("/health", healthRouter);

// Dashboard API
registerDashboardRoutes(app);

// Bot Health API
app.use("/api/bot", createBotHealthRouter());

// Suppliers API
app.use("/api/suppliers", createSuppliersRouter());

// Stock Movements API (WAWI)
app.use("/api/stock", stockMovementsRouter);

// Purchase Orders API (WAWI)
app.use("/api/purchase-orders", purchaseOrdersRouter);

// Offers API  
app.use("/api/offers", createOffersRouter());

// WWS Connections API
app.use("/api/wws-connections", createWwsConnectionsRouter());

// Tax Module API (requires auth)
app.use("/api/tax", authMiddleware, taxRouter);

// Invoice API (requires auth)
app.use("/api/invoices", authMiddleware, invoiceRouter);

// Settings API (requires auth)
app.use("/api/settings", authMiddleware, settingsRouter);

// B2B Supplier API (requires auth)
app.use("/api/b2b", b2bRouter);

// Internal API
app.use("/internal", createInternalRouter());

// Admin / Sales API
import { createAdminRouter } from "./routes/adminRoutes";
app.use("/api/admin", createAdminRouter());

// Billing API
import { createBillingRouter } from "./routes/billingRoutes";
app.use("/api/billing", createBillingRouter());


// CRM Integration API (Leads -> InvenTree)
import { createCrmRouter } from "./routes/crmRoutes";
app.use("/api/crm", createCrmRouter());

// Admin Authentication API (separate from merchant auth)
import adminAuthRouter from "./routes/adminAuthRoutes";
app.use("/api/admin-auth", adminAuthRouter);

// Email Templates API (for admin marketing)
import emailTemplatesRouter from "./routes/emailTemplatesRoutes";
app.use("/api/admin/emails", emailTemplatesRouter);

// Bot Testing API (Admin Dashboard OEM Simulator)
import botTestingRouter from "./routes/botTestingRoutes";
app.use("/api/bot-testing", botTestingRouter);

// Inbox API (Admin Email Management)
import inboxRouter from "./routes/inboxRoutes";
app.use("/api/inbox", inboxRouter);

// External Shop Integration (Phase 10)
import shopIntegrationRouter from "./routes/shopIntegrationRoutes";
app.use("/api/integrations", shopIntegrationRouter);

// Simulations-Endpoint für eingehende WhatsApp-Nachrichten
// Dient nur für lokale Entwicklung und Tests – hier wird noch keine echte
// WhatsApp-API angesprochen.
// Product Management API (Secure Tenant Isolation)
import productsRouter from "./routes/productRoutes";
app.use("/api/products", productsRouter);

// Simulations-Endpoint für eingehende WhatsApp-Nachrichten
app.use("/simulate/whatsapp", simulateWhatsappRouter);

// Serverstart
initDb().then(async () => {
  // Run tax module migrations
  const { runTaxMigrations } = await import('./migrations/runTaxMigrations');
  await runTaxMigrations().catch(err => {
    console.error('Tax migration failed (non-critical):', err);
  });

  // Run admin module migrations
  const { runMigration: runAdminUsersMigration } = await import('./migrations/002_admin_users');
  await runAdminUsersMigration().catch(err => {
    console.error('Admin users migration failed (non-critical):', err);
  });

  const { runMigration: runActivityLogMigration } = await import('./migrations/003_admin_activity_log');
  await runActivityLogMigration().catch(err => {
    console.error('Activity log migration failed (non-critical):', err);
  });

  // Run email assignments migration
  const { runMigration: runEmailAssignmentsMigration } = await import('./migrations/004_email_assignments');
  await runEmailAssignmentsMigration().catch(err => {
    console.error('Email assignments migration failed (non-critical):', err);
  });

  app.listen(env.port, () => {
    console.log(`Bot service listening on port ${env.port}`);
  });
}).catch(err => {
  console.error("Failed to init database", err);
  process.exit(1);
});
