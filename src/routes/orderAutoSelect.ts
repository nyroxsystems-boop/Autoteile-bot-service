import { Router, Request, Response } from "express";
import { getOrderById } from "../services/supabaseService";
import { autoSelectOffer } from "../services/orderLogicService";

const router = Router();

router.post("/:id/auto-select", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    console.log("[OrderAutoSelect] triggered", { orderId: id });
    const order = await getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const best = await autoSelectOffer(order.id);
    console.log("[OrderAutoSelect] success", {
      orderId: id,
      recommendedOffer: {
        shopName: (best as any)?.shopName ?? (best as any)?.shop_name ?? null,
        price: best.price
      }
    });

    res.json({
      success: true,
      recommendedOffer: best
    });
  } catch (error: any) {
    console.error("Error in auto-select:", { orderId: id, error: error?.message ?? String(error) });
    res.status(500).json({
      error: "Auto-select failed",
      details: error.message
    });
  }
});

export default router;
