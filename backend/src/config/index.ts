import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Define configuration schema with validation
const ConfigSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('localhost'),
  
  // Database configuration
  DATABASE_URL: z.string().url(),
  
  // Logging configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // CORS configuration
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  
  // Quote document configuration
  QUOTE_DOC_BRAND_LOGO_URL: z.string().url().optional(),
  
  // Security
  JWT_SECRET: z.string().optional(),
  ADMIN_API_KEY: z.string().default('dev-admin-key-change-in-production'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  // File upload
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  
  // Observability
  ENABLE_TRACING: z.coerce.boolean().default(false),
  ENABLE_METRICS: z.coerce.boolean().default(false),
  METRICS_PORT: z.coerce.number().default(9090),
});

export type Config = z.infer<typeof ConfigSchema>;

class ConfigurationError extends Error {
  constructor(message: string, public errors: z.ZodError) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function loadConfiguration(): Config {
  try {
    return ConfigSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');
      
      throw new ConfigurationError(
        `Configuration validation failed:\n${errorMessages}`,
        error
      );
    }
    throw error;
  }
}

// Singleton configuration instance
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfiguration();
  }
  return configInstance;
}

// Utility functions for common config values
export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

export function isTest(): boolean {
  return getConfig().NODE_ENV === 'test';
}

export function getAllowedOrigins(): string[] {
  return getConfig().ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
}

// Validate configuration on module load in non-test environments
if (!isTest()) {
  try {
    getConfig();
    console.log('Configuration loaded successfully');
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }
}

export default getConfig;