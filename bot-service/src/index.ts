import express from "express";
import cors from "cors";

import { env } from "./config/env";
import { testDbConnection } from "./services/supabaseService";
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
import botInventoryRouter from "./routes/botInventoryRoutes";
import wwsConnectionsRouter from "./routes/wwsConnectionsRoutes";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Einfacher Healthcheck – Service läuft?
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Datenbank-Healthcheck – Supabase-Verbindung funktioniert?
app.get("/health/db", async (_req, res) => {
  const result = await testDbConnection();
  if (result.ok) {
    res.json({ status: "ok" });
  } else {
    res.status(500).json({
      status: "error",
      error: result.error
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

// Inventory-Orchestrator für Bot + WWS-Connections für Dashboard
app.use("/api/bot/inventory", botInventoryRouter);
app.use("/api/wws-connections", wwsConnectionsRouter);

// Bot-Pipeline für eingehende Nachrichten
app.use("/bot/message", botMessageRouter);

// Twilio WhatsApp Webhook (receives form-encoded payloads)
app.use("/webhook/whatsapp", whatsappWebhookRouter);

// Dashboard API
registerDashboardRoutes(app);

// Internal API
app.use("/internal", createInternalRouter());

// Simulations-Endpoint für eingehende WhatsApp-Nachrichten
// Dient nur für lokale Entwicklung und Tests – hier wird noch keine echte
// WhatsApp-API angesprochen.
app.use("/simulate/whatsapp", simulateWhatsappRouter);

// Serverstart
app.listen(env.port, () => {
  console.log(`Bot service listening on port ${env.port}`);
});
