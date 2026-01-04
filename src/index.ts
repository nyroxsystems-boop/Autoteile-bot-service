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
import { createOffersRouter } from "./routes/offers";
import { createWwsConnectionsRouter } from "./routes/wwsConnections";
import authRouter from "./routes/authRoutes";
import userRouter from "./routes/userRoutes";


const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for now to prevent blocked requests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Device-ID', 'X-Tenant-ID']
}));
app.use(express.json());

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
  const result = await testDbConnection();
  if (result) {
    res.json({ status: "ok" });
  } else {
    res.status(500).json({
      status: "error",
      error: "DB connection failed"
    });
  }
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

// Dashboard API
registerDashboardRoutes(app);

// Bot Health API
app.use("/api/bot", createBotHealthRouter());

// Suppliers API
app.use("/api/suppliers", createSuppliersRouter());

// Offers API  
app.use("/api/offers", createOffersRouter());

// WWS Connections API
app.use("/api/wws-connections", createWwsConnectionsRouter());

// Internal API
app.use("/internal", createInternalRouter());

// Admin / Sales API
import { createAdminRouter } from "./routes/adminRoutes";
app.use("/api/admin", createAdminRouter());

// CRM Integration API (Leads -> InvenTree)
import { createCrmRouter } from "./routes/crmRoutes";
app.use("/api/crm", createCrmRouter());

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
initDb().then(() => {
  app.listen(env.port, () => {
    console.log(`Bot service listening on port ${env.port}`);
  });
}).catch(err => {
  console.error("Failed to init database", err);
  process.exit(1);
});
