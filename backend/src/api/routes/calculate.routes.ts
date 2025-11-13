import { Router } from 'express';
import { calculatePricing, calculateHealthCheck, getCurrentPricingInfo } from '../controllers/calculate.controller';
import { validateBody } from '../middleware/validation';
import { ValidatedProductConfigInputSchema } from '../../schemas/productConfig';

/**
 * Calculate API routes
 * Handles pricing calculation endpoints
 */

const router = Router();

/**
 * POST /calculate
 * Calculate pricing for a product configuration
 */
router.post(
  '/',
  validateBody(ValidatedProductConfigInputSchema),
  calculatePricing
);

/**
 * GET /calculate/health
 * Health check for calculation service
 */
router.get('/health', calculateHealthCheck);

/**
 * GET /calculate/pricing-info
 * Get current pricing configuration info
 */
router.get('/pricing-info', getCurrentPricingInfo);

export default router;