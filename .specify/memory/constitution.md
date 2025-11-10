<!--
Sync Impact Report
Version change: UNDEFINED → 1.0.0
Modified principles: (initial creation)
Added sections: Core Principles; Non-Functional Standards; Development Workflow & Quality Gates; Governance
Removed sections: none
Templates requiring updates:
	- .specify/templates/plan-template.md ✅ (Constitution Check will reference Principles I–V)
	- .specify/templates/spec-template.md ✅ (User story independence aligns with Principle III)
	- .specify/templates/tasks-template.md ✅ (Story grouping & test-first aligns with Principle III)
	- .specify/templates/agent-file-template.md ⚠ pending (needs population from plans)
	- .specify/templates/commands/* ⚠ pending (directory absent; create when command docs added)
Follow-up TODOs: NONE
-->

# modular_panel Constitution

## Core Principles

### I. Modular Domain-Driven Architecture (NON-NEGOTIABLE)
Each feature MUST be delivered as a self-contained module with explicit public contracts (API surface, events, or data schemas). No module may depend on internal details of another—only published contracts. Circular dependencies are prohibited. Every module MUST own a clear bounded context with single purpose and MUST document its contract before implementation. Rationale: Prevents systemic coupling, enables parallel work, and supports independent deployment & replacement.

### II. Consistent, Versioned Interfaces
All external and inter-module communication MUST use documented, versioned interfaces (HTTP/JSON APIs, typed events, or CLI commands). Error responses MUST include machine-parsable codes plus human-readable messages. Breaking changes REQUIRE a new major version and a migration note. Deprecations MUST provide at least one minor version of overlap before removal. Rationale: Stability for consumers and predictable evolution.

### III. Test-First & Continuous Verification (NON-NEGOTIABLE)
Work MUST begin by defining failing tests: unit + contract (module boundary) before implementation. Red → Green → Refactor cycle enforced. Minimum coverage: 85% lines, 100% for contract-critical functions. Integration tests MUST exist for cross-module flows affecting persistence, auth, or performance budgets. CI MUST block merges if tests fail, coverage threshold unmet, or contract snapshots change without approval. Rationale: Ensures correctness, prevents regressions, and codifies expectations.

### IV. Observability & Operational Transparency
Structured logging (context + correlation IDs) MUST be implemented for all request and background processing paths. Metrics MUST track latency (p50, p95), error rates, and key business events. Tracing MUST propagate through async boundaries. No silent failures—errors MUST be surfaced with severity classification. SLOs: <250ms p95 for API responses (baseline), <1% error rate per endpoint. Rationale: Enables rapid issue diagnosis and data-driven reliability improvements.

### V. Performance, Security & Simplicity
Each module MUST define performance budgets (CPU, memory, latency) and security requirements (input validation, authentication, authorization boundaries, secret management). Dependencies MUST be added only with explicit justification tied to a principle or requirement—alternatives considered documented if complexity increases. All code paths MUST fail fast on invalid input. Prefer smallest viable abstraction—no "just in case" extensibility. Rationale: Maintains maintainability, reduces attack surface, and prevents premature complexity.

## Non-Functional Standards

Accessibility: All user-facing components MUST meet WCAG 2.1 AA contrast and focus criteria. Security: Secrets MUST NOT be committed; environment configuration handled via secure vault or env injection. Data Protection: PII stored MUST be minimal and encrypted at rest & in transit (TLS 1.3). Performance Budgets: Initial page load <3s on 3G simulated, backend median latency <150ms. Error Handling: Each module defines standard error taxonomy (validation, auth, conflict, transient) with mapped status codes. Internationalization: All user-visible strings routed through i18n pipeline
once localization is enabled (future feature). Rationale: Guarantees baseline quality and readiness for scale.

## Development Workflow & Quality Gates

Branch Naming: feature/<ticket-or-slug>, fix/<issue>, chore/<scope>. PR Requirements: Link to spec or plan, list affected modules, updated tests, and migration notes for any contract change. CI Quality Gates (ALL MUST PASS): lint/static analysis, tests & coverage thresholds, contract diff approval, SAST scan (no high severity), dependency vulnerability check, formatting compliance. Review: Minimum 2 approvals for non-trivial changes (>200 LOC or contract modifications). Release: Version bump per Semantic Versioning; changelog entry referencing principles when relevant. Rollback: Must be possible within 5 minutes via automated deployment tooling. Rationale: Ensures repeatable, safe delivery and traceable changes.

## Governance

Authority: This constitution supersedes ad-hoc practices. Conflicts resolved by referencing principles in order (I has highest weight, then II, etc.). Amendment Procedure: Proposal PR including diff + rationale + impact analysis; requires 3 maintainer approvals; version bump type determined by semantic impact. Versioning: MAJOR = principle removal/redefinition; MINOR = new principle/section or expanded non-functional standard; PATCH = clarifications only. Compliance Reviews: Quarterly audit verifying module contracts, test coverage, observability signals, and budgets. Enforcement: Non-compliant merges reverted; repeated violations trigger workflow retrospective. Documentation: All principles referenced in plan "Constitution Check" section; tasks and specs must reflect independence & test-first mandates. Sunset: Deprecated principles tracked until removed in next MAJOR. Rationale: Provides clear
process for evolution while preserving stability.

**Version**: 1.0.0 | **Ratified**: 2025-11-10 | **Last Amended**: 2025-11-10

