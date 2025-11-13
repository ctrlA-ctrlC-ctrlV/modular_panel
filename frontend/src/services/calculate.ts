/**
 * Calculate API client service
 * Provides typed interface for pricing calculation endpoints
 */

import { httpClient, ApiResponse, API_ENDPOINTS } from './http';
import type { ProductConfigInput, QuoteEstimate } from '../types/ProductConfig';

/**
 * Calculate pricing for a product configuration
 * POST /api/v1/calculate
 */
export async function calculatePricing(
  productConfig: ProductConfigInput
): Promise<ApiResponse<QuoteEstimate>> {
  try {
    const response = await httpClient.post<QuoteEstimate>(
      API_ENDPOINTS.CALCULATE,
      productConfig,
      {
        timeout: 15000, // Allow extra time for calculations
      }
    );

    return response;
  } catch (error) {
    // Re-throw ApiError or wrap other errors
    throw error;
  }
}

/**
 * Calculate pricing with additional request options
 */
export async function calculatePricingWithOptions(
  productConfig: ProductConfigInput,
  options?: {
    timeout?: number;
    signal?: AbortSignal;
  }
): Promise<ApiResponse<QuoteEstimate>> {
  try {
    const { timeout = 15000, signal } = options || {};
    
    const requestConfig: { timeout: number; signal?: AbortSignal } = { timeout };
    if (signal) {
      requestConfig.signal = signal;
    }
    
    const response = await httpClient.post<QuoteEstimate>(
      API_ENDPOINTS.CALCULATE,
      productConfig,
      requestConfig
    );

    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Validate product configuration before sending to API
 * This provides client-side validation to catch issues early
 */
export function validateProductConfig(config: ProductConfigInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!config.size) {
    errors.push('Size configuration is required');
  } else {
    if (!config.size.widthM || config.size.widthM <= 0) {
      errors.push('Width must be positive');
    }
    if (!config.size.depthM || config.size.depthM <= 0) {
      errors.push('Depth must be positive');
    }
  }

  // Business rule validations
  if (config.internal_wall?.finish && config.internal_wall.finish !== 'none') {
    if (!config.internal_wall.areaSqM || config.internal_wall.areaSqM <= 0) {
      errors.push('Internal wall area is required when finish is not "none"');
    }
  }

  if (config.floor?.type && config.floor.type !== 'none') {
    if (!config.floor.areaSqM || config.floor.areaSqM <= 0) {
      errors.push('Floor area is required when floor type is not "none"');
    }
  }

  // Range validations
  if (config.discount !== undefined && config.discount < 0) {
    errors.push('Discount cannot be negative');
  }

  if (config.notes && config.notes.length > 2000) {
    errors.push('Notes cannot exceed 2000 characters');
  }

  // Glazing validations
  if (config.glazing) {
    const validateGlazingItems = (items: { widthM: number; heightM: number }[] | undefined, type: string) => {
      if (items) {
        items.forEach((item, index) => {
          if (item.widthM <= 0) {
            errors.push(`${type} ${index + 1}: Width must be positive`);
          }
          if (item.heightM <= 0) {
            errors.push(`${type} ${index + 1}: Height must be positive`);
          }
        });
      }
    };

    validateGlazingItems(config.glazing.windows, 'Window');
    validateGlazingItems(config.glazing.externalDoors, 'External door');
    validateGlazingItems(config.glazing.skylights, 'Skylight');
  }

  // Extras validations
  if (config.extras?.other) {
    config.extras.other.forEach((item, index) => {
      if (!item.title || item.title.trim().length === 0) {
        errors.push(`Extra item ${index + 1}: Title is required`);
      }
      if (item.cost < 0) {
        errors.push(`Extra item ${index + 1}: Cost cannot be negative`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Helper to calculate total area from size configuration
 */
export function calculateTotalArea(size: ProductConfigInput['size']): number {
  return size.widthM * size.depthM;
}

/**
 * Helper to calculate total glazing area
 */
export function calculateGlazingArea(glazing?: ProductConfigInput['glazing']): number {
  if (!glazing) return 0;

  let totalArea = 0;

  // Windows
  if (glazing.windows) {
    totalArea += glazing.windows.reduce((sum, window) => 
      sum + (window.widthM * window.heightM), 0);
  }

  // External doors
  if (glazing.externalDoors) {
    totalArea += glazing.externalDoors.reduce((sum, door) => 
      sum + (door.widthM * door.heightM), 0);
  }

  // Skylights
  if (glazing.skylights) {
    totalArea += glazing.skylights.reduce((sum, skylight) => 
      sum + (skylight.widthM * skylight.heightM), 0);
  }

  return totalArea;
}

/**
 * Helper to estimate calculation complexity for timeout adjustment
 */
export function estimateCalculationComplexity(config: ProductConfigInput): 'low' | 'medium' | 'high' {
  let complexity = 0;

  // Base complexity
  complexity += 1;

  // Size impact
  const area = calculateTotalArea(config.size);
  if (area > 50) complexity += 1;
  if (area > 100) complexity += 1;

  // Feature complexity
  if (config.cladding?.areaSqm) complexity += 1;
  if (config.bathroom?.half || config.bathroom?.three_quarter) complexity += 1;
  if (config.electrical) complexity += 1;
  if (config.glazing) complexity += 1;
  if (config.internal_wall) complexity += 1;
  if (config.floor?.type !== 'none') complexity += 1;
  if (config.extras) complexity += 1;

  // Glazing item count
  const glazingCount = calculateGlazingItemCount(config.glazing);
  if (glazingCount > 5) complexity += 1;
  if (glazingCount > 10) complexity += 2;

  if (complexity <= 3) return 'low';
  if (complexity <= 6) return 'medium';
  return 'high';
}

/**
 * Helper to count glazing items
 */
function calculateGlazingItemCount(glazing?: ProductConfigInput['glazing']): number {
  if (!glazing) return 0;

  return (glazing.windows?.length || 0) + 
         (glazing.externalDoors?.length || 0) + 
         (glazing.skylights?.length || 0);
}

/**
 * Convenience function with automatic timeout based on complexity
 */
export async function calculatePricingAuto(
  productConfig: ProductConfigInput
): Promise<ApiResponse<QuoteEstimate>> {
  const complexity = estimateCalculationComplexity(productConfig);
  
  const timeouts = {
    low: 10000,    // 10 seconds
    medium: 15000, // 15 seconds  
    high: 20000    // 20 seconds
  };

  return calculatePricingWithOptions(productConfig, {
    timeout: timeouts[complexity]
  });
}

// Export all functions for testing
export const CalculateService = {
  calculatePricing,
  calculatePricingWithOptions,
  calculatePricingAuto,
  validateProductConfig,
  calculateTotalArea,
  calculateGlazingArea,
  estimateCalculationComplexity
} as const;