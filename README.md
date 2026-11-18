# Taskify — Spec Kit Tutorial Implementation (TypeScript Edition)

An end-to-end **Spec-Driven Development (SDD)** example project following the official **Taskify** tutorial guide from the [GitHub Spec Kit (`github/spec-kit`)](https://github.com/github/spec-kit) repository, demonstrating how to go from high-level governance principles and plain-English specifications to a verified, working microservices application using Spec Kit commands.

> **Note on Stack Adaptation**: The default setup in the upstream Spec Kit Taskify guide uses a **.NET / C#** stack. This repository adapts that architecture to a **TypeScript-oriented stack** built with **Bun**, **ElysiaJS**, **Zod**, **Drizzle ORM**, **PostgreSQL 16**, and a lightweight **React 19 SSR** frontend (`apps/web`), while preserving the exact Spec Kit workflow, security/validation governance, and microservice boundaries.

---

## How Spec Kit Was Used (Step-by-Step Guide)

This repository preserves every Spec Kit artifact generated along the way inside [`.specify/`](.specify/) and [`specs/001-taskify-kanban-mvp/`](specs/001-taskify-kanban-mvp/) so you can trace how each command builds on the previous one:

### 1. Configure Branch & Spec Folder Naming — `/speckit-branch-convention-configure`
Set up custom naming rules in [`.specify/branch-convention.yml`](.specify/branch-convention.yml):
- **Git Branch Pattern**: `{type}/{kebab}` (e.g., `feat/taskify-kanban-mvp`)
- **Spec Folder Pattern**: `{seq}-{kebab}` (e.g., `specs/001-taskify-kanban-mvp`)

### 2. Define Project Governance — `/speckit-constitution`
Ratified the project's non-negotiable engineering principles in [`.specify/memory/constitution.md`](.specify/memory/constitution.md):
- **I. Security-First Design (NON-NEGOTIABLE)** — Least privilege, zero-trust inter-service auth (`X-Internal-Service-Token`), no leaked internals.
- **II. Strict Input Validation (NON-NEGOTIABLE)** — Dual-layer schema validation at both the API gateway and receiving microservice boundaries.
- **III. Microservices Architecture** — Independently deployable domain services with isolated data schemas and versioned contracts.
- **IV. Comprehensive Code Documentation** — Structured JSDoc/TSDoc docstrings, OpenAPI 3.1 specs (`/swagger`), and service READMEs.

### 3. Author the Feature Specification — `/speckit-specify`
Created the technology-agnostic Phase 1 specification ([`specs/001-taskify-kanban-mvp/spec.md`](specs/001-taskify-kanban-mvp/spec.md)) and initial quality checklist ([`checklists/requirements.md`](specs/001-taskify-kanban-mvp/checklists/requirements.md)):
- 5 predefined users (1 Product Manager, 4 Engineers) and 3 seeded sample projects with no login screen in Phase 1.
- Creating projects, assigning tasks, commenting, and moving tasks across 4 Kanban columns (`To Do`, `In Progress`, `In Review`, `Done`).

### 4. Resolve Ambiguities — `/speckit-clarify`
Used interactive clarification sessions (recorded under `## Clarifications` in [`spec.md`](specs/001-taskify-kanban-mvp/spec.md)) to lock down edge behaviors before coding:
- **Kanban Status Transitions**: Unrestricted column moves by any predefined user (forward, backward, or skipping columns).
- **Comment Permissions**: Any user can post comments; only the original comment author can edit or delete their own comment (`403 FORBIDDEN_NOT_COMMENT_AUTHOR` otherwise).
- **Task Assignment**: Single assignee (`0..1`) selectable from all 5 predefined users and modifiable by any user.
- **Schema Validation Library**: Standardized on **Zod** (`zod`) instead of TypeBox across gateway and microservice boundaries.

### 5. Design Architecture & Contracts — `/speckit-plan`
Generated the TypeScript microservices blueprint and Phase 0/Phase 1 design artifacts:
- [`plan.md`](specs/001-taskify-kanban-mvp/plan.md) — Monorepo layout, Constitution gate checks, and stack choices (**Bun + ElysiaJS + Drizzle ORM + PostgreSQL 16 + React 19 SSR**).
- [`research.md`](specs/001-taskify-kanban-mvp/research.md) — Architectural rationale for schema-per-service DB isolation, Zod dual-layer validation, SSE real-time updates, and HTML5 DnD.
- [`data-model.md`](specs/001-taskify-kanban-mvp/data-model.md) — Isolated PostgreSQL schemas (`projects_domain`, `tasks_domain`, `notifications_domain`) and field validation rules.
- [`contracts/rest-api.md`](specs/001-taskify-kanban-mvp/contracts/rest-api.md) — REST & Server-Sent Events (SSE) API contracts and error envelopes.
- [`quickstart.md`](specs/001-taskify-kanban-mvp/quickstart.md) — End-to-end validation scenarios.

### 6. Audit Requirements Quality — `/speckit-checklist`
Generated a 24-item reviewer-owned requirements audit in [`checklists/security-validation.md`](specs/001-taskify-kanban-mvp/checklists/security-validation.md) covering boundary validation, zero-trust headers, concurrency, and SSE recovery.

### 7. Break Down Implementation Tasks — `/speckit-tasks`
Produced 44 dependency-ordered, user-story-grouped tasks (`T001`–`T044`) in [`tasks.md`](specs/001-taskify-kanban-mvp/tasks.md), with explicit `data-model.md` field traceability.

### 8. Cross-Artifact Consistency Check — `/speckit-analyze`
Verified 100% alignment across `spec.md`, `plan.md`, `data-model.md`, `tasks.md`, and `constitution.md` with zero unresolved conflicts or missing constrained-field citations.

### 9. Execute & Converge — `/speckit-implement` & `/speckit-converge`
Implemented all 44 tasks, validated against Docker PostgreSQL 16 and headless Chromium Playwright E2E flows, and confirmed convergence (`0` remaining gaps) via `/speckit-converge`.

---

## Project Structure

```text
├── .specify/                       # Spec Kit configuration, constitution, templates, and scripts
├── specs/001-taskify-kanban-mvp/   # Spec, plan, research, data-model, REST contracts, checklists, tasks
├── packages/
│   └── shared/                     # Shared Zod DTO schemas, predefined 5-user roster, security helpers
├── services/
│   ├── api-gateway/                # Edge ElysiaJS gateway (port 3001): validation, CORS, SSE hub
│   ├── projects-service/           # Projects & Users microservice (port 3002, schema: projects_domain)
│   ├── tasks-service/              # Tasks & Comments microservice (port 3003, schema: tasks_domain)
│   └── notifications-service/      # Notifications microservice (port 3004, schema: notifications_domain)
├── apps/
│   └── web/                        # React 19 SSR workspace + browser client (port 3000)
├── tests/
│   ├── contract/                   # Boundary Zod validation & zero-trust auth tests
│   ├── integration/                # Cross-service workflow & SSE stream integration tests
│   └── e2e/                        # Web SSR & headless Chromium Playwright tests
├── docker-compose.yml              # PostgreSQL 16 service with isolated schema init script
└── scripts/dev.ts                  # Launches all microservices and the web frontend
```

---

## Running Locally

### Prerequisites
- [Bun](https://bun.sh/) `>= 1.1`
- Docker & Docker Compose (for PostgreSQL 16; falls back automatically to isolated per-service `bun:sqlite` files when `POSTGRES_ENABLED=false`)

### Setup & Start

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Set `POSTGRES_ENABLED=true` in `.env` if using Docker PostgreSQL 16.

3. **Start PostgreSQL 16 (optional when using SQLite fallback)**:
   ```bash
   docker compose up -d postgres
   ```

4. **Apply migrations and seed sample data**:
   ```bash
   bun run db:migrate
   bun run db:seed
   ```

5. **Run all services and the web app**:
   ```bash
   bun run dev
   ```
   - **Web App**: `http://localhost:3000`
   - **API Gateway & OpenAPI Docs**: `http://localhost:3001` (`http://localhost:3001/swagger`)

### Verification Commands

```bash
bun run typecheck   # TypeScript checks across all 6 workspace configs
bun run test        # Contract & cross-service integration tests
bun run test:e2e    # Web SSR & headless Chromium Playwright E2E suite
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
