// Instrumentation module exports
// This module handles observability concerns: logging, metrics, and tracing

import logger from './logger.js';

// Lazy loaded modules
let metrics: any = null;
let tracing: any = null;

async function loadMetrics() {
  if (metrics) return metrics;
  try {
    metrics = await import('./metrics.js');
    return metrics;
  } catch (error) {
    logger.debug('Metrics module not available, skipping metrics initialization');
    return null;
  }
}

async function loadTracing() {
  if (tracing) return tracing;
  try {
    tracing = await import('./tracing.js');
    return tracing;
  } catch (error) {
    logger.debug('Tracing module not available, skipping tracing initialization');
    return null;
  }
}

export async function initializeObservability(): Promise<void> {
  logger.info('Initializing observability stack');
  
  // Initialize tracing first (should be done before other instrumentations)
  const tracingModule = await loadTracing();
  if (tracingModule?.initializeTracing) {
    tracingModule.initializeTracing();
  }
  
  // Initialize metrics collection
  const metricsModule = await loadMetrics();
  if (metricsModule?.initializeMetrics) {
    metricsModule.initializeMetrics();
  }
  
  logger.info('Observability stack initialized');
}

export async function shutdownObservability(): Promise<void> {
  logger.info('Shutting down observability stack');
  
  const tracingModule = await loadTracing();
  if (tracingModule?.shutdownTracing) {
    await tracingModule.shutdownTracing();
  }
  
  logger.info('Observability stack shut down');
}

export async function getMetricsMiddleware() {
  const metricsModule = await loadMetrics();
  return metricsModule?.metricsMiddleware || ((req: any, res: any, next: any) => next());
}

export async function getMetrics(): Promise<string> {
  const metricsModule = await loadMetrics();
  if (metricsModule?.getMetrics) {
    return metricsModule.getMetrics();
  }
  return '# Metrics not available\n';
}

// Re-export logger
export { logger };
export default logger;