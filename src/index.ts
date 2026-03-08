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
import { apiLimiter, authLimiter, webhookLimiter } from "./middleware/rateLimiter";
import { createAdminRouter } from "./routes/adminRoutes";
import { createBillingRouter } from "./routes/billingRoutes";
import { createCrmRouter } from "./routes/crmRoutes";
import adminAuthRouter from "./routes/adminAuthRoutes";
import emailTemplatesRouter from "./routes/emailTemplatesRoutes";
import botTestingRouter from "./routes/botTestingRoutes";
import inboxRouter from "./routes/inboxRoutes";
import shopIntegrationRouter from "./routes/shopIntegrationRoutes";
import productsRouter from "./routes/productRoutes";

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
app.use("/api/", apiLimiter);        // Standard API limit: 60 req/min
app.use("/api/auth", authLimiter);   // Strict auth limit: 5 req/15min

// Root Route - Visual Confirmation
app.get("/", (_req, res) => {
  res.send("🚀 AutoTeile Bot Service is running!");
});

// ──────────────────────────────────────────────────
// PUBLIC ROUTES (no auth required)
// ──────────────────────────────────────────────────

// Auth API (handles login — must be public)
app.use("/api/auth", authRouter);

// Admin Auth API (separate admin login — must be public)
app.use("/api/admin-auth", adminAuthRouter);

// Twilio WhatsApp Webhook (receives form-encoded payloads from Twilio)
app.use("/webhook/whatsapp", whatsappWebhookRouter);

// Health Check API (extended diagnostics)
app.use("/health", healthRouter);

// CRM Leads API (receives leads from landing page — must be public)
app.use("/api/crm", createCrmRouter());

// ──────────────────────────────────────────────────
// PROTECTED ROUTES (all require authMiddleware)
// ──────────────────────────────────────────────────

// Orders API
app.use("/api/orders", authMiddleware, ordersRouter);
app.use("/api/orders", authMiddleware, orderScrapingRouter);
app.use("/api/orders", authMiddleware, orderAutoSelectRouter);
app.use("/api/orders", authMiddleware, orderAutoOrderRouter);

// OEM Resolution API
app.use("/api/oem", authMiddleware, oemRouter);

// Bot Pipeline (incoming messages)
app.use("/bot/message", authMiddleware, botMessageRouter);

// Dashboard API
registerDashboardRoutes(app);

// User Management API
app.use("/api/users", authMiddleware, userRouter);

// Bot Health API
app.use("/api/bot", authMiddleware, createBotHealthRouter());

// Suppliers API
app.use("/api/suppliers", authMiddleware, createSuppliersRouter());

// Stock Movements API (WAWI)
app.use("/api/stock", authMiddleware, stockMovementsRouter);

// Purchase Orders API (WAWI)
app.use("/api/purchase-orders", authMiddleware, purchaseOrdersRouter);

// Offers API
app.use("/api/offers", authMiddleware, createOffersRouter());

// WWS Connections API
app.use("/api/wws-connections", authMiddleware, createWwsConnectionsRouter());

// Tax Module API
app.use("/api/tax", authMiddleware, taxRouter);

// Invoice API
app.use("/api/invoices", authMiddleware, invoiceRouter);

// Settings API
app.use("/api/settings", authMiddleware, settingsRouter);

// B2B Supplier API
app.use("/api/b2b", authMiddleware, b2bRouter);

// Internal API
app.use("/internal", authMiddleware, createInternalRouter());

// Admin / Sales API
app.use("/api/admin", authMiddleware, createAdminRouter());

// Billing API
app.use("/api/billing", authMiddleware, createBillingRouter());

// Email Templates API (admin marketing)
app.use("/api/admin/emails", authMiddleware, emailTemplatesRouter);

// Bot Testing API (Admin Dashboard OEM Simulator)
app.use("/api/bot-testing", authMiddleware, botTestingRouter);

// Inbox API (Admin Email Management)
app.use("/api/inbox", authMiddleware, inboxRouter);

// External Shop Integration
app.use("/api/integrations", authMiddleware, shopIntegrationRouter);

// Product Management API
app.use("/api/products", authMiddleware, productsRouter);

// Simulations-Endpoint (local dev/testing only)
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
