import { Router, Request, Response } from "express";
import { getOrderById } from "../services/supabaseService";
import { scrapeOffersForOrder } from "../services/scrapingService";

const router = Router();

/**
 * POST /api/orders/:id/scrape-offers
 *
 * Erwartet optional im Body:
 * {
 *   "oem": "OEM-NUMMER"
 * }
 *
 * Wenn keine OEM im Body angegeben ist, versucht die Route:
 * - oem aus order.oemNumber oder order.oem_data.oem zu lesen.
 */
router.post("/:id/scrape-offers", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { oem } = req.body ?? {};

  try {
    console.log("[OrderScraping] scrape-offers triggered", { orderId: id, bodyOem: oem });
    const order = await getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    let oemNumber: string | null = null;

    if (typeof oem === "string" && oem.trim().length > 0) {
      oemNumber = oem.trim();
    } else {
      // Versuche aus der Order zu lesen; oem_data ist aktuell ein beliebiges JSON-Feld
      const anyOrder: any = order as any;
      if (order.oemNumber) {
        oemNumber = order.oemNumber;
      } else if (anyOrder.oem_data && anyOrder.oem_data.oem) {
        oemNumber = anyOrder.oem_data.oem;
      }
    }

    if (!oemNumber) {
      console.log("[OrderScraping] no OEM available", { orderId: id });
      return res.status(400).json({
        error: "No OEM number provided and none found on order."
      });
    }

    console.log("[OrderScraping] using OEM", { orderId: id, oemNumber });
    const offers = await scrapeOffersForOrder(order.id, oemNumber);
    console.log("[OrderScraping] scraping completed", {
      orderId: id,
      oemNumber,
      offersCount: offers?.length ?? 0
    });

    res.json({
      orderId: order.id,
      oemNumber,
      offers
    });
  } catch (error: any) {
    console.error(`Error in POST /api/orders/${req.params.id}/scrape-offers:`, {
      orderId: id,
      error: error?.message ?? String(error)
    });
    res.status(500).json({
      error: "Failed to scrape offers",
      details: error?.message ?? String(error)
    });
  }
});

export default router;
