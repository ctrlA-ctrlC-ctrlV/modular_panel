# Implementation Plan: Pricing Calculator

**Branch**: `001-pricing-calculator` | **Date**: 2025-11-10 | **Spec**: ../spec.md
**Input**: Feature specification from `/specs/001-pricing-calculator/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver a React-centric pricing calculator for garden room construction with dynamic
quote computation using current pricing rules stored in PostgreSQL, real-time tax
application, quote persistence with unique numbering, professional quote document
generation, and admin panels for pricing configuration & quote management. Technical
approach: Modular backend (Express + Node.js 22 LTS) exposing REST JSON APIs; frontend
React app (React 18.2 assumed) using Tailwind utilities + Bootstrap components; data
access via `pg` + lightweight data mapper; strict contract-first design, test-first
implementation, and observability instrumentation per constitution.

## Technical Context

**Language/Version**: Node.js 22 LTS (TypeScript 5.x for type safety)  
**Primary Dependencies**: Express 4.19.x, React 18.2, Tailwind CSS 3.4.x, Bootstrap 5.3.x, pg 8.x, Zod (schema validation), Winston (logging), Jest + Supertest (testing), React Testing Library  
**Storage**: PostgreSQL 17 (DigitalOcean managed instance)  
**Testing**: Jest (unit & integration), Contract tests via Supertest, Coverage enforced ≥85% lines (Principle III)  
**Target Platform**: Backend: Linux x64 (Ubuntu 22.04+); Frontend: modern evergreen browsers (Chrome/Edge/Firefox/Safari)  
**Project Type**: web (frontend SPA + backend API)  
**Performance Goals**: API p95 <250ms; calculation response <2s (95%); initial load <3s on simulated 3G; quote document generation <5s  
**Constraints**: Secure secret handling via env files + vault; no circular dependencies; fail-fast validation; memory per backend container <512MB baseline  
**Scale/Scope**: Initial internal users: <25 (sales/admin); Quotes/day target: <500; Config versions <200 first year  

Assumptions: React 18.2 remains latest stable; Express 5 still not GA; Node.js 22 is LTS; using Tailwind utilities primarily and Bootstrap selectively for complex components (modals, nav) to avoid style conflicts.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance Status | Notes |
|-----------|-------------------|-------|
| I. Modular Architecture | PASS | Separate pricing, quote, config modules with explicit API contracts |
| II. Versioned Interfaces | PASS | `/api/v1/` namespace; future breaking changes via `/api/v2/` |
| III. Test-First & Coverage | PASS | Contract tests defined before implementation; coverage gate in CI |
| IV. Observability | PASS | Structured logs (Winston), metrics (Prometheus export), tracing (OpenTelemetry) |
| V. Performance/Security/Simplicity | PASS | Budgets defined; validation + least-dependency approach |

No violations—Phase 0 may proceed.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
backend/
├── src/
│   ├── config/            # env, secrets loading
│   ├── modules/
│   │   ├── pricing/       # pricing rules retrieval
│   │   ├── calculation/   # computation logic (pure functions)
│   │   ├── quotes/        # quote persistence & numbering
│   │   └── documents/     # professional quote doc generation
│   ├── api/
│   │   ├── routes/        # Express route definitions
│   │   ├── middleware/    # auth, validation, error, tracing
│   │   └── controllers/   # route handlers delegating to services
│   ├── services/          # orchestration & business logic
│   ├── db/                # migrations, query builders
│   ├── schemas/           # Zod validation & contract schemas
│   ├── instrumentation/   # logging, metrics, tracing setup
│   └── index.ts           # app bootstrap
└── tests/
  ├── unit/
  ├── contract/
  ├── integration/
  └── fixtures/

frontend/
├── src/
│   ├── components/
│   │   ├── calculator/
│   │   ├── config-panel/
│   │   ├── quote-management/
│   │   └── shared/
│   ├── pages/
│   ├── hooks/
│   ├── services/          # API client wrappers
│   ├── state/             # React Query / context setup
│   ├── styles/            # Tailwind config & Bootstrap overrides
│   └── main.tsx
└── tests/
  ├── unit/
  ├── integration/
  └── e2e/ (future)

contracts/ (spec-level API contracts; also copied inside feature docs)
```

**Structure Decision**: Web application split into `backend/` and `frontend/` for clear module boundaries and deploy independence. Backend adopts modular folders to enforce Principle I (bounded contexts). Frontend separates domain-specific components. Shared contracts reside in `contracts/` for versioned interface alignment (Principle II).

## Complexity Tracking

No constitution violations. Additional abstraction (e.g., introducing a full ORM) deferred until complexity or maintenance warrants (simple `pg` queries + SQL migrations suffice initially).

---

### Phase 0 Research Summary (see `research.md` for detail)
All assumed versions validated against industry release timelines; Express 5 deferred; Tailwind + Bootstrap coexist strategy documented.

### Phase 1 Design Outputs
Generated: `data-model.md`, `contracts/openapi.yml`, `quickstart.md`.

### Post-Design Constitution Re-Check
All principles remain PASS; observability & performance budgets embedded; no changes needed.

