import { Router, Request, Response } from 'express';
import { getAccuracyStats, getRecentResolutions } from '../services/intelligence/accuracyTracker';
import { requireAdmin } from '../middleware/authMiddleware'; // assuming such middleware exists or will use basic auth
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/admin/accuracy/stats
 * Get comprehensive OEM resolution accuracy statistics
 */
router.get('/stats', requireAdmin, (req: Request, res: Response) => {
    try {
        const stats = getAccuracyStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        logger.error('Failed to get accuracy stats', { error: error.message });
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * GET /api/v1/admin/accuracy/recent
 * Get a list of recent OEM resolutions for auditing/debugging
 */
router.get('/recent', requireAdmin, (req: Request, res: Response) => {
    try {
        const limitText = req.query.limit as string;
        const limit = limitText ? parseInt(limitText, 10) : 50;
        
        const recent = getRecentResolutions(limit);
        res.json({
            success: true,
            data: recent
        });
    } catch (error: any) {
        logger.error('Failed to get recent resolutions', { error: error.message });
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

export default router;
