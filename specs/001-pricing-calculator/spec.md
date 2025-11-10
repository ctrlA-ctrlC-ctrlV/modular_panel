# Feature Specification: Pricing Calculator

**Feature Branch**: `001-pricing-calculator`  
**Created**: 2025-11-10  
**Status**: Published  
**Input**: User description: "Pricing Calculator for garden room construction that accepts inputs, fetches pricing rules and tax in real time, calculates and displays results, stores a unique quote, and supports one-click professional quote generation; includes configuration panel for pricing data and quote management panel; with product_config and price_config models."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Calculate and Save Quote (Priority: P1)

User enters room specifications and options, sees a calculated price instantly, and can save
the quote which assigns a unique quote number.

**Why this priority**: This is the core value—generating accurate, instant pricing for sales.

**Independent Test**: Enter inputs, receive a total, save as quote; verify unique quote number
and stored record with summary matches the displayed calculation.

**Acceptance Scenarios**:

1. **Given** pricing data is available, **When** the user enters valid dimensions, glazing,
  electrical, and options, **Then** the system displays subtotal, taxes, and total in the
  selected currency within 2 seconds.
2. **Given** a displayed calculation, **When** the user clicks "Save Quote", **Then** a unique
  quote number is generated and the quote is stored with all selected inputs and computed
  amounts.
3. **Given** a saved quote, **When** the user reloads the app and searches by quote number,
  **Then** the saved quote details are retrieved and match the previously displayed result.

---

### User Story 2 - One-Click Professional Quote (Priority: P1)

From a calculated or saved quote, the user generates a professional quote document that
includes the logo, customer details, quote number/date, specification breakdown, totals,
and additional notes.

**Why this priority**: Enables immediate sharing with customers; critical for sales.

**Independent Test**: Generate a quote document from an existing calculation; verify required
fields and formatting without needing admin configuration steps.

**Acceptance Scenarios**:

1. **Given** a calculated quote, **When** the user selects "Generate Quote", **Then** a
  downloadable document is produced containing logo, customer details, quote number, quote
  date, itemized specifications, subtotal, tax, total, and notes.
2. **Given** a saved quote, **When** the user opens the quote and generates the document,
  **Then** the quote number, date, and totals match the stored record exactly.

---

### User Story 3 - Pricing Configuration Panel (Priority: P2)

Authorized staff maintain pricing-related data (rates, charges, taxes, validity periods)
through a configuration panel.

**Why this priority**: Keeps pricing accurate without engineering changes.

**Independent Test**: Update a rate and observe the change reflected in new calculations while
preserving historical quotes.

**Acceptance Scenarios**:

1. **Given** current pricing configuration, **When** an authorized user updates a rate or tax,
  **Then** subsequent calculations use the new values and the change is versioned with valid
  from/to dates.
2. **Given** historical quotes, **When** the configuration is updated, **Then** previously saved
  quotes remain unchanged and continue referencing the configuration version used at creation.

---

### User Story 4 - Quote Management Panel (Priority: P2)

Users can find, view, update allowable fields (notes, customer contact), or delete quotes.

**Why this priority**: Supports ongoing sales pipeline and record management.

**Independent Test**: Search by quote number and verify the retrieved record; update notes and
verify audit trail; delete a quote and confirm removal.

**Acceptance Scenarios**:

1. **Given** existing quotes, **When** the user searches by quote number or date range,
  **Then** matching quotes are listed with key details.
2. **Given** a selected quote, **When** the user edits notes or customer details,
  **Then** changes are saved and audit metadata (who/when) is recorded.
3. **Given** a selected quote, **When** the user deletes it (with confirmation), **Then** the
  quote is marked deleted or removed according to retention policy and is no longer returned in
  default searches.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Pricing configuration missing required fields for a calculation; provide safe error with
  instructions to contact admin; prevent save.
- Tax rate or currency not defined; fall back to configuration defaults; prevent save if
  impossible to compute compliant totals.
- Invalid inputs (negative dimensions, inconsistent options such as heater counts with no
  electrical package); show field-level validation messages.
- Concurrency during quote number assignment; ensure atomic uniqueness and no collisions.
- Configuration change between calculation and save; store configuration version in the quote
  and recompute on save if necessary to ensure consistency.
- Data access failure; present a retry option and non-destructive error messaging; do not lose
  user-entered inputs.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST accept user inputs for quantity, product type, and specifications
  (dimensions, glazing, electrical options, interior finish, flooring, delivery, extras,
  discount, notes) and validate them.
- **FR-002**: System MUST retrieve current pricing configuration and rules at calculation time.
- **FR-003**: System MUST compute subtotal (excl. tax), tax, and total, and display results
  dynamically within 2 seconds under normal load.
- **FR-004**: System MUST generate a unique quote number on save and persist the quote with all
  inputs, computed amounts, currency, tax rate, and configuration version used.
- **FR-005**: System MUST allow generating a professional quote document that includes logo,
  customer details, quote number, quote date, specifications, totals, and notes.
- **FR-006**: System MUST provide a configuration panel to create, read, update, and retire
  pricing configurations with validity windows (validFrom/validTo) and a single current
  configuration at a time.
- **FR-007**: System MUST provide a quote management panel to search, view, update non-price
  fields (e.g., notes, customer contact), and delete quotes with confirmation.
- **FR-008**: System MUST prevent modification of computed totals for saved quotes; updates must
  produce a new calculation and optionally a new quote (or version) if business policy requires.
- **FR-009**: System MUST ensure quote numbers are globally unique and non-reusable.
- **FR-010**: System MUST maintain an audit trail for configuration changes and quote edits
  (who, when, what fields changed).
- **FR-011**: System MUST support currency defined in pricing configuration and display amounts
  consistently with appropriate symbols and thousand separators.
- **FR-012**: System MUST handle error conditions gracefully and preserve in-progress user input.

### Key Entities *(include if feature involves data)*

- **price_config**: Versioned pricing configuration (label, currency, base, cladding, bathroom,
  glazing, electrical, internal, flooring, delivery, extras, taxes, current flag, validFrom,
  validTo, createdAt, updatedAt).
- **product_config**: User-entered configuration for a potential build (size, cladding, bathroom,
  electrical, internal doors and walls, heaters, glazing, floor, delivery, extras, discount,
  estimate breakdown, notes, permittedDevelopmentFlags, createdAt, updatedAt).
- **quote**: Saved output including generated quoteNumber, quoteDate, customer details (name,
  contact), serialized product_config snapshot, totals, currency, tax rate, and a pointer to the
  price_config version used.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 95% of calculations complete and render totals within 2 seconds for typical inputs.
- **SC-002**: 100% of saved quotes receive a unique quote number with no collisions.
- **SC-003**: 90% of users can generate a professional quote document in one click without
  assistance.
- **SC-004**: 100% of configuration changes record who/when and affect only new calculations,
  leaving historical quotes unchanged.
- **SC-005**: 99% successful retrieval of quotes by quote number within 1 second.
