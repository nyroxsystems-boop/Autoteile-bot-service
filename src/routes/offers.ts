import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import * as wawi from "../services/inventreeAdapter";
import { mapOfferRowToDashboardShopOffer } from "../mappers/dashboardMappers";
import { logger } from "../utils/logger";

export function createOffersRouter(): Router {
    const router = Router();

    // Apply auth to all offer routes
    router.use(authMiddleware);

    router.get("/", async (_req: Request, res: Response) => {
        try {
            // Get all offers from WAWI system
            const offers = await wawi.listOffers();
            const mapped = offers.map(mapOfferRowToDashboardShopOffer);
            return res.status(200).json(mapped);
        } catch (err: any) {
            logger.error("Error fetching offers", { error: err.message });
            return res.status(500).json({
                error: "Failed to fetch offers",
                details: err.message
            });
        }
    });

    router.get("/:id", async (req: Request, res: Response) => {
        try {
            const offer = await wawi.getOfferById(req.params.id);
            if (!offer) {
                return res.status(404).json({ error: "Offer not found" });
            }
            const mapped = mapOfferRowToDashboardShopOffer(offer);
            return res.status(200).json(mapped);
        } catch (err: any) {
            logger.error("Error fetching offer", { error: err.message, id: req.params.id });
            return res.status(500).json({
                error: "Failed to fetch offer",
                details: err.message
            });
        }
    });

    return router;
}

export default createOffersRouter;
