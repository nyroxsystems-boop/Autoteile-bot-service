import { Router, Request, Response } from "express";
import { scrapeWwsInventoryByOem, ScrapeRequestBody } from "../services/wwsScrapeService";

const router = Router();

router.post("/wws-inventory-by-oem", async (req: Request, res: Response) => {
  const body = req.body as ScrapeRequestBody;

  if (!body?.oemNumber) {
    return res.status(400).json({ ok: false, error: "oemNumber is required" });
  }

  const cfg = body?.config || {};
  if (!cfg.loginUrl || !cfg.searchFieldSelector || !cfg.searchSubmitSelector || !cfg.resultRowSelector) {
    return res.status(400).json({
      ok: false,
      error: "config.loginUrl, searchFieldSelector, searchSubmitSelector, resultRowSelector sind erforderlich"
    });
  }

  try {
    const items = await scrapeWwsInventoryByOem(body);
    res.json({ ok: true, items });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "Scrape failed" });
  }
});

export default router;
