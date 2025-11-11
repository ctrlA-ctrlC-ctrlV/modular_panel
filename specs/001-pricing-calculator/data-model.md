# Data Model: Pricing Calculator

**Feature**: 001-pricing-calculator  
**Date**: 2025-11-10

## Entities

### price_config
- id: UUID (pk)
- label: string (required, unique per validFrom)
- currency: string (ISO 4217, e.g., "GBP", required)
- current: boolean (only one true across active records)
- validFrom: date (required)
- validTo: date|null (null=open-ended)
- base: { baseRatePerM2: number>=0, fixedCharge: number>=0, defaultHeightM: number>0 }
- cladding: { ratePerM2: number>=0 }
- bathroom: { half: number>=0, threeQuarter: number>=0 }
- glazing: {
  window: { charge: number>=0, ratePerM2: number>=0 },
  externalDoor: { charge: number>=0, ratePerM2: number>=0 },
  skylight: { charge: number>=0, ratePerM2: number>=0 }
}
- electrical: { switch: number>=0, doubleSocket: number>=0, heater: number>=0 }
- internal: {
  internalDoorCharge: number>=0,
  internalWall: { none: number>=0, panel: number>=0, skim_paint: number>=0 }
}
- flooring: { none: number>=0, wooden: number>=0, tile: number>=0 }
- delivery: { freeKm: number>=0, ratePerKm: number>=0 }
- extras: { ESPInstallRatePerM2: number>=0, renderRatePerM2: number>=0, steelDoorCharge: number>=0 }
- taxes: { vatPct: number between 0..100 }
- createdAt: timestamp
- updatedAt: timestamp

Constraints:
- UNIQUE (current WHERE validTo IS NULL) → single current config
- Non-overlapping validity windows for same label (optional business rule)

### product_config (user-entered spec)
- id: UUID (pk)
- size: { widthM: number>0, depthM: number>0 }
- cladding: { areaSqm: number>=0 }
- bathroom: { half: number>=0, three_quarter: number>=0 }
- electrical: { switches: number>=0, sockets: number>=0, heater: number>=0, underskink_heater?: number>=0, elec_boiler?: number>=0 }
- internal_doors: number>=0
- internal_wall: { finish: "none"|"panel"|"skim_paint", areaSqM?: number>=0 }
- heaters: number>=0
- glazing: {
  windows: Array<{ widthM:number>0, heightM:number>0 }>,
  externalDoors: Array<{ widthM:number>0, heightM:number>0 }>,
  skylights: Array<{ widthM:number>0, heightM:number>0 }>
}
- floor: { type: "none"|"wooden"|"tile", areaSqM: number>=0 }
- delivery: { distanceKm?: number>=0, cost: number>=0 }
- extras: { esp_insulation?: number>=0, render?: number>=0, steel_door?: number>=0, concrete_foundation?: number>=0, other: Array<{ title:string, cost:number>=0 }> }
- discount: number between 0..100 (percentage or absolute? assume absolute currency discount=0 by default; see validation)
- estimate: { currency: string, subtotalExVat: number>=0, vatRate: number>=0, totalIncVat: number>=0 }
- notes: string <= 2000 chars
- permittedDevelopmentFlags: Array<{ code:string, label:string }>
- createdAt: timestamp
- updatedAt: timestamp

Validation Notes:
- If bathroom.half>0 → electrical.underskink_heater defaults to included (0 cost line) if not specified
- If bathroom.three_quarter>0 → electrical.elec_boiler defaults to included (0 cost line)
- internal_wall.areaSqM required when finish != "none"

### quote
- id: UUID (pk)
- quoteNumber: string (unique, human-friendly, e.g., Q25-001234)
- quoteDate: date (defaults to now)
- customer: { name: string, email?: string, phone?: string, address?: string }
- productConfigId: UUID (fk to product_config) or embedded snapshot
- productConfigSnapshot: JSONB (immutable snapshot used for calculation)
- priceConfigId: UUID (fk to price_config version used)
- currency: string
- vatRate: number
- subtotalExVat: number>=0
- totalIncVat: number>=0
- notes: string
- status: "active"|"deleted"
- audit: { createdBy: string, updatedBy?: string, createdAt: timestamp, updatedAt?: timestamp }

Rules:
- Computed totals immutable for a given quote; edits create new version or a separate quote (business policy TBD; default separate).

## Relationships
- quote → price_config (many-to-one) via used version at creation
- quote → product_config (one-to-one or embedded snapshot)

## Derived/Computation Inputs
- Area calculations for windows/doors/skylights (widthM * heightM)
- Base area = widthM * depthM (assume defaultHeightM from config used only for certain rates)

## Open Questions (tracked & resolved in research)
- Discount semantics chosen as absolute currency discount applied post-subtotal (documented in calculation rules).