---

description: "Task list template for feature implementation"
---

# Tasks: Pricing Calculator

**Input**: Design documents from `/specs/001-pricing-calculator/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED per constitution (Principle III). Each story begins with contract tests before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- [P]: Can run in parallel (different files, no dependencies)
- [Story]: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project structure per plan in backend/ and frontend/ at repository root
- [x] T002 Initialize Node.js + TypeScript in backend/package.json with scripts (dev, build, test)
- [x] T003 Initialize React app in frontend/package.json with scripts (dev, build, test)
- [x] T004 Configure Tailwind and Bootstrap in frontend/tailwind.config.js and frontend/src/styles/index.css
- [x] T005 Configure TypeScript in backend/tsconfig.json and frontend/tsconfig.json
- [x] T006 [P] Add eslint + prettier configs at root and per package (.eslintrc.cjs, .prettierrc)
- [x] T007 [P] Create backend folder skeleton per plan (src/config, src/modules/*, src/api/*, src/db, src/schemas, src/instrumentation)
- [x] T008 [P] Create frontend folder skeleton per plan (src/components/*, src/pages, src/services, src/state, src/styles)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T009 Setup database migration tooling in backend/src/db (migrations/, migration runner)
- [x] T010 Create initial DB migrations for price_config, product_config, quote, quote_sequence tables in backend/src/db/migrations
- [x] T011 Implement configuration loader (env) in backend/src/config/index.ts
- [x] T012 Implement logging (Winston) in backend/src/instrumentation/logger.ts
- [x] T013 Implement error handler middleware in backend/src/api/middleware/errorHandler.ts
- [x] T014 Implement request validation middleware (Zod) in backend/src/api/middleware/validation.ts
- [x] T015 Setup Express app bootstrap with router mount point /api/v1 in backend/src/index.ts
- [x] T016 Implement observability setup (OTel tracing, Prometheus metrics) in backend/src/instrumentation/
- [x] T017 Implement base auth guard (admin-only) in backend/src/api/middleware/auth.ts
- [x] T018 [P] Create API client base in frontend/src/services/http.ts (uses VITE_API_BASE)
- [x] T019 [P] Setup React Query provider and app shell in frontend/src/state/queryClient.tsx and frontend/src/main.tsx
- [x] T020 [P] Setup global styles and Bootstrap integration overrides in frontend/src/styles/index.css

### Connectivity & DigitalOcean (Foundational)

- [x] T021 Implement database pool with SSL + CA support for DigitalOcean in backend/src/db/pool.ts
- [x] T022 Add startup DB connectivity check (fail fast + structured logs) in backend/src/index.ts
- [x] T023 Implement /api/v1/health with DB liveness/readiness checks in backend/src/api/controllers/health.controller.ts and backend/src/api/routes/health.routes.ts
- [x] T024 [P] Add CORS middleware using ALLOWED_ORIGINS in backend/src/api/middleware/cors.ts and wire in backend/src/index.ts
- [x] T025 [P] Add frontend HealthCheck page to probe /api/v1/health in frontend/src/pages/HealthCheckPage.tsx
- [x] T026 Create DigitalOcean setup guide with step-by-step changes and verification tests in specs/001-pricing-calculator/ops/digitalocean-setup.md
- [x] T027 [P] Add DB connectivity integration test in backend/tests/integration/db.health.test.ts
- [x] T028 [P] Add preflight script to verify ENV and DB reachability in backend/scripts/preflight.ts
- [x] T029 [P] Add minimal seed script to create a current price_config in backend/src/db/seed.ts
- [x] T030 Add end-to-end smoke test calling /api/v1/calculate after seed in backend/tests/integration/smoke.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Calculate and Save Quote (Priority: P1) 🎯 MVP

**Goal**: User can calculate a price and save a quote with a unique number

**Independent Test**: Enter inputs → view totals → save → retrieve by quote number

### Tests for User Story 1 (CONTRACT-FIRST)

- [ ] T031 [P] [US1] Contract test for POST /api/v1/calculate in backend/tests/contract/calculate.test.ts
- [ ] T032 [P] [US1] Contract test for POST /api/v1/quotes in backend/tests/contract/quotes.create.test.ts
- [ ] T033 [US1] Integration test: calculate → save → get in backend/tests/integration/quotes.flow.test.ts

### Implementation for User Story 1

- [ ] T034 [P] [US1] Define Zod schemas for ProductConfigInput in backend/src/schemas/productConfig.ts
- [ ] T035 [P] [US1] Define Zod schemas for QuoteEstimate and CreateQuoteRequest in backend/src/schemas/quote.ts
- [ ] T036 [P] [US1] Implement pricing repository to fetch current config in backend/src/modules/pricing/repo.ts
- [ ] T037 [P] [US1] Implement pure calculation service in backend/src/modules/calculation/service.ts
- [ ] T038 [US1] Implement /calculate controller and route in backend/src/api/controllers/calculate.controller.ts and backend/src/api/routes/calculate.routes.ts
- [ ] T039 [US1] Implement quote number generator (transactional sequence) in backend/src/modules/quotes/sequence.ts
- [ ] T040 [US1] Implement quote repository (persist + fetch by number) in backend/src/modules/quotes/repo.ts
- [ ] T041 [US1] Implement /quotes controller and route (create, get by number) in backend/src/api/controllers/quotes.controller.ts and backend/src/api/routes/quotes.routes.ts
- [ ] T042 [P] [US1] Build calculator form UI in frontend/src/components/calculator/CalculatorForm.tsx
- [ ] T043 [P] [US1] Implement calculate API client in frontend/src/services/calculate.ts
- [ ] T044 [P] [US1] Implement save quote API client in frontend/src/services/quotes.ts
- [ ] T045 [US1] Wire calculator page with state and display totals in frontend/src/pages/CalculatorPage.tsx
- [ ] T046 [US1] Add "Save Quote" flow and success screen in frontend/src/components/calculator/SaveQuoteModal.tsx
- [ ] T047 [US1] Add audit logging for save events in backend/src/modules/quotes/audit.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - One-Click Professional Quote (Priority: P1)

**Goal**: Generate a professional quote document (PDF) from a calculation or saved quote

**Independent Test**: Generate a downloadable PDF with required fields from a saved quote

### Tests for User Story 2 (CONTRACT-FIRST)

- [ ] T048 [P] [US2] Contract test for POST /api/v1/quotes/{quoteNumber}/document in backend/tests/contract/quotes.document.test.ts

### Implementation for User Story 2

- [ ] T049 [P] [US2] Implement document template (HTML) in backend/src/modules/documents/templates/quote.html
- [ ] T050 [US2] Implement document generation service in backend/src/modules/documents/service.ts
- [ ] T051 [US2] Implement /quotes/{quoteNumber}/document controller + route in backend/src/api/controllers/documents.controller.ts and backend/src/api/routes/documents.routes.ts
- [ ] T052 [P] [US2] Add frontend "Generate Quote" button and download handler in frontend/src/components/quote-management/GenerateDocumentButton.tsx

**Checkpoint**: Document generation independently testable given an existing quote

---

## Phase 5: User Story 3 - Pricing Configuration Panel (Priority: P2)

**Goal**: Authorized staff manage pricing configurations, validity, and current flag

**Independent Test**: Update a rate → new calculations use new version; historic quotes unchanged

### Tests for User Story 3 (CONTRACT-FIRST)

- [ ] T053 [P] [US3] Contract test for GET /api/v1/pricing/current in backend/tests/contract/pricing.current.test.ts
- [ ] T054 [P] [US3] Contract test for POST /api/v1/pricing in backend/tests/contract/pricing.create.test.ts
- [ ] T055 [P] [US3] Contract test for PUT /api/v1/pricing/{id} in backend/tests/contract/pricing.update.test.ts
- [ ] T056 [P] [US3] Contract test for POST /api/v1/pricing/{id}/activate in backend/tests/contract/pricing.activate.test.ts

### Implementation for User Story 3

- [ ] T057 [P] [US3] Implement pricing models and DB queries in backend/src/modules/pricing/repo.ts
- [ ] T058 [US3] Implement pricing service (create/update/activate with constraints) in backend/src/modules/pricing/service.ts
- [ ] T059 [US3] Implement controllers and routes for pricing in backend/src/api/controllers/pricing.controller.ts and backend/src/api/routes/pricing.routes.ts
- [ ] T060 [P] [US3] Build config panel list and detail forms in frontend/src/components/config-panel/
- [ ] T061 [P] [US3] Implement frontend services for pricing APIs in frontend/src/services/pricing.ts
- [ ] T062 [US3] Add admin guard on UI routes in frontend/src/pages/ConfigPanelPage.tsx

**Checkpoint**: Configuration management independently testable

---

## Phase 6: User Story 4 - Quote Management Panel (Priority: P2)

**Goal**: Search, view, update permissible fields, and delete quotes

**Independent Test**: Search by quote number → open → edit notes → delete with confirmation

### Tests for User Story 4 (CONTRACT-FIRST)

- [ ] T063 [P] [US4] Contract test for GET /api/v1/quotes? in backend/tests/contract/quotes.search.test.ts
- [ ] T064 [P] [US4] Contract test for GET /api/v1/quotes/{quoteNumber} in backend/tests/contract/quotes.get.test.ts
- [ ] T065 [P] [US4] Contract test for PATCH /api/v1/quotes/{quoteNumber} in backend/tests/contract/quotes.update.test.ts
- [ ] T066 [P] [US4] Contract test for DELETE /api/v1/quotes/{quoteNumber} in backend/tests/contract/quotes.delete.test.ts

### Implementation for User Story 4

- [ ] T067 [P] [US4] Implement quote search and detail queries in backend/src/modules/quotes/repo.ts
- [ ] T068 [US4] Implement update and delete controller methods in backend/src/api/controllers/quotes.controller.ts
- [ ] T069 [P] [US4] Build quote search UI and table in frontend/src/components/quote-management/QuoteSearch.tsx
- [ ] T070 [P] [US4] Build quote detail view with edit form in frontend/src/components/quote-management/QuoteDetail.tsx
- [ ] T071 [US4] Implement delete confirmation flow in frontend/src/components/quote-management/DeleteQuoteDialog.tsx

**Checkpoint**: Quote management independently testable

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T072 [P] Documentation updates in docs/ and specs/001-pricing-calculator/quickstart.md
- [ ] T073 Code cleanup and refactoring across backend/src and frontend/src
- [ ] T074 Performance optimization for calculation hot paths in backend/src/modules/calculation/service.ts
- [ ] T075 [P] Additional unit tests in backend/tests/unit/ and frontend/tests/unit/
- [ ] T076 Security hardening (headers, input hardening, secrets scanning) in backend/src/api/middleware/
- [ ] T077 Run quickstart.md validation and update based on latest routes in specs/001-pricing-calculator/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies - can start immediately
- Foundational (Phase 2): Depends on Setup completion - BLOCKS all user stories
- User Stories (Phase 3+): All depend on Foundational phase completion
  - US1 (P1) should be delivered first as MVP
  - US2, US3, US4 can proceed in parallel after US1 services stabilize
- Polish (Final Phase): Depends on desired user stories being complete

### User Story Dependencies

- User Story 1 (P1): base for saving and retrieving quotes
- User Story 2 (P1): depends on quote existence (can stub for development)
- User Story 3 (P2): independent, affects new calculations only
- User Story 4 (P2): depends on US1 persistence, otherwise independent

### Within Each User Story

- Tests (contract) MUST be written and FAIL before implementation
- Models/schemas before services
- Services before endpoints
- Core implementation before integration and UI wiring
- Story complete before moving to next priority

### Parallel Opportunities

- All tasks marked [P] can run in parallel (different files, no dependencies)
- Within stories: schemas, repositories, UI components can parallelize
- Across stories: US3 (config panel) and US4 (quote management) mostly independent after foundation

---

## Parallel Example: User Story 1

```
Task: T031 Contract test for POST /api/v1/calculate in backend/tests/contract/calculate.test.ts
Task: T032 Contract test for POST /api/v1/quotes in backend/tests/contract/quotes.create.test.ts

Task: T034 Define Zod schemas for ProductConfigInput in backend/src/schemas/productConfig.ts
Task: T036 Implement pricing repository in backend/src/modules/pricing/repo.ts
Task: T042 Build calculator form UI in frontend/src/components/calculator/CalculatorForm.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational phases
2. Complete US1 (calculate + save + retrieve)
3. Validate independently (contract/integration tests + manual UI flow)
4. Merge and deploy MVP

### Incremental Delivery

1. Add US2 (document generation) → validate → deploy
2. Add US3 (config panel) → validate → deploy
3. Add US4 (quote management) → validate → deploy

### Parallel Team Strategy

- Developer A: US1 backend
- Developer B: US1 frontend
- Developer C: US3 config panel
- Developer D: US4 quote management

