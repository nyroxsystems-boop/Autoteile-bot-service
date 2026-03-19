import express from "express";
import { logger } from "@utils/logger";
import cors from "cors";
import helmet from "helmet";

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
import { requireAdmin } from "./middleware/requireAdmin";
import { apiLimiter, authLimiter, webhookLimiter } from "./middleware/rateLimiter";
import { requestIdMiddleware } from "./middleware/requestId";
import { createAdminRouter } from "./routes/adminRoutes";
import { createBillingRouter } from "./routes/billingRoutes";
import { createCrmRouter } from "./routes/crmRoutes";
import adminAuthRouter from "./routes/adminAuthRoutes";
import emailTemplatesRouter from "./routes/emailTemplatesRoutes";
import botTestingRouter from "./routes/botTestingRoutes";
import inboxRouter from "./routes/inboxRoutes";
import shopIntegrationRouter from "./routes/shopIntegrationRoutes";
import productsRouter from "./routes/productRoutes";
import gdprRouter from "./routes/gdprRoutes";

// Queue Worker - nur starten wenn Redis verfügbar
if (process.env.REDIS_URL) {
  import("./queue/botWorker").then(() => {
    logger.info("Queue worker started");
  }).catch(err => {
    logger.error("Failed to start queue worker:", err);
  });
} else {
  logger.warn("⚠️  Skipping queue worker — REDIS_URL not set");
  if (process.env.NODE_ENV === 'production') {
    logger.error("🔴 CRITICAL: REDIS_URL is not set in production!");
    logger.error("   → Rate limiting will NOT work across instances");
    logger.error("   → WhatsApp messages will be processed synchronously (risk of timeouts)");
    logger.error("   → Set REDIS_URL environment variable to fix this");
  }
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

// Production origins MUST be set via CORS_ALLOWED_ORIGINS env variable
const envOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

if (envOrigins.length === 0 && process.env.NODE_ENV === 'production') {
  logger.warn('[CORS] ⚠️  CORS_ALLOWED_ORIGINS not set in production! Set it to your dashboard URLs.');
}

// Merge and deduplicate
const allowedOrigins = [...new Set([...alwaysAllowedOrigins, ...envOrigins])];

logger.info({ origins: allowedOrigins }, '[CORS] Allowed origins configured');

const corsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Device-ID', 'X-Tenant-ID'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(requestIdMiddleware); // Trace ID for every request
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Use same options for preflight
app.use(helmet()); // Security headers (X-Content-Type-Options, HSTS, etc.)
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

// Admin / Sales API (admin-only)
app.use("/api/admin", authMiddleware, requireAdmin, createAdminRouter());

// Billing API
app.use("/api/billing", authMiddleware, createBillingRouter());

// Email Templates API (admin marketing, admin-only)
app.use("/api/admin/emails", authMiddleware, requireAdmin, emailTemplatesRouter);

// Bot Testing API (Admin Dashboard OEM Simulator, admin-only)
app.use("/api/bot-testing", authMiddleware, requireAdmin, botTestingRouter);

// Inbox API (Admin Email Management, admin-only)
app.use("/api/inbox", authMiddleware, requireAdmin, inboxRouter);

// External Shop Integration
app.use("/api/integrations", authMiddleware, shopIntegrationRouter);

// Product Management API
app.use("/api/products", authMiddleware, productsRouter);

// GDPR/DSGVO Compliance API (admin-only)
app.use("/api/gdpr", authMiddleware, requireAdmin, gdprRouter);

// Simulations-Endpoint (BLOCKED in production, protected in dev)
if (process.env.NODE_ENV !== 'production') {
  app.use("/simulate/whatsapp", authMiddleware, simulateWhatsappRouter);
}

// ──────────────────────────────────────────────────
// GLOBAL ERROR HANDLERS (P0: prevent silent crashes)
// ──────────────────────────────────────────────────
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('[FATAL] Unhandled promise rejection', { reason });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('[FATAL] Uncaught exception — shutting down', { error: error.message, stack: error.stack });
  process.exit(1);
});

// ──────────────────────────────────────────────────
// ENV VALIDATION (P0: fail-fast on missing config)
// ──────────────────────────────────────────────────
function validateEnv(): void {
  const missing: string[] = [];
  const requiredInProd = ['JWT_SECRET', 'DATABASE_URL'];
  const recommended = ['GEMINI_API_KEY', 'TWILIO_AUTH_TOKEN', 'REDIS_URL'];

  if (process.env.NODE_ENV === 'production') {
    for (const key of requiredInProd) {
      if (!process.env[key]) missing.push(key);
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      logger.error('[ENV] JWT_SECRET must be at least 32 characters in production');
      missing.push('JWT_SECRET (too short)');
    }
    if (missing.length > 0) {
      logger.error('[ENV] Missing required environment variables', { missing });
      process.exit(1);
    }
    for (const key of recommended) {
      if (!process.env[key]) {
        logger.warn(`[ENV] ⚠️  Recommended variable ${key} is not set`);
      }
    }
  }
}

validateEnv();

// Serverstart
initDb().then(async () => {
  // Run tax module migrations
  const { runTaxMigrations } = await import('./migrations/runTaxMigrations');
  await runTaxMigrations().catch(err => {
    logger.error('Tax migration failed (non-critical):', err);
  });

  // Run admin module migrations
  const { runMigration: runAdminUsersMigration } = await import('./migrations/002_admin_users');
  await runAdminUsersMigration().catch(err => {
    logger.error('Admin users migration failed (non-critical):', err);
  });

  const { runMigration: runActivityLogMigration } = await import('./migrations/003_admin_activity_log');
  await runActivityLogMigration().catch(err => {
    logger.error('Activity log migration failed (non-critical):', err);
  });

  // Run email assignments migration
  const { runMigration: runEmailAssignmentsMigration } = await import('./migrations/004_email_assignments');
  await runEmailAssignmentsMigration().catch(err => {
    logger.error('Email assignments migration failed (non-critical):', err);
  });

  const server = app.listen(env.port, () => {
    logger.info(`Bot service listening on port ${env.port}`);
  });

  // ──────────────────────────────────────────────────
  // GRACEFUL SHUTDOWN (P0: prevent data loss on deploy)
  // ──────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`[Shutdown] Received ${signal}, graceful shutdown starting...`);

    // 1. Stop accepting new connections
    server.close(() => {
      logger.info('[Shutdown] HTTP server closed');
    });

    // 2. Close database pool
    try {
      const { closePool } = await import('./services/core/database');
      await closePool();
      logger.info('[Shutdown] Database pool closed');
    } catch (err) {
      logger.error('[Shutdown] Error closing database pool', { error: err });
    }

    logger.info('[Shutdown] Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

}).catch(err => {
  logger.error("Failed to init database", err);
  process.exit(1);
});

