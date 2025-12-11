import { Router, Request, Response } from "express";
import { getCombinedAvailabilityByOem } from "../inventory/inventoryOrchestratorService";

const router = Router();

router.get("/by-oem/:oemNumber", async (req: Request, res: Response) => {
  const { oemNumber } = req.params;
  try {
    const result = await getCombinedAvailabilityByOem(oemNumber);
    res.json(result);
  } catch (error: any) {
    console.error("Error in GET /api/bot/inventory/by-oem", error);
    res.status(500).json({
      error: "Failed to fetch inventory availability",
      details: error?.message ?? String(error)
    });
  }
});

export default router;
