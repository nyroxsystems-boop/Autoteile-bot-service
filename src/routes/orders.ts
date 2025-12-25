import { Router, Request, Response } from "express";
import { insertOrder, listOrders, getOrderById } from "../services/supabaseService";

const router = Router();

/**
 * GET /api/orders
 * Liefert eine Liste der letzten Bestellfälle.
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const orders = await listOrders();
    res.json(orders);
  } catch (error: any) {
    console.error("Error in GET /api/orders:", error);
    res.status(500).json({
      error: "Failed to list orders",
      details: error?.message ?? String(error)
    });
  }
});

/**
 * GET /api/orders/:id
 * Liefert Details zu einer einzelnen Order.
 */
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const order = await getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error: any) {
    console.error(`Error in GET /api/orders/${id}:`, error);
    res.status(500).json({
      error: "Failed to fetch order",
      details: error?.message ?? String(error)
    });
  }
});

/**
 * POST /api/orders
 * Legt eine neue Order an.
 *
 * Erwarteter Request-Body (JSON):
 * {
 *   "customerName": "optional string",
 *   "customerContact": "optional string",
 *   "requestedPartName": "string (required)",
 *   "vehicleId": "optional string"
 * }
 */
router.post("/", async (req: Request, res: Response) => {
  const { customerName, customerContact, requestedPartName, vehicleId } = req.body ?? {};

  if (!requestedPartName || typeof requestedPartName !== "string") {
    return res.status(400).json({
      error: "requestedPartName is required and must be a string"
    });
  }

  try {
    const order = await insertOrder({
      customerName: customerName ?? null,
      customerContact: customerContact ?? null,
      requestedPartName,
      vehicleId: vehicleId ?? null
    });

    res.status(201).json(order);
  } catch (error: any) {
    console.error("Error in POST /api/orders:", error);
    res.status(500).json({
      error: "Failed to create order",
      details: error?.message ?? String(error)
    });
  }
});

export default router;
