## **Pricing Calculator**

I need to build a pricing calculator for a garden room construction company that interacts with a PostgreSQL database hosted on a DigitalOcean droplet. The calculator should:

- Accept user input (e.g. quantity, product type, etc.)
- Fetch pricing data in real time from the database (e.g. pricing rules, tax rates)
- Calculate and display the result dynamically
- Store the generated quote in the database with a unique quote number (generated when quote is saved)
- Support one-click professional quote generation (including logo, customer details, quote number, quote date, specifications, total price, and additional notes)) 

Additional requirements:

- A **configuration panel** for performing CRUD operations on pricing-related data
- A **quote management panel** to view, update, or delete existing quotes

### Data Models

#### product_config

- id (UUID)
- size: { widthM: number, depthM: number }
- cladding: {areaSqm: number}
- bathroom: {half: number, three_quarter: number} // Half = Toliet + Sink, three_quarter = Toliet + Sink + Showe
- electrical: {switches: number, sockets: number, heater: number, underskink_heater?: number, elec_boiler?: number} // underskink_heater included with half bathroom, elec_boiler = included with three_quarter bathroom
- internal_doors: number
- internal_wall: { finish: "none" | "panel" | "skim_paint", areaSqM?: number }
- heaters: number
- glazing: { 
  windows: Array<{widthM:number, heightM:number}>, 
  externalDoors: Array<{widthM:number, heightM:number"}>, 
  skylights: Array<{widthM:number, heightM:number}> 
  }
- floor: { type: "none" | "wooden" | "tile", areaSqM: number }
- delivery: { distanceKm?: number, cost: number }
- extras: {esp_insulation?: number, render?: number, steel_door?: number, concrete_foundation?: number, other: Array<{title: string, cost: number}>}
- discount: number
- estimate: { currency: string, subtotalExVat: number, vatRate: number, totalIncVat: number }
- notes: string
- permittedDevelopmentFlags: Array<{ code:string, label:string }>
- createdAt, updatedAt



### price_config

- id: UUID
- label: string,
- currency": string,
- current": boolean // only one document at a time marked true
- validFrom": date // edit date?=0 | create date
- validTo: null // null = open ended
- base: {"baseRatePerM2": number, "fixedCharge": number, "defaultHeightM": 2.4}
- cladding: {"ratePerM2": number}
- bathroom: {"half": number, "threeQuarter": number}
- glazing: {
  "window": { "charge": number, "ratePerM2": number },
  "externalDoor": { "charge": number, "ratePerM2": number },
  "skylight": { "charge": number, "ratePerM2": number }
  }
- electrical: {
  "switch": number,
  "doubleSocket": number,
  "heater": number,
  }
- internal" {
  "internalDoorCharge": number,
  "internalWall": {
    "none": number,
    "panel": number,
    "skim_paint": number
  }
  }
- flooring": {
  "none": number,
  "wooden": number,
  "tile": number
  }
- delivery: {
  "freeKm": number,
  "ratePerKm": number
  }
- extras": {
  "ESPInstallRatePerM2": number,
  "renderRatePerM2": number,
  "steelDoorCharge": number
  }
- taxes: {"vatPct": number}
- createdAt, updatedAt