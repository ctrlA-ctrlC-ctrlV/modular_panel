import { z } from 'zod';
import { ProductConfigInputSchema } from './productConfig';

/**
 * Quote-related schemas for API contracts
 * Based on OpenAPI specification and data model
 */

// Line item schema for detailed cost breakdown
export const LineItemSchema = z.object({
  code: z.string().min(1, 'Line item code is required'),
  description: z.string().min(1, 'Line item description is required'),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  lineTotal: z.number().min(0, 'Line total cannot be negative')
});

// Quote estimate schema (result of calculation)
export const QuoteEstimateSchema = z.object({
  currency: z.string().min(1, 'Currency is required').regex(/^[A-Z]{3}$/, 'Currency must be a valid 3-letter ISO code'),
  subtotalExVat: z.number().min(0, 'Subtotal excluding VAT cannot be negative'),
  vatRate: z.number().min(0).max(100, 'VAT rate must be between 0 and 100'),
  totalIncVat: z.number().min(0, 'Total including VAT cannot be negative'),
  lineItems: z.array(LineItemSchema).min(1, 'At least one line item is required')
}).strict();

// Customer information schema
export const CustomerInfoSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(200, 'Customer name cannot exceed 200 characters'),
  email: z.string().email('Invalid email address').max(320, 'Email cannot exceed 320 characters').optional(),
  phone: z.string().max(50, 'Phone number cannot exceed 50 characters').optional(),
  address: z.string().max(1000, 'Address cannot exceed 1000 characters').optional()
}).strict();

// Create quote request schema
export const CreateQuoteRequestSchema = z.object({
  productConfig: ProductConfigInputSchema,
  customer: CustomerInfoSchema
}).strict();

// Quote response schema (full quote object)
export const QuoteSchema = z.object({
  quoteNumber: z.string().min(1, 'Quote number is required').regex(/^Q\d{2}-\d{6}$/, 'Invalid quote number format'),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Quote date must be in YYYY-MM-DD format'),
  customer: CustomerInfoSchema,
  estimate: QuoteEstimateSchema,
  currency: z.string().regex(/^[A-Z]{3}$/, 'Currency must be a valid 3-letter ISO code'),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  status: z.enum(['active', 'deleted'], {
    errorMap: () => ({ message: 'Status must be active or deleted' })
  })
}).strict();

// Quote summary schema (for listing)
export const QuoteSummarySchema = z.object({
  quoteNumber: z.string().min(1, 'Quote number is required'),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Quote date must be in YYYY-MM-DD format'),
  customer: z.object({
    name: z.string().min(1, 'Customer name is required')
  }),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Currency must be a valid 3-letter ISO code'),
  totalIncVat: z.number().min(0, 'Total including VAT cannot be negative'),
  status: z.enum(['active', 'deleted'])
}).strict();

// Update quote request schema
export const UpdateQuoteRequestSchema = z.object({
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  customer: z.object({
    name: z.string().min(1, 'Customer name is required').max(200, 'Customer name cannot exceed 200 characters').optional(),
    email: z.string().email('Invalid email address').max(320, 'Email cannot exceed 320 characters').optional(),
    phone: z.string().max(50, 'Phone number cannot exceed 50 characters').optional(),
    address: z.string().max(1000, 'Address cannot exceed 1000 characters').optional()
  }).strict().optional()
}).strict().refine((data) => {
  // Ensure at least one field is provided for update
  return data.notes !== undefined || data.customer !== undefined;
}, {
  message: 'At least one field (notes or customer) must be provided for update'
});

// Search quotes parameters schema
export const SearchQuotesSchema = z.object({
  quoteNumber: z.string().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be in YYYY-MM-DD format').optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be in YYYY-MM-DD format').optional(),
  customerName: z.string().max(200, 'Customer name filter cannot exceed 200 characters').optional(),
  minAmount: z.number().min(0, 'Minimum amount cannot be negative').optional(),
  maxAmount: z.number().min(0, 'Maximum amount cannot be negative').optional(),
  status: z.enum(['active', 'deleted']).optional(),
  limit: z.number().int().min(1).max(100, 'Limit cannot exceed 100').default(20),
  offset: z.number().int().min(0).default(0)
}).strict().refine((data) => {
  // Ensure fromDate is before toDate if both are provided
  if (data.fromDate && data.toDate) {
    return new Date(data.fromDate) <= new Date(data.toDate);
  }
  return true;
}, {
  message: 'From date must be before or equal to to date',
  path: ['fromDate']
}).refine((data) => {
  // Ensure minAmount is less than maxAmount if both are provided
  if (data.minAmount !== undefined && data.maxAmount !== undefined) {
    return data.minAmount <= data.maxAmount;
  }
  return true;
}, {
  message: 'Minimum amount must be less than or equal to maximum amount',
  path: ['minAmount']
});

// Audit information schema
export const AuditInfoSchema = z.object({
  createdBy: z.string().min(1, 'Created by is required'),
  updatedBy: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional()
}).strict();

// Type exports
export type LineItem = z.infer<typeof LineItemSchema>;
export type QuoteEstimate = z.infer<typeof QuoteEstimateSchema>;
export type CustomerInfo = z.infer<typeof CustomerInfoSchema>;
export type CreateQuoteRequest = z.infer<typeof CreateQuoteRequestSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type QuoteSummary = z.infer<typeof QuoteSummarySchema>;
export type UpdateQuoteRequest = z.infer<typeof UpdateQuoteRequestSchema>;
export type SearchQuotesParams = z.infer<typeof SearchQuotesSchema>;
export type AuditInfo = z.infer<typeof AuditInfoSchema>;

// Validation helpers
export function validateCreateQuoteRequest(data: unknown): CreateQuoteRequest {
  return CreateQuoteRequestSchema.parse(data);
}

export function validateUpdateQuoteRequest(data: unknown): UpdateQuoteRequest {
  return UpdateQuoteRequestSchema.parse(data);
}

export function validateSearchQuotesParams(data: unknown): SearchQuotesParams {
  return SearchQuotesSchema.parse(data);
}

export function validateQuoteEstimate(data: unknown): QuoteEstimate {
  return QuoteEstimateSchema.parse(data);
}

// Safe validation helpers
export function safeValidateCreateQuoteRequest(data: unknown): {
  success: boolean;
  data?: CreateQuoteRequest;
  error?: z.ZodError;
} {
  const result = CreateQuoteRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function safeValidateQuoteEstimate(data: unknown): {
  success: boolean;
  data?: QuoteEstimate;
  error?: z.ZodError;
} {
  const result = QuoteEstimateSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// Business rule validation
export function validateQuoteEstimateConsistency(estimate: QuoteEstimate): boolean {
  // Verify that line items sum to subtotal
  const calculatedSubtotal = estimate.lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const tolerance = 0.01; // Allow for small rounding differences
  
  if (Math.abs(calculatedSubtotal - estimate.subtotalExVat) > tolerance) {
    return false;
  }
  
  // Verify VAT calculation
  const expectedTotal = estimate.subtotalExVat * (1 + estimate.vatRate / 100);
  if (Math.abs(expectedTotal - estimate.totalIncVat) > tolerance) {
    return false;
  }
  
  return true;
}

// Helper to format quote number
export function generateQuoteNumberPattern(): RegExp {
  return /^Q\d{2}-\d{6}$/;
}

// Helper to validate quote number format
export function isValidQuoteNumber(quoteNumber: string): boolean {
  return generateQuoteNumberPattern().test(quoteNumber);
}