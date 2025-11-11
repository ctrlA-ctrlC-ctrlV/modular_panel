import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { getConfig, isDevelopment } from '../config/index.js';
import logger from './logger.js';

let sdk: NodeSDK | null = null;

export function initializeTracing(): NodeSDK | null {
  try {
    const config = getConfig();
    
    // Don't initialize tracing in test environment
    if (config.NODE_ENV === 'test') {
      logger.debug('Skipping tracing initialization in test environment');
      return null;
    }

    const resource = new Resource({
      [ATTR_SERVICE_NAME]: 'pricing-calculator-backend',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      environment: config.NODE_ENV,
    });

    sdk = new NodeSDK({
      resource,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable some instrumentations for cleaner traces in development
          '@opentelemetry/instrumentation-fs': {
            enabled: !isDevelopment()
          },
          // Enable HTTP and Express instrumentation
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          // Enable database instrumentation
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
          }
        }),
      ],
      // For development, we'll use console exporters
      // In production, you would configure OTLP exporters to send to your observability platform
      ...(isDevelopment() ? {
        metricReader: new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
          exportIntervalMillis: 30000, // Export every 30 seconds in development
        }),
      } : {}),
    });

    // Start the SDK
    sdk.start();
    
    logger.info('OpenTelemetry tracing initialized', {
      service: 'pricing-calculator-backend',
      environment: config.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      instrumentations: [
        'http',
        'express', 
        'pg'
      ]
    });

    return sdk;
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry tracing', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export function shutdownTracing(): Promise<void> {
  if (sdk) {
    logger.info('Shutting down OpenTelemetry SDK');
    return sdk.shutdown();
  }
  return Promise.resolve();
}

// Handle process termination
process.on('SIGTERM', async () => {
  await shutdownTracing();
});

export { sdk };