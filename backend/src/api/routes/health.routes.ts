import { Router } from 'express';
import { getHealth, getLiveness, getReadiness } from '../controllers/health.controller.js';
import { metricsMiddleware } from '../../instrumentation/metrics.js';

const router = Router();

// Apply metrics middleware to all health routes
router.use(metricsMiddleware());

/**
 * Health check routes
 * 
 * These endpoints are typically used by:
 * - Load balancers for health checks
 * - Kubernetes liveness/readiness probes
 * - Monitoring systems
 * - Operations teams for status verification
 */

/**
 * @route GET /api/v1/health
 * @desc Comprehensive health check with database and system status
 * @access Public
 * @returns {object} 200/503 - Health status with detailed information
 */
router.get('/', getHealth);

/**
 * @route GET /api/v1/health/live
 * @desc Liveness probe - checks if application is alive
 * @access Public
 * @returns {object} 200 - Simple alive status
 */
router.get('/live', getLiveness);

/**
 * @route GET /api/v1/health/ready
 * @desc Readiness probe - checks if application is ready to serve traffic
 * @access Public
 * @returns {object} 200/503 - Readiness status with dependency checks
 */
router.get('/ready', getReadiness);

export default router;