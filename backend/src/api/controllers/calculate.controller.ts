import { Request, Response, NextFunction } from 'express';
import { validateProductConfigInput, ProductConfigInput } from '../../schemas/productConfig';
import { QuoteEstimate, validateQuoteEstimate } from '../../schemas/quote';
import { createCalculationService, CalculationError, InvalidConfigurationError } from '../../modules/calculation/service';
import { createPricingRepository, CurrentPricingConfigNotFoundError, PricingConfigError } from '../../modules/pricing/repo';
import { getPool } from '../../db/pool';
import logger from '../../instrumentation/logger';

/**
 * Controller for pricing calculation endpoints
 */

export interface CalculateRequest extends Request {
  body: unknown;
}

interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
  pricingConfig?: {
    id: string;
    label: string;
    currency: string;
    validFrom: string;
  };
}

interface PricingInfoResponse {
  id: string;
  label: string;
  currency: string;
  validFrom: string;
  validTo: string | null;
  vatRate: number;
  lastUpdated: string;
}

/**
 * POST /api/v1/calculate
 * Calculate pricing for a product configuration without saving
 */
export async function calculatePricing(
  req: CalculateRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const startTime = Date.now();
    
    // Log request start
    logger.info('Calculate pricing request started', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Validate input
    let productConfig: ProductConfigInput;
    try {
      productConfig = validateProductConfigInput(req.body);
    } catch (error) {
      logger.warn('Invalid product configuration in calculate request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body
      });
      const errorResponse: ErrorResponse = {
        error: 'Invalid product configuration',
        message: error instanceof Error ? error.message : 'Validation failed',
        details: error
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Get current pricing configuration
    const pricingRepo = createPricingRepository(getPool());
    let currentPricing;
    try {
      currentPricing = await pricingRepo.getCurrentPricingConfig();
    } catch (error) {
      if (error instanceof CurrentPricingConfigNotFoundError) {
        logger.error('No current pricing configuration available', { error: error.message });
        const errorResponse: ErrorResponse = {
          error: 'Pricing configuration not available',
          message: 'No current pricing configuration found. Please contact an administrator.'
        };
        res.status(500).json(errorResponse);
        return;
      }
      if (error instanceof PricingConfigError) {
        logger.error('Failed to fetch pricing configuration', { 
          error: error.message,
          code: error.code
        });
        const errorResponse: ErrorResponse = {
          error: 'Pricing configuration error',
          message: 'Failed to fetch current pricing configuration'
        };
        res.status(500).json(errorResponse);
        return;
      }
      throw error; // Let error handler deal with unexpected errors
    }

    // Perform calculation
    const calculationService = createCalculationService();
    let estimate: QuoteEstimate;
    try {
      estimate = calculationService.calculate(productConfig, currentPricing);
    } catch (error) {
      if (error instanceof InvalidConfigurationError) {
        logger.warn('Invalid configuration for calculation', {
          error: error.message,
          productConfig,
          pricingConfigId: currentPricing.id
        });
        const errorResponse: ErrorResponse = {
          error: 'Invalid configuration',
          message: error.message
        };
        res.status(400).json(errorResponse);
        return;
      }
      if (error instanceof CalculationError) {
        logger.error('Calculation service error', {
          error: error.message,
          code: error.code,
          productConfig,
          pricingConfigId: currentPricing.id
        });
        const errorResponse: ErrorResponse = {
          error: 'Calculation error',
          message: 'Failed to calculate pricing. Please try again or contact support.'
        };
        res.status(500).json(errorResponse);
        return;
      }
      throw error; // Let error handler deal with unexpected errors
    }

    // Validate the calculation result
    try {
      validateQuoteEstimate(estimate);
    } catch (error) {
      logger.error('Invalid calculation result', {
        error: error instanceof Error ? error.message : 'Unknown error',
        estimate,
        productConfig,
        pricingConfigId: currentPricing.id
      });
      const errorResponse: ErrorResponse = {
        error: 'Invalid calculation result',
        message: 'The calculation produced invalid results. Please contact support.'
      };
      res.status(500).json(errorResponse);
      return;
    }

    // Calculate performance metrics
    const duration = Date.now() - startTime;
    
    // Log successful calculation
    logger.info('Calculate pricing request completed successfully', {
      duration,
      productConfigSize: `${productConfig.size.widthM}m x ${productConfig.size.depthM}m`,
      subtotalExVat: estimate.subtotalExVat,
      totalIncVat: estimate.totalIncVat,
      currency: estimate.currency,
      lineItemCount: estimate.lineItems.length,
      pricingConfigId: currentPricing.id,
      pricingConfigLabel: currentPricing.label
    });

    // Performance warning if calculation takes too long
    if (duration > 2000) {
      logger.warn('Slow calculation performance', {
        duration,
        productConfig,
        pricingConfigId: currentPricing.id
      });
    }

    // Return successful result
    res.status(200).json(estimate);
  } catch (error) {
    // Log unexpected errors and let error handler deal with them
    logger.error('Unexpected error in calculate pricing', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
}

/**
 * Health check for calculation service
 * GET /api/v1/calculate/health
 */
export async function calculateHealthCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check if pricing configuration is available
    const pricingRepo = createPricingRepository(getPool());
    const hasConfig = await pricingRepo.hasCurrentPricingConfig();
    
    if (!hasConfig) {
      res.status(503).json({
        status: 'unhealthy',
        message: 'No current pricing configuration available',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Test calculation service with minimal configuration
    const testConfig: ProductConfigInput = {
      size: { widthM: 1, depthM: 1 }
    };

    const currentPricing = await pricingRepo.getCurrentPricingConfig();
    const calculationService = createCalculationService();
    const testResult = calculationService.calculate(testConfig, currentPricing);

    // Verify result is valid
    validateQuoteEstimate(testResult);

    res.status(200).json({
      status: 'healthy',
      message: 'Calculation service is operational',
      timestamp: new Date().toISOString(),
      pricingConfig: {
        id: currentPricing.id,
        label: currentPricing.label,
        currency: currentPricing.currency,
        validFrom: currentPricing.validFrom.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    logger.error('Calculate health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
}

/**
 * Get current pricing configuration info
 * GET /api/v1/calculate/pricing-info
 */
export async function getCurrentPricingInfo(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pricingRepo = createPricingRepository(getPool());
    const currentPricing = await pricingRepo.getCurrentPricingConfig();

    res.status(200).json({
      id: currentPricing.id,
      label: currentPricing.label,
      currency: currentPricing.currency,
      validFrom: currentPricing.validFrom.toISOString().split('T')[0],
      validTo: currentPricing.validTo?.toISOString().split('T')[0] || null,
      vatRate: currentPricing.taxes.vatPct,
      lastUpdated: currentPricing.updatedAt.toISOString()
    });
  } catch (error) {
    if (error instanceof CurrentPricingConfigNotFoundError) {
      res.status(404).json({
        error: 'No current pricing configuration found',
        message: 'No active pricing configuration is currently available'
      });
      return;
    }
    next(error);
  }
}