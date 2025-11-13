import { ProductConfigInput } from '../../schemas/productConfig';
import { QuoteEstimate, LineItem } from '../../schemas/quote';
import { PriceConfig } from '../pricing/repo';

/**
 * Pure calculation service for pricing computations
 * No side effects, only mathematical operations
 */

// Calculation result with detailed breakdown
export interface CalculationBreakdown {
  baseArea: number;
  baseAmount: number;
  claddingAmount: number;
  bathroomAmount: number;
  electricalAmount: number;
  internalDoorAmount: number;
  internalWallAmount: number;
  glazingAmount: number;
  floorAmount: number;
  deliveryAmount: number;
  extrasAmount: number;
  discountAmount: number;
  subtotalExVat: number;
  vatAmount: number;
  totalIncVat: number;
}

// Error classes
export class CalculationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CalculationError';
  }
}

export class InvalidConfigurationError extends CalculationError {
  constructor(message: string) {
    super(`Invalid configuration: ${message}`, 'INVALID_CONFIG');
  }
}

/**
 * Main calculation service class
 */
export class CalculationService {
  /**
   * Calculate pricing estimate for a product configuration
   * @param productConfig - Product configuration input
   * @param priceConfig - Current pricing configuration
   * @returns Quote estimate with line items
   */
  calculate(productConfig: ProductConfigInput, priceConfig: PriceConfig): QuoteEstimate {
    try {
      // Validate inputs
      this.validateInputs(productConfig, priceConfig);

      // Calculate detailed breakdown
      const breakdown = this.calculateBreakdown(productConfig, priceConfig);

      // Generate line items
      const lineItems = this.generateLineItems(productConfig, priceConfig, breakdown);

      // Build quote estimate
      const estimate: QuoteEstimate = {
        currency: priceConfig.currency,
        subtotalExVat: breakdown.subtotalExVat,
        vatRate: priceConfig.taxes.vatPct,
        totalIncVat: breakdown.totalIncVat,
        lineItems
      };

      return estimate;
    } catch (error) {
      if (error instanceof CalculationError) {
        throw error;
      }
      throw new CalculationError(
        `Calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CALCULATION_FAILED'
      );
    }
  }

  /**
   * Calculate detailed breakdown of all cost components
   * @param productConfig - Product configuration
   * @param priceConfig - Pricing configuration
   * @returns Detailed calculation breakdown
   */
  calculateBreakdown(productConfig: ProductConfigInput, priceConfig: PriceConfig): CalculationBreakdown {
    // Base area calculation
    const baseArea = productConfig.size.widthM * productConfig.size.depthM;

    // Base amount calculation (base rate per m² + fixed charge)
    const baseAmount = (baseArea * priceConfig.base.baseRatePerM2) + priceConfig.base.fixedCharge;

    // Cladding calculation
    const claddingArea = productConfig.cladding?.areaSqm ?? 0;
    const claddingAmount = claddingArea * priceConfig.cladding.ratePerM2;

    // Bathroom calculation
    const halfBathrooms = productConfig.bathroom?.half ?? 0;
    const threeQuarterBathrooms = productConfig.bathroom?.three_quarter ?? 0;
    const bathroomAmount = 
      (halfBathrooms * priceConfig.bathroom.half) +
      (threeQuarterBathrooms * priceConfig.bathroom.threeQuarter);

    // Electrical calculation
    const electrical = productConfig.electrical ?? {};
    const switches = electrical.switches ?? 0;
    const sockets = electrical.sockets ?? 0;
    const heaters = electrical.heater ?? 0;

    // Auto-include electrical items for bathrooms as per business rules
    const autoUndersinkHeater = halfBathrooms > 0 ? halfBathrooms : 0;
    const autoElecBoiler = threeQuarterBathrooms > 0 ? threeQuarterBathrooms : 0;
    const undersinkHeater = electrical.underskink_heater ?? autoUndersinkHeater;
    const elecBoiler = electrical.elec_boiler ?? autoElecBoiler;

    const electricalAmount = 
      (switches * priceConfig.electrical.switch) +
      (sockets * priceConfig.electrical.doubleSocket) +
      (heaters * priceConfig.electrical.heater) +
      (undersinkHeater * priceConfig.electrical.heater) + // Assuming same rate
      (elecBoiler * priceConfig.electrical.heater); // Assuming same rate

    // Internal doors calculation
    const internalDoors = productConfig.internal_doors ?? 0;
    const internalDoorAmount = internalDoors * priceConfig.internal.internalDoorCharge;

    // Internal wall calculation
    const internalWallConfig = productConfig.internal_wall;
    let internalWallAmount = 0;
    if (internalWallConfig?.finish && internalWallConfig.finish !== 'none') {
      const wallArea = internalWallConfig.areaSqM ?? 0;
      const ratePerM2 = priceConfig.internal.internalWall[internalWallConfig.finish];
      internalWallAmount = wallArea * ratePerM2;
    }

    // Glazing calculation
    const glazingAmount = this.calculateGlazing(productConfig.glazing, priceConfig);

    // Floor calculation
    const floorConfig = productConfig.floor;
    let floorAmount = 0;
    if (floorConfig?.type && floorConfig.type !== 'none') {
      const floorArea = floorConfig.areaSqM ?? 0;
      const ratePerM2 = priceConfig.flooring[floorConfig.type];
      floorAmount = floorArea * ratePerM2;
    }

    // Delivery calculation
    const deliveryAmount = this.calculateDelivery(productConfig.delivery, priceConfig);

    // Extras calculation
    const extrasAmount = this.calculateExtras(productConfig.extras, priceConfig);

    // Discount application
    const discountAmount = productConfig.discount ?? 0;

    // Subtotal calculation (before VAT)
    const subtotalBeforeDiscount = 
      baseAmount +
      claddingAmount +
      bathroomAmount +
      electricalAmount +
      internalDoorAmount +
      internalWallAmount +
      glazingAmount +
      floorAmount +
      deliveryAmount +
      extrasAmount;

    const subtotalExVat = Math.max(0, subtotalBeforeDiscount - discountAmount);

    // VAT calculation
    const vatRate = priceConfig.taxes.vatPct;
    const vatAmount = subtotalExVat * (vatRate / 100);
    const totalIncVat = subtotalExVat + vatAmount;

    return {
      baseArea,
      baseAmount,
      claddingAmount,
      bathroomAmount,
      electricalAmount,
      internalDoorAmount,
      internalWallAmount,
      glazingAmount,
      floorAmount,
      deliveryAmount,
      extrasAmount,
      discountAmount,
      subtotalExVat,
      vatAmount,
      totalIncVat
    };
  }

  /**
   * Calculate glazing costs (windows, external doors, skylights)
   */
  private calculateGlazing(glazingConfig: ProductConfigInput['glazing'], priceConfig: PriceConfig): number {
    if (!glazingConfig) return 0;

    let total = 0;

    // Windows
    if (glazingConfig.windows) {
      for (const window of glazingConfig.windows) {
        const area = window.widthM * window.heightM;
        total += priceConfig.glazing.window.charge + (area * priceConfig.glazing.window.ratePerM2);
      }
    }

    // External doors
    if (glazingConfig.externalDoors) {
      for (const door of glazingConfig.externalDoors) {
        const area = door.widthM * door.heightM;
        total += priceConfig.glazing.externalDoor.charge + (area * priceConfig.glazing.externalDoor.ratePerM2);
      }
    }

    // Skylights
    if (glazingConfig.skylights) {
      for (const skylight of glazingConfig.skylights) {
        const area = skylight.widthM * skylight.heightM;
        total += priceConfig.glazing.skylight.charge + (area * priceConfig.glazing.skylight.ratePerM2);
      }
    }

    return total;
  }

  /**
   * Calculate delivery costs
   */
  private calculateDelivery(deliveryConfig: ProductConfigInput['delivery'], priceConfig: PriceConfig): number {
    if (!deliveryConfig) return 0;

    // If delivery cost is explicitly set, use that
    if (deliveryConfig.cost !== undefined) {
      return deliveryConfig.cost;
    }

    // Calculate based on distance
    const distance = deliveryConfig.distanceKm ?? 0;
    const freeKm = priceConfig.delivery.freeKm;
    const chargeableDistance = Math.max(0, distance - freeKm);
    
    return chargeableDistance * priceConfig.delivery.ratePerKm;
  }

  /**
   * Calculate extras costs
   */
  private calculateExtras(extrasConfig: ProductConfigInput['extras'], priceConfig: PriceConfig): number {
    if (!extrasConfig) return 0;

    let total = 0;

    // ESP insulation
    if (extrasConfig.esp_insulation) {
      total += extrasConfig.esp_insulation * priceConfig.extras.ESPInstallRatePerM2;
    }

    // Render
    if (extrasConfig.render) {
      total += extrasConfig.render * priceConfig.extras.renderRatePerM2;
    }

    // Steel door
    if (extrasConfig.steel_door) {
      total += extrasConfig.steel_door * priceConfig.extras.steelDoorCharge;
    }

    // Concrete foundation (assuming fixed rate per m²)
    // Note: This may need pricing config extension
    if (extrasConfig.concrete_foundation) {
      // For now, use base rate as fallback
      total += extrasConfig.concrete_foundation * 50; // £50/m² placeholder
    }

    // Other extras
    if (extrasConfig.other) {
      for (const extra of extrasConfig.other) {
        total += extra.cost;
      }
    }

    return total;
  }

  /**
   * Generate detailed line items for the quote
   */
  private generateLineItems(
    productConfig: ProductConfigInput, 
    priceConfig: PriceConfig, 
    breakdown: CalculationBreakdown
  ): LineItem[] {
    const lineItems: LineItem[] = [];

    // Base construction
    if (breakdown.baseAmount > 0) {
      lineItems.push({
        code: 'BASE',
        description: `Base construction (${breakdown.baseArea.toFixed(2)}m² @ £${priceConfig.base.baseRatePerM2}/m² + £${priceConfig.base.fixedCharge} fixed)`,
        quantity: breakdown.baseArea,
        unitPrice: priceConfig.base.baseRatePerM2,
        lineTotal: breakdown.baseAmount
      });
    }

    // Cladding
    if (breakdown.claddingAmount > 0) {
      const area = productConfig.cladding?.areaSqm ?? 0;
      lineItems.push({
        code: 'CLADDING',
        description: `External cladding (${area.toFixed(2)}m²)`,
        quantity: area,
        unitPrice: priceConfig.cladding.ratePerM2,
        lineTotal: breakdown.claddingAmount
      });
    }

    // Bathrooms
    if (breakdown.bathroomAmount > 0) {
      const half = productConfig.bathroom?.half ?? 0;
      const threeQuarter = productConfig.bathroom?.three_quarter ?? 0;
      
      if (half > 0) {
        lineItems.push({
          code: 'BATHROOM_HALF',
          description: `Half bathroom installation`,
          quantity: half,
          unitPrice: priceConfig.bathroom.half,
          lineTotal: half * priceConfig.bathroom.half
        });
      }
      
      if (threeQuarter > 0) {
        lineItems.push({
          code: 'BATHROOM_3Q',
          description: `Three-quarter bathroom installation`,
          quantity: threeQuarter,
          unitPrice: priceConfig.bathroom.threeQuarter,
          lineTotal: threeQuarter * priceConfig.bathroom.threeQuarter
        });
      }
    }

    // Electrical components
    if (breakdown.electricalAmount > 0) {
      this.addElectricalLineItems(lineItems, productConfig, priceConfig);
    }

    // Internal doors
    if (breakdown.internalDoorAmount > 0) {
      const doors = productConfig.internal_doors ?? 0;
      lineItems.push({
        code: 'INTERNAL_DOORS',
        description: `Internal doors`,
        quantity: doors,
        unitPrice: priceConfig.internal.internalDoorCharge,
        lineTotal: breakdown.internalDoorAmount
      });
    }

    // Internal walls
    if (breakdown.internalWallAmount > 0) {
      const config = productConfig.internal_wall;
      if (config?.finish && config.finish !== 'none') {
        const area = config.areaSqM ?? 0;
        lineItems.push({
          code: 'INTERNAL_WALL',
          description: `Internal wall finish (${config.finish}, ${area.toFixed(2)}m²)`,
          quantity: area,
          unitPrice: priceConfig.internal.internalWall[config.finish],
          lineTotal: breakdown.internalWallAmount
        });
      }
    }

    // Glazing items
    if (breakdown.glazingAmount > 0) {
      this.addGlazingLineItems(lineItems, productConfig, priceConfig);
    }

    // Flooring
    if (breakdown.floorAmount > 0) {
      const config = productConfig.floor;
      if (config?.type && config.type !== 'none') {
        const area = config.areaSqM ?? 0;
        lineItems.push({
          code: 'FLOORING',
          description: `${config.type} flooring (${area.toFixed(2)}m²)`,
          quantity: area,
          unitPrice: priceConfig.flooring[config.type],
          lineTotal: breakdown.floorAmount
        });
      }
    }

    // Delivery
    if (breakdown.deliveryAmount > 0) {
      const distance = productConfig.delivery?.distanceKm ?? 0;
      lineItems.push({
        code: 'DELIVERY',
        description: `Delivery (${distance}km)`,
        quantity: 1,
        unitPrice: breakdown.deliveryAmount,
        lineTotal: breakdown.deliveryAmount
      });
    }

    // Extras
    if (breakdown.extrasAmount > 0) {
      this.addExtrasLineItems(lineItems, productConfig, priceConfig);
    }

    // Discount
    if (breakdown.discountAmount > 0) {
      lineItems.push({
        code: 'DISCOUNT',
        description: `Discount applied`,
        quantity: 1,
        unitPrice: -breakdown.discountAmount,
        lineTotal: -breakdown.discountAmount
      });
    }

    return lineItems;
  }

  /**
   * Add electrical line items
   */
  private addElectricalLineItems(lineItems: LineItem[], productConfig: ProductConfigInput, priceConfig: PriceConfig): void {
    const electrical = productConfig.electrical ?? {};
    
    if (electrical.switches) {
      lineItems.push({
        code: 'ELEC_SWITCH',
        description: `Electrical switches`,
        quantity: electrical.switches,
        unitPrice: priceConfig.electrical.switch,
        lineTotal: electrical.switches * priceConfig.electrical.switch
      });
    }

    if (electrical.sockets) {
      lineItems.push({
        code: 'ELEC_SOCKET',
        description: `Double sockets`,
        quantity: electrical.sockets,
        unitPrice: priceConfig.electrical.doubleSocket,
        lineTotal: electrical.sockets * priceConfig.electrical.doubleSocket
      });
    }

    if (electrical.heater) {
      lineItems.push({
        code: 'ELEC_HEATER',
        description: `Electric heaters`,
        quantity: electrical.heater,
        unitPrice: priceConfig.electrical.heater,
        lineTotal: electrical.heater * priceConfig.electrical.heater
      });
    }
  }

  /**
   * Add glazing line items
   */
  private addGlazingLineItems(lineItems: LineItem[], productConfig: ProductConfigInput, priceConfig: PriceConfig): void {
    const glazing = productConfig.glazing;
    if (!glazing) return;

    // Windows
    glazing.windows?.forEach((window, index) => {
      const area = window.widthM * window.heightM;
      const total = priceConfig.glazing.window.charge + (area * priceConfig.glazing.window.ratePerM2);
      lineItems.push({
        code: `WINDOW_${index + 1}`,
        description: `Window ${index + 1} (${window.widthM}m × ${window.heightM}m)`,
        quantity: 1,
        unitPrice: total,
        lineTotal: total
      });
    });

    // External doors
    glazing.externalDoors?.forEach((door, index) => {
      const area = door.widthM * door.heightM;
      const total = priceConfig.glazing.externalDoor.charge + (area * priceConfig.glazing.externalDoor.ratePerM2);
      lineItems.push({
        code: `EXT_DOOR_${index + 1}`,
        description: `External door ${index + 1} (${door.widthM}m × ${door.heightM}m)`,
        quantity: 1,
        unitPrice: total,
        lineTotal: total
      });
    });

    // Skylights
    glazing.skylights?.forEach((skylight, index) => {
      const area = skylight.widthM * skylight.heightM;
      const total = priceConfig.glazing.skylight.charge + (area * priceConfig.glazing.skylight.ratePerM2);
      lineItems.push({
        code: `SKYLIGHT_${index + 1}`,
        description: `Skylight ${index + 1} (${skylight.widthM}m × ${skylight.heightM}m)`,
        quantity: 1,
        unitPrice: total,
        lineTotal: total
      });
    });
  }

  /**
   * Add extras line items
   */
  private addExtrasLineItems(lineItems: LineItem[], productConfig: ProductConfigInput, priceConfig: PriceConfig): void {
    const extras = productConfig.extras;
    if (!extras) return;

    if (extras.esp_insulation) {
      lineItems.push({
        code: 'EXTRA_ESP',
        description: `ESP insulation (${extras.esp_insulation}m²)`,
        quantity: extras.esp_insulation,
        unitPrice: priceConfig.extras.ESPInstallRatePerM2,
        lineTotal: extras.esp_insulation * priceConfig.extras.ESPInstallRatePerM2
      });
    }

    if (extras.render) {
      lineItems.push({
        code: 'EXTRA_RENDER',
        description: `Exterior render (${extras.render}m²)`,
        quantity: extras.render,
        unitPrice: priceConfig.extras.renderRatePerM2,
        lineTotal: extras.render * priceConfig.extras.renderRatePerM2
      });
    }

    if (extras.steel_door) {
      lineItems.push({
        code: 'EXTRA_STEEL_DOOR',
        description: `Steel security door`,
        quantity: extras.steel_door,
        unitPrice: priceConfig.extras.steelDoorCharge,
        lineTotal: extras.steel_door * priceConfig.extras.steelDoorCharge
      });
    }

    if (extras.concrete_foundation) {
      lineItems.push({
        code: 'EXTRA_FOUNDATION',
        description: `Concrete foundation (${extras.concrete_foundation}m²)`,
        quantity: extras.concrete_foundation,
        unitPrice: 50, // Placeholder rate
        lineTotal: extras.concrete_foundation * 50
      });
    }

    extras.other?.forEach((extra, index) => {
      lineItems.push({
        code: `EXTRA_OTHER_${index + 1}`,
        description: extra.title,
        quantity: 1,
        unitPrice: extra.cost,
        lineTotal: extra.cost
      });
    });
  }

  /**
   * Validate inputs before calculation
   */
  private validateInputs(productConfig: ProductConfigInput, priceConfig: PriceConfig): void {
    if (!productConfig.size || productConfig.size.widthM <= 0 || productConfig.size.depthM <= 0) {
      throw new InvalidConfigurationError('Invalid or missing size configuration');
    }

    if (priceConfig.taxes.vatPct < 0 || priceConfig.taxes.vatPct > 100) {
      throw new InvalidConfigurationError('Invalid VAT rate in pricing configuration');
    }

    // Validate internal wall configuration
    const internalWall = productConfig.internal_wall;
    if (internalWall?.finish && internalWall.finish !== 'none') {
      if (!internalWall.areaSqM || internalWall.areaSqM <= 0) {
        throw new InvalidConfigurationError('Internal wall area is required when finish is not "none"');
      }
    }

    // Validate floor configuration
    const floor = productConfig.floor;
    if (floor?.type && floor.type !== 'none') {
      if (!floor.areaSqM || floor.areaSqM <= 0) {
        throw new InvalidConfigurationError('Floor area is required when floor type is not "none"');
      }
    }

    // Validate glazing dimensions
    const glazing = productConfig.glazing;
    if (glazing) {
      const allGlazingItems = [
        ...(glazing.windows || []),
        ...(glazing.externalDoors || []),
        ...(glazing.skylights || [])
      ];
      
      for (const item of allGlazingItems) {
        if (item.widthM <= 0 || item.heightM <= 0) {
          throw new InvalidConfigurationError('All glazing items must have positive dimensions');
        }
      }
    }
  }
}

/**
 * Create calculation service instance
 * @returns CalculationService instance
 */
export function createCalculationService(): CalculationService {
  return new CalculationService();
}