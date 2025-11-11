# Research: Pricing Calculator

**Feature**: 001-pricing-calculator  
**Date**: 2025-11-10  
**Scope**: Resolve unknowns and document rationale for technology & design decisions prior to detailed design (Phase 1).

## Decisions

### Node.js 22.11.0 LTS + TypeScript
- **Decision**: Use Node.js 24.11.0 LTS with TypeScript 5.8.3.
- **Rationale**: Latest LTS provides performance improvements, stable V8, and long-term support; TypeScript enforces contracts early (Principle III);
- **Alternatives Considered**: Node 20 (shorter remaining support window); Deno / Bun (ecosystem maturity & library availability risk).

### Express 4.19.x
- **Decision**: Use Express 4.19.x (current stable) with modular routers.
- **Rationale**: Mature, minimal, easy instrumentation; Express 5 still not GA.
- **Alternatives Considered**: Fastify (higher perf but less universally familiar); NestJS (added complexity & opinionation not yet justified by scope).

### PostgreSQL 17
- **Decision**: Use PostgreSQL 17 on DigitalOcean managed service.
- **Rationale**: Strong relational integrity, JSONB support for snapshot fields, reliable managed backups.
- **Alternatives Considered**: MySQL (less JSON expression power); MongoDB (quote data is structured & relational); SQLite (insufficient concurrency & scaling headroom).

### Data Access Strategy
- **Decision**: Direct SQL via `pg` + SQL migration tooling (e.g., node-pg-migrate or custom migration runner).
- **Rationale**: Simplicity (Principle V) and transparency; avoids ORM abstraction overhead until complexity demands it.
- **Alternatives Considered**: Prisma (rapid modeling but adds build layer & potential runtime overhead); Sequelize (legacy complexity); Knex (query builder adds layer without current necessity).

### Validation Layer (Zod)
- **Decision**: Zod schemas for runtime & compile-time inference.
- **Rationale**: Single source-of-truth for request validation + contract generation; tight TypeScript integration.
- **Alternatives Considered**: Yup (less TS inference); AJV (faster raw JSON Schema but more boilerplate).

### Quote Number Generation
- **Decision**: Monotonic sequence stored in dedicated table (e.g., `quote_sequence`) using `SELECT ... FOR UPDATE` inside transaction.
- **Rationale**: Prevents collisions under concurrency; DB-managed ensures atomicity.
- **Alternatives Considered**: UUID only (not human friendly); Snowflake IDs (unnecessary for volume); application memory counter (race conditions on scale & multi-instance).

### Professional Quote Document
- **Decision**: Generate PDF server-side using headless HTML rendering (e.g., Playwright or Puppeteer) with a dedicated HTML template.
- **Rationale**: Full layout control; logo integration; consistent branding.
- **Alternatives Considered**: Client-side printing (inconsistent), pure PDF libraries (higher layout effort), external service (cost + dependency risk).

### Observability Stack
- **Decision**: Winston structured logging (JSON in prod), OpenTelemetry SDK for tracing, Prometheus metrics endpoint.
- **Rationale**: Meets Principle IV; portable across hosting; minimal vendor lock-in.
- **Alternatives Considered**: Proprietary APM first (cost early); no tracing (violates observability principle).

### Frontend Styling (Tailwind + Bootstrap)
- **Decision**: Tailwind for utility-first layout & spacing; Bootstrap components (modal, navbar) imported minimally; custom layer for variable overrides to avoid specificity conflicts.
- **Rationale**: Leverages rapid prototyping with Tailwind while using robust accessible components where needed.
- **Alternatives Considered**: Only Tailwind (reinvent components); Only Bootstrap (less design flexibility); Component libraries (Chakra/MUI) adding theme lock-in.

### State Management & Data Fetching
- **Decision**: React Query for server state (caching, revalidation) + local component state hooks.
- **Rationale**: Simplifies synchronization with calculation endpoints and invalidation after config updates.
- **Alternatives Considered**: Redux Toolkit (heavier for current scope); SWR (similar but React Query richer feature set).

### API Versioning Strategy
- **Decision**: Prefix all endpoints with `/api/v1/`; embed response `apiVersion` field; contract diffs tracked in `contracts/openapi.yml`.
- **Rationale**: Aligns with Principle II; enables explicit consumer compatibility management.
- **Alternatives Considered**: No version prefix (harder to introduce breaking changes gracefully); header-based versioning (less explicit for logging/analytics).

### Calculation Engine Design
- **Decision**: Pure functional service taking snapshot of pricing config + product spec returning deterministic result (subtotal, tax, total, line items).
- **Rationale**: Testability (unit tests can freeze config), easier regression detection.
- **Alternatives Considered**: Interleaved DB queries per component (slower, harder to test), class-based stateful calculator (not necessary).

### Security & Auth (Initial Phase)
- **Decision**: Basic authenticated admin route guard (token or session) for configuration & quote management; public calculation requires eventual gating if exposed externally.
- **Rationale**: Minimizes initial complexity; restricts sensitive CRUD operations.
- **Alternatives Considered**: Full RBAC now (scope small); totally open endpoints (risk of data tampering/exposure).

## Unresolved Items
None (all critical clarifications resolved with reasonable defaults consistent with constitution, 0 NEEDS CLARIFICATION markers remain).

## Summary
All foundational technology and design decisions support modularity, testability, observability, and simplicity. Proceed to Phase 1 design artifacts.
