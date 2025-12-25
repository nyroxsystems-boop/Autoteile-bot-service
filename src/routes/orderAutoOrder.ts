import { Router, Request, Response } from "express";
import { getOrderById, listShopOffersByOrderId } from "../services/supabaseService";
import { autoOrder, selectBestOffer } from "../services/orderLogicService";

const router = Router();

router.post("/:id/auto-order", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    console.log("[OrderAutoOrder] triggered", { orderId: id });
    const order = await getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Angebote laden
    const offers = await listShopOffersByOrderId(order.id);
    console.log("[OrderAutoOrder] offers loaded", { orderId: id, offersCount: offers.length });
    if (offers.length === 0) {
      return res.status(400).json({ error: "No offers available" });
    }

    const best = selectBestOffer(offers);
    if (!best) {
      return res.status(400).json({ error: "Could not determine best offer" });
    }
    console.log("[OrderAutoOrder] selecting offer", {
      orderId: id,
      offer: {
        shopName: (best as any)?.shopName ?? (best as any)?.shop_name ?? null,
        price: best.price
      }
    });

    const result = await autoOrder(order.id, best);
    console.log("[OrderAutoOrder] success", {
      orderId: id,
      confirmation: result.confirmation,
      status: "ordered"
    });

    res.json({
      success: true,
      confirmation: result.confirmation,
      orderedFrom: result.orderedFrom,
      price: result.price
    });
  } catch (error: any) {
    console.error("Error in auto-order:", { orderId: id, error: error?.message ?? String(error) });
    res.status(500).json({
      error: "Auto-order failed",
      details: error.message
    });
  }
});

export default router;
