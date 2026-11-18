# Implementation Plan: Taskify Kanban Productivity Platform (Phase 1 MVP)

**Branch**: `feat/taskify-kanban-mvp` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-taskify-kanban-mvp/spec.md`

## Summary

Build Phase 1 of Taskify as a Security-First, strictly validated, fully documented microservices platform powered by **Bun** and **ElysiaJS** backed by **PostgreSQL 16** with **Drizzle ORM**, paired with a **TanStack Start** React server frontend supporting drag-and-drop Kanban boards and real-time Server-Sent Events (SSE) updates. Without a login screen in Phase 1, users switch among 5 predefined team members (1 Product Manager, 4 Engineers), browse 3 seeded sample projects or create new ones, assign (`0..1`) and freely move task cards across `To Do`, `In Progress`, `In Review`, and `Done`, manage author-owned comments, and receive real-time board and activity notifications across exposed REST APIs for projects, tasks, and notifications.

## Technical Context

**Language/Version**: TypeScript 5.x on Bun `>= 1.1` (backend services and shared contracts) and React 19 (frontend SSR/UI)

**Primary Dependencies**:
- Backend: `elysia`, `zod`, `@elysiajs/cors`, `@elysiajs/swagger`, `drizzle-orm`, `postgres` (`postgres-js`), `drizzle-kit`
- Frontend: `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query`, `@dnd-kit/core`, `@dnd-kit/sortable`

**Storage**: PostgreSQL 16 via Drizzle ORM with strict schema-per-service isolation (`projects_domain`, `tasks_domain`, `notifications_domain`) and independent migration histories per microservice

**Testing**: `bun test` (unit, Zod boundary validation, microservice contract/integration tests) and Playwright (end-to-end Kanban drag-and-drop, author-only comment permissions, and real-time SSE sync)

**Target Platform**: Linux / Docker containers for backend microservices & PostgreSQL; modern desktop/mobile browsers for the TanStack Start web app

**Project Type**: Distributed microservices monorepo (`apps/web` React SSR client + `services/*` Bun/ElysiaJS REST/SSE microservices + `packages/shared` schema & doc contracts)

**Performance Goals**: `< 1s` real-time Kanban board column transition & SSE propagation (`SC-003`), `< 100ms` p95 API validation/CRUD latency under Phase 1 team load, zero login blocking on initial page load (`SC-001`)

**Constraints**:
- Dual-layer strict input validation (gateway + receiving microservice boundary) using Zod schemas (via Elysia Standard Schema integration)
- Zero-trust inter-service calls authenticated with `X-Internal-Service-Token`
- No shared database tables or cross-schema joins across microservices
- Author-only edit/delete enforcement on task comments (`X-Active-User-Id === comment.authorId`)
- Complete JSDoc/TSDoc docstrings, OpenAPI 3.1 Swagger specs, and service-level READMEs across all modules

**Scale/Scope**: Phase 1 MVP — 5 predefined users (1 Product Manager, 4 Engineers), 3 seeded sample projects, unrestricted user-created projects/tasks/comments, 4 fixed Kanban columns, real-time SSE notifications

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate Evaluation

| Constitution Principle / Standard | Status | Plan Alignment |
|----------------------------------|--------|----------------|
| **I. Security-First Design (NON-NEGOTIABLE)** | PASS | Enforces constant-time `X-Internal-Service-Token` checks between `api-gateway` and downstream microservices, security headers (`nosniff`, `DENY`, strict CORS), active-user verification against the 5 predefined UUIDs, server-side authorship derivation, and sanitized error envelopes without internal stack traces. |
| **II. Strict Input Validation (NON-NEGOTIABLE)** | PASS | Enforces dual-layer Zod schemas at both `api-gateway` and every downstream microservice (`projects-service`, `tasks-service`, `notifications-service`) covering UUID params, trimmed string lengths, enum Kanban statuses, and `0..1` assignee rules (`FR-010`, `SC-004`). |
| **III. Microservices Architecture** | PASS | Separates domain responsibilities into `projects-service`, `tasks-service`, `notifications-service`, and `api-gateway`, each owning a dedicated PostgreSQL schema (`projects_domain`, `tasks_domain`, `notifications_domain`), isolated Drizzle migrations, and versioned HTTP/SSE contracts. |
| **IV. Comprehensive Code Documentation** | PASS | Every service includes `@elysiajs/swagger` OpenAPI 3.1 endpoints, structured JSDoc/TSDoc docstrings specifying inputs/outputs/errors/security assumptions on all public exports, and dedicated service-level `README.md` documentation. |
| **Zero-Trust & Schema-Driven Contracts** | PASS | Internal event ingestion (`/internal/v1/events`) and downstream service endpoints reject unauthenticated internal callers (`401 UNAUTHORIZED_SERVICE`) and execute runtime schema validation via shared contracts. |

### Post-Phase 1 Design Re-Check

All Phase 1 artifacts ([research.md](research.md), [data-model.md](data-model.md), [contracts/rest-api.md](contracts/rest-api.md), and [quickstart.md](quickstart.md)) maintain complete compliance:
- Zero cross-schema database foreign keys exist in [data-model.md](data-model.md).
- Every endpoint in [contracts/rest-api.md](contracts/rest-api.md) declares explicit Zod validation constraints, `X-Active-User-Id` verification, `X-Internal-Service-Token` enforcement on internal boundaries, and `403 FORBIDDEN_NOT_COMMENT_AUTHOR` ownership checks.
- No unresolved `NEEDS CLARIFICATION` markers remain.

## Project Structure

### Documentation (this feature)

```text
specs/001-taskify-kanban-mvp/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── rest-api.md      # REST & SSE API contract specifications
├── checklists/          # Specification quality checklist
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
package.json                        # Bun workspace root scripts (dev, test, db:migrate, db:seed)
tsconfig.base.json                  # Shared TypeScript base configuration
biome.json                          # Workspace linting and formatting rules
docker-compose.yml                  # PostgreSQL 16 + optional local service orchestration
docker/
└── postgres/
    └── init-schemas.sql            # Creates isolated projects_domain, tasks_domain, notifications_domain schemas
.env.example                        # Required environment variables template

packages/
└── shared/                         # Shared Zod schemas, predefined roster constants, error envelope helpers
    ├── package.json
    ├── README.md
    └── src/
        ├── constants/users.ts      # 5 predefined users (1 PM, 4 Engineers) & Kanban column enums
        ├── schemas/                # Shared Zod DTOs for projects, tasks, comments, notifications, events
        └── security/               # Timing-safe token check, string trimmers, sanitized error builders

services/
├── api-gateway/                    # Edge ElysiaJS gateway (port 3001): validation, CORS/headers, routing, SSE hub
│   ├── package.json
│   ├── README.md
│   └── src/
│       ├── index.ts
│       ├── middleware/             # Active-user header check, security headers, global error sanitizer
│       ├── routes/                 # /api/v1/users, /projects, /tasks, /comments, /notifications, /events/stream
│       └── sse/                    # In-memory SSE subscriber registry & broadcast dispatcher
├── projects-service/               # Projects & Users microservice (port 3002, schema: projects_domain)
│   ├── package.json
│   ├── README.md
│   ├── drizzle.config.ts
│   └── src/
│       ├── index.ts
│       ├── db/                     # Drizzle client, schema (users, projects), migrations, idempotent seed
│       ├── middleware/             # Internal service token guard & boundary error handler
│       └── routes/                 # Users & Projects REST handlers + Swagger docs
├── tasks-service/                  # Tasks & Comments microservice (port 3003, schema: tasks_domain)
│   ├── package.json
│   ├── README.md
│   ├── drizzle.config.ts
│   └── src/
│       ├── index.ts
│       ├── db/                     # Drizzle client, schema (tasks, comments), migrations, idempotent seed
│       ├── middleware/             # Internal service token guard & comment ownership validator
│       └── routes/                 # Tasks & Comments REST handlers + event emitter + Swagger docs
└── notifications-service/          # Notifications microservice (port 3004, schema: notifications_domain)
    ├── package.json
    ├── README.md
    ├── drizzle.config.ts
    └── src/
        ├── index.ts
        ├── db/                     # Drizzle client, schema (notifications), migrations
        ├── middleware/             # Internal service token guard
        └── routes/                 # Public notifications REST API + /internal/v1/events ingestion

apps/
└── web/                            # TanStack Start React server frontend (port 3000)
    ├── package.json
    ├── README.md
    ├── app.config.ts
    └── app/
        ├── routes/                 # File-based SSR routes (workspace index, project board view)
        ├── components/             # UserSwitcher, ProjectList, CreateProjectModal, KanbanBoard, TaskCard, TaskModal, CommentThread, NotificationBell
        ├── hooks/                  # React Query hooks, optimistic drag-drop mutations, SSE EventSource listener
        └── lib/                    # Typed API client injecting X-Active-User-Id & friendly validation error mapping

tests/
├── contract/                       # Boundary Zod validation, 401 zero-trust, 403 comment ownership contract tests
├── integration/                    # Cross-service workflow tests (project -> task -> comment -> notification -> SSE)
└── e2e/                            # Playwright tests (5 users, 3 sample projects, DnD board, real-time sync)
```

**Structure Decision**: A Bun workspaces monorepo cleanly isolates the four independently deployable ElysiaJS services (`api-gateway`, `projects-service`, `tasks-service`, `notifications-service`), the TanStack Start React SSR frontend (`apps/web`), and the shared Zod contract/security utilities (`packages/shared`), enabling single-command local development while maintaining strict schema-level database isolation and independent Swagger contracts per microservice.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 4 backend services (`api-gateway`, `projects-service`, `tasks-service`, `notifications-service`) + `packages/shared` | Constitution Principle III mandates independently deployable microservices with private data stores and versioned API/event contracts, and the prompt explicitly specifies REST APIs for projects, tasks, and notifications alongside a real-time frontend. | A single monolithic ElysiaJS server sharing one database schema would violate Constitution Principles II (dual-boundary validation) and III (no shared databases across domains). |
| Separate Drizzle schemas (`projects_domain`, `tasks_domain`, `notifications_domain`) in PostgreSQL | Preserves strict per-service data ownership and independent Drizzle migrations without cross-service SQL joins. | Shared foreign-key tables across services violate microservice state isolation rules in Constitution Principle III. |
