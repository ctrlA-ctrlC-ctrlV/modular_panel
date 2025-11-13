import { z } from 'zod';

/**
 * Product configuration input schema for calculating pricing
 * Based on data-model.md specification
 */

// Base size configuration
export const SizeConfigSchema = z.object({
  widthM: z.number().positive('Width must be positive'),
  depthM: z.number().positive('Depth must be positive')
});

// Cladding configuration
export const CladdingConfigSchema = z.object({
  areaSqm: z.number().min(0, 'Cladding area cannot be negative').optional()
}).optional();

// Bathroom configuration
export const BathroomConfigSchema = z.object({
  half: z.number().int().min(0, 'Half bathrooms cannot be negative').optional(),
  three_quarter: z.number().int().min(0, 'Three-quarter bathrooms cannot be negative').optional()
}).optional();

// Electrical configuration
export const ElectricalConfigSchema = z.object({
  switches: z.number().int().min(0, 'Switches cannot be negative').optional(),
  sockets: z.number().int().min(0, 'Sockets cannot be negative').optional(),
  heater: z.number().int().min(0, 'Heaters cannot be negative').optional(),
  underskink_heater: z.number().int().min(0, 'Under-sink heaters cannot be negative').optional(),
  elec_boiler: z.number().int().min(0, 'Electric boilers cannot be negative').optional()
}).optional();

// Glazing item schema (windows, doors, skylights)
export const GlazingItemSchema = z.object({
  widthM: z.number().positive('Glazing width must be positive'),
  heightM: z.number().positive('Glazing height must be positive')
});

// Glazing configuration
export const GlazingConfigSchema = z.object({
  windows: z.array(GlazingItemSchema).optional(),
  externalDoors: z.array(GlazingItemSchema).optional(),
  skylights: z.array(GlazingItemSchema).optional()
}).optional();

// Internal wall configuration
export const InternalWallConfigSchema = z.object({
  finish: z.enum(['none', 'panel', 'skim_paint'], {
    errorMap: () => ({ message: 'Internal wall finish must be none, panel, or skim_paint' })
  }),
  areaSqM: z.number().min(0, 'Internal wall area cannot be negative').optional()
}).optional();

// Floor configuration
export const FloorConfigSchema = z.object({
  type: z.enum(['none', 'wooden', 'tile'], {
    errorMap: () => ({ message: 'Floor type must be none, wooden, or tile' })
  }),
  areaSqM: z.number().min(0, 'Floor area cannot be negative')
}).optional();

// Delivery configuration
export const DeliveryConfigSchema = z.object({
  distanceKm: z.number().min(0, 'Delivery distance cannot be negative').optional(),
  cost: z.number().min(0, 'Delivery cost cannot be negative').optional()
}).optional();

// Extra item schema
export const ExtraItemSchema = z.object({
  title: z.string().min(1, 'Extra item title is required'),
  cost: z.number().min(0, 'Extra item cost cannot be negative')
});

// Extras configuration
export const ExtrasConfigSchema = z.object({
  esp_insulation: z.number().min(0, 'ESP insulation area cannot be negative').optional(),
  render: z.number().min(0, 'Render area cannot be negative').optional(),
  steel_door: z.number().int().min(0, 'Steel door count cannot be negative').optional(),
  concrete_foundation: z.number().min(0, 'Concrete foundation area cannot be negative').optional(),
  other: z.array(ExtraItemSchema).optional()
}).optional();

// Permitted development flags
export const PermittedDevelopmentFlagSchema = z.object({
  code: z.string().min(1, 'Flag code is required'),
  label: z.string().min(1, 'Flag label is required')
});

// Main product configuration input schema
export const ProductConfigInputSchema = z.object({
  size: SizeConfigSchema,
  cladding: CladdingConfigSchema,
  bathroom: BathroomConfigSchema,
  electrical: ElectricalConfigSchema,
  internal_doors: z.number().int().min(0, 'Internal doors cannot be negative').optional(),
  internal_wall: InternalWallConfigSchema,
  heaters: z.number().int().min(0, 'Heaters cannot be negative').optional(),
  glazing: GlazingConfigSchema,
  floor: FloorConfigSchema,
  delivery: DeliveryConfigSchema,
  extras: ExtrasConfigSchema,
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  permittedDevelopmentFlags: z.array(PermittedDevelopmentFlagSchema).optional()
}).strict();

// Custom validation for business rules
export const ValidatedProductConfigInputSchema = ProductConfigInputSchema.superRefine((data, ctx) => {
  // Rule: If internal_wall finish is not "none", areaSqM is required
  if (data.internal_wall?.finish && data.internal_wall.finish !== 'none') {
    if (!data.internal_wall.areaSqM || data.internal_wall.areaSqM <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Internal wall area is required when finish is not "none"',
        path: ['internal_wall', 'areaSqM']
      });
    }
  }

  // Rule: If floor type is not "none", areaSqM should be provided
  if (data.floor?.type && data.floor.type !== 'none') {
    if (!data.floor.areaSqM || data.floor.areaSqM <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Floor area is required when floor type is not "none"',
        path: ['floor', 'areaSqM']
      });
    }
  }

  // Rule: If half bathroom > 0, underskink_heater defaults to included
  if (data.bathroom?.half && data.bathroom.half > 0) {
    // This is handled in the calculation logic, not validation
  }

  // Rule: If three_quarter bathroom > 0, elec_boiler defaults to included
  if (data.bathroom?.three_quarter && data.bathroom.three_quarter > 0) {
    // This is handled in the calculation logic, not validation
  }
});

// Type exports
export type ProductConfigInput = z.infer<typeof ProductConfigInputSchema>;
export type ValidatedProductConfigInput = z.infer<typeof ValidatedProductConfigInputSchema>;
export type SizeConfig = z.infer<typeof SizeConfigSchema>;
export type CladdingConfig = z.infer<typeof CladdingConfigSchema>;
export type BathroomConfig = z.infer<typeof BathroomConfigSchema>;
export type ElectricalConfig = z.infer<typeof ElectricalConfigSchema>;
export type GlazingItem = z.infer<typeof GlazingItemSchema>;
export type GlazingConfig = z.infer<typeof GlazingConfigSchema>;
export type InternalWallConfig = z.infer<typeof InternalWallConfigSchema>;
export type FloorConfig = z.infer<typeof FloorConfigSchema>;
export type DeliveryConfig = z.infer<typeof DeliveryConfigSchema>;
export type ExtraItem = z.infer<typeof ExtraItemSchema>;
export type ExtrasConfig = z.infer<typeof ExtrasConfigSchema>;
export type PermittedDevelopmentFlag = z.infer<typeof PermittedDevelopmentFlagSchema>;

// Helper function to validate product config input
export function validateProductConfigInput(data: unknown): ProductConfigInput {
  return ValidatedProductConfigInputSchema.parse(data);
}

// Helper function to safely validate product config input
export function safeValidateProductConfigInput(data: unknown): {
  success: boolean;
  data?: ProductConfigInput;
  error?: z.ZodError;
} {
  const result = ValidatedProductConfigInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}