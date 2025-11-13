/**
 * Quotes API client service
 * Provides typed interface for quote management endpoints
 */

import { httpClient, ApiResponse, API_ENDPOINTS } from './http';
import type { Quote, CreateQuoteRequest, CustomerInfo, ProductConfigInput } from '../types/ProductConfig';

/**
 * Create a new quote with unique quote number
 * POST /api/v1/quotes
 */
export async function createQuote(
  request: CreateQuoteRequest
): Promise<ApiResponse<Quote>> {
  const response = await httpClient.post<Quote>(
    API_ENDPOINTS.QUOTES,
    request,
    {
      timeout: 15000,
    }
  );

  return response;
}

/**
 * Get a quote by quote number
 * GET /api/v1/quotes/{quoteNumber}
 */
export async function getQuote(
  quoteNumber: string
): Promise<ApiResponse<Quote>> {
  const response = await httpClient.get<Quote>(
    API_ENDPOINTS.QUOTE_BY_NUMBER(quoteNumber),
    {
      timeout: 10000,
    }
  );

  return response;
}

/**
 * Validate customer information before sending to API
 */
export function validateCustomerInfo(customer: CustomerInfo): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!customer.name || customer.name.trim().length === 0) {
    errors.push('Customer name is required');
  }

  if (customer.name && customer.name.length > 200) {
    errors.push('Customer name cannot exceed 200 characters');
  }

  // Email validation if provided
  if (customer.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      errors.push('Invalid email format');
    }
    if (customer.email.length > 320) {
      errors.push('Email cannot exceed 320 characters');
    }
  }

  // Phone validation if provided
  if (customer.phone) {
    const cleanPhone = customer.phone.replace(/[\s\-()]/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      errors.push('Phone number must be between 10 and 15 digits');
    }
    if (!/^[0-9+\s\-()]+$/.test(customer.phone)) {
      errors.push('Phone number contains invalid characters');
    }
  }

  // Address validation if provided
  if (customer.address && customer.address.length > 500) {
    errors.push('Address cannot exceed 500 characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate create quote request before sending to API
 */
export function validateCreateQuoteRequest(request: CreateQuoteRequest): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate customer info
  const customerValidation = validateCustomerInfo(request.customer);
  if (!customerValidation.valid) {
    errors.push(...customerValidation.errors);
  }

  // Validate product config exists
  if (!request.productConfig) {
    errors.push('Product configuration is required');
  } else {
    // Basic product config validation
    if (!request.productConfig.size) {
      errors.push('Product size is required');
    } else {
      if (!request.productConfig.size.widthM || request.productConfig.size.widthM <= 0) {
        errors.push('Width must be positive');
      }
      if (!request.productConfig.size.depthM || request.productConfig.size.depthM <= 0) {
        errors.push('Depth must be positive');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create quote with validation
 */
export async function createQuoteWithValidation(
  request: CreateQuoteRequest
): Promise<ApiResponse<Quote>> {
  const validation = validateCreateQuoteRequest(request);
  
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  return createQuote(request);
}

/**
 * Helper to build a create quote request from calculation result and customer info
 */
export function buildCreateQuoteRequest(
  productConfig: ProductConfigInput,
  customer: CustomerInfo
): CreateQuoteRequest {
  const sanitized: CustomerInfo = {
    name: customer.name.trim(),
  };

  if (customer.email?.trim()) {
    sanitized.email = customer.email.trim();
  }

  if (customer.phone?.trim()) {
    sanitized.phone = customer.phone.trim();
  }

  if (customer.address?.trim()) {
    sanitized.address = customer.address.trim();
  }

  return {
    productConfig,
    customer: sanitized
  };
}

/**
 * Helper to format quote date for display
 */
export function formatQuoteDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

/**
 * Helper to format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Helper to get quote status display text
 */
export function getQuoteStatusDisplay(status: Quote['status']): {
  text: string;
  variant: 'success' | 'danger' | 'warning';
} {
  switch (status) {
    case 'active':
      return { text: 'Active', variant: 'success' };
    case 'deleted':
      return { text: 'Deleted', variant: 'danger' };
    default:
      return { text: 'Unknown', variant: 'warning' };
  }
}

/**
 * Helper to check if customer info is complete
 */
export function isCustomerInfoComplete(customer: CustomerInfo): boolean {
  return Boolean(
    customer.name?.trim() &&
    customer.email?.trim() &&
    customer.phone?.trim()
  );
}

/**
 * Helper to sanitize customer input
 */
export function sanitizeCustomerInfo(customer: CustomerInfo): CustomerInfo {
  const sanitized: CustomerInfo = {
    name: customer.name.trim(),
  };

  if (customer.email?.trim()) {
    sanitized.email = customer.email.trim().toLowerCase();
  }

  if (customer.phone?.trim()) {
    sanitized.phone = customer.phone.trim();
  }

  if (customer.address?.trim()) {
    sanitized.address = customer.address.trim();
  }

  return sanitized;
}

// Export all functions for testing
export const QuotesService = {
  createQuote,
  createQuoteWithValidation,
  getQuote,
  validateCustomerInfo,
  validateCreateQuoteRequest,
  buildCreateQuoteRequest,
  formatQuoteDate,
  formatCurrency,
  getQuoteStatusDisplay,
  isCustomerInfoComplete,
  sanitizeCustomerInfo
} as const;
