/**
 * Product configuration types for frontend
 * Mirrors the backend schema types for type safety
 */

export interface SizeConfig {
  widthM: number;
  depthM: number;
}

export interface CladdingConfig {
  areaSqm?: number;
}

export interface BathroomConfig {
  half?: number;
  three_quarter?: number;
}

export interface ElectricalConfig {
  switches?: number;
  sockets?: number;
  heater?: number;
  underskink_heater?: number;
  elec_boiler?: number;
}

export interface GlazingItem {
  widthM: number;
  heightM: number;
}

export interface GlazingConfig {
  windows?: GlazingItem[];
  externalDoors?: GlazingItem[];
  skylights?: GlazingItem[];
}

export interface InternalWallConfig {
  finish: 'none' | 'panel' | 'skim_paint';
  areaSqM?: number;
}

export interface FloorConfig {
  type: 'none' | 'wooden' | 'tile';
  areaSqM?: number;
}

export interface DeliveryConfig {
  distanceKm?: number;
  cost?: number;
}

export interface ExtraItem {
  title: string;
  cost: number;
}

export interface ExtrasConfig {
  esp_insulation?: number;
  render?: number;
  steel_door?: number;
  concrete_foundation?: number;
  other?: ExtraItem[];
}

export interface PermittedDevelopmentFlag {
  code: string;
  label: string;
}

export interface ProductConfigInput {
  size: SizeConfig;
  cladding?: CladdingConfig;
  bathroom?: BathroomConfig;
  electrical?: ElectricalConfig;
  internal_doors?: number;
  internal_wall?: InternalWallConfig;
  heaters?: number;
  glazing?: GlazingConfig;
  floor?: FloorConfig;
  delivery?: DeliveryConfig;
  extras?: ExtrasConfig;
  discount?: number;
  notes?: string;
  permittedDevelopmentFlags?: PermittedDevelopmentFlag[];
}

export interface LineItem {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface QuoteEstimate {
  currency: string;
  subtotalExVat: number;
  vatRate: number;
  totalIncVat: number;
  lineItems: LineItem[];
}

export interface CustomerInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Quote {
  quoteNumber: string;
  quoteDate: string;
  customer: CustomerInfo;
  estimate: QuoteEstimate;
  currency: string;
  notes?: string;
  status: 'active' | 'deleted';
}

export interface CreateQuoteRequest {
  productConfig: ProductConfigInput;
  customer: CustomerInfo;
}