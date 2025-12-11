import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { PORT } from "./config";
import scrapeRoutes from "./routes/scrapeRoutes";

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/scrape", scrapeRoutes);

app.listen(PORT, () => {
  console.log(`[scraper-service] listening on port ${PORT}`);
});
