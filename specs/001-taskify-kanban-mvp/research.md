# Research & Architectural Decisions: Taskify Kanban Productivity Platform

**Feature**: [spec.md](spec.md) | **Date**: 2026-11-17 | **Branch**: `feat/taskify-kanban-mvp`

## Overview

This document captures Phase 0 research and architectural decisions translating the clarified Phase 1 Taskify specification into a Security-First, strictly validated, documented microservices architecture built on Bun, ElysiaJS, Drizzle ORM, PostgreSQL, and TanStack Start.

---

## 1. Backend Runtime & Web Framework

- **Decision**: Use **Bun 1.x** with **ElysiaJS**, leveraging **Zod (`zod`)** via ElysiaJS's native Standard Schema validation support for all runtime request/response validation alongside `@elysiajs/swagger` for automated **OpenAPI 3.1** documentation generation across every service.
- **Rationale**:
  - ElysiaJS is optimized natively for Bun's HTTP server (`Bun.serve`), delivering minimal cold-start latency and seamless integration with Standard Schema libraries such as Zod.
  - Shared Zod schema definitions in `packages/shared` satisfy Constitution Principle II (*Strict Input Validation*) with strong trimming/refinement rules (`z.string().trim().min(1).max(...)`), end-to-end TypeScript type inference, and consistent error formatting across both `api-gateway` and downstream microservices.
  - `@elysiajs/swagger` converts route metadata and OpenAPI schema descriptors into live OpenAPI 3.1 specifications, directly supporting Constitution Principle IV (*Comprehensive Code Documentation*).
- **Alternatives Considered**:
  - **TypeBox (`t`)**: Built into ElysiaJS by default, but rejected per project preference for Zod's richer refinement/transform ergonomics (`trim()`, custom messages) and unified schema reuse across backend services and TanStack Start frontend forms.
  - **Hono + Zod**: Lightweight and runtime-agnostic, but lacks Elysia's integrated Bun performance optimizations and plugin ecosystem.
  - **Express / Fastify on Node.js**: Mature ecosystem, but does not leverage Bun's native runtime performance requested by the project stack.

---

## 2. Microservices Decomposition & Database Isolation

- **Decision**: Decompose the backend into **four independently deployable Bun/ElysiaJS services** inside a Bun workspace monorepo, backed by **PostgreSQL 16** and **Drizzle ORM** (`drizzle-orm/postgres-js` + `drizzle-kit`), where each stateful service owns an **isolated PostgreSQL schema**:
  - `services/api-gateway`: Stateless BFF/edge gateway handling external CORS/security headers, gateway-level Zod validation, active-user verification, REST routing, and real-time SSE fan-out.
  - `services/projects-service` (`projects_domain` schema): Owns `users` (5 predefined team members) and `projects` (3 seeded sample projects + user-created projects).
  - `services/tasks-service` (`tasks_domain` schema): Owns `tasks` and `comments`, enforcing Kanban status rules, single-assignee cardinality (`0..1`), and comment author ownership.
  - `services/notifications-service` (`notifications_domain` schema): Owns `notifications` and processes domain events emitted by `projects-service` and `tasks-service`.
- **Rationale**:
  - Satisfies Constitution Principle III (*Microservices Architecture*) by ensuring each domain service owns its private data state with zero shared tables, zero cross-schema foreign keys, and independent Drizzle configurations (`drizzle.config.ts`) and migration directories.
  - Aligns directly with the user's explicit REST API domains (`projects`, `tasks`, `notifications`) while keeping Phase 1 local setup ergonomic via a single PostgreSQL 16 instance partitioned by strict database schemas and distinct service credentials/roles.
  - Cross-service integrity (e.g., validating `projectId` or `assigneeId` in `tasks-service`) is verified via versioned internal HTTP contracts or validated against shared predefined roster constants rather than database joins.
- **Alternatives Considered**:
  - **Modular Monolith (single Elysia app + single schema)**: Simpler operationally, but violates Constitution Principle III (*Microservices Architecture* requiring independently deployable services with private data states).
  - **Three Separate PostgreSQL Server Instances**: Maximum physical isolation, but unnecessary operational overhead for Phase 1 local development; separate PostgreSQL schemas with separate Drizzle clients preserve strict logical isolation while keeping Docker/Postgres setup lightweight and straightforward to split into separate databases later.

---

## 3. Frontend React Server Framework

- **Decision**: Use **TanStack Start** (React 19 + `@tanstack/react-router` + `@tanstack/react-query` + Vite/Vinxi SSR and server functions) in `apps/web`.
- **Rationale**:
  - Meets the user's preference for a lightweight React server framework (`TanStack Start`) with native SSR, type-safe file-based routing, and first-class `@tanstack/react-query` integration.
  - SSR loads the 5 predefined users and initial project board state immediately on page load with zero login gate (`SC-001`), while client hydration pairs with `@tanstack/react-query` for optimistic task movement and instant cache updates.
  - TanStack Start server functions/proxies cleanly keep internal service tokens (`INTERNAL_SERVICE_TOKEN`) off the browser bundle when proxying or hydrating initial server state.
- **Alternatives Considered**:
  - **Next.js (App Router)**: Feature-rich, but heavier runtime footprint and tighter coupling to Vercel-oriented conventions compared to TanStack Start.
  - **Plain React SPA (Vite only)**: No SSR server layer for initial workspace hydration and environment-isolated server-side gateway communication.

---

## 4. Kanban Drag-and-Drop Engine

- **Decision**: Use **`@dnd-kit/core`** and **`@dnd-kit/sortable`** for board drag-and-drop across the four columns (`To Do`, `In Progress`, `In Review`, `Done`), paired with an explicit column/status selector dropdown on every task card and task detail modal.
- **Rationale**:
  - `@dnd-kit` supports React 19 cleanly, provides built-in keyboard navigation and ARIA announcements for accessibility, and handles cross-column drag transitions smoothly with zero legacy `react-beautiful-dnd` maintenance risk.
  - Pairing drag-and-drop with an explicit status selector guarantees full usability on touch devices, keyboard-only workflows, and deterministic Playwright E2E tests.
  - Optimistic updates via `@tanstack/react-query` move the card visually in `<50ms`, well below the `<1s` requirement (`SC-003`), rolling back cleanly if validation fails.
- **Alternatives Considered**:
  - **HTML5 Native Drag-and-Drop API**: Lightweight, but inconsistent touch behavior, rough drag previews, and poor accessibility semantics.
  - **`@hello-pangea/dnd` (`react-beautiful-dnd` fork)**: Familiar API, but heavier legacy React patterns and stricter constraints with React 19 concurrent features.

---

## 5. Real-Time Board Updates & Notifications

- **Decision**: Use **Server-Sent Events (SSE)** exposed at `GET /api/v1/events/stream` on `api-gateway`, backed by an in-memory pub/sub hub fed by `POST /internal/v1/events` from `projects-service`, `tasks-service`, and `notifications-service`.
- **Rationale**:
  - Kanban board changes (`project.created`, `task.created`, `task.updated`, `comment.changed`, `notification.created`) are predominantly server-to-client broadcasts triggered after REST mutations. SSE runs over standard HTTP, reconnects automatically via browser `EventSource`, requires no extra WebSocket upgrade infrastructure in Phase 1, and triggers targeted `@tanstack/react-query` invalidations in under 1 second across open tabs.
  - Emitting domain events from `projects-service` and `tasks-service` to `notifications-service` (which persists `Notification` records and notifies `api-gateway` SSE subscribers) decouples real-time delivery from core CRUD transactions.
- **Alternatives Considered**:
  - **WebSockets (`ws` / Elysia `.ws()`)**: Bidirectional support is unnecessary since all client mutations use validated REST endpoints; WebSockets add stateful connection upgrade complexity behind proxies.
  - **Short Polling (`setInterval`)**: Increases database/API load unnecessarily and risks exceeding the `<1s` real-time propagation goal.

---

## 6. Security-First & Boundary Input Validation

- **Decision**: Enforce **dual-layer validation**, **explicit active-user verification**, **Zero-Trust inter-service authentication**, and **sanitized error responses**:
  1. **Dual-Layer Zod Validation**: `api-gateway` validates incoming requests at the edge; every downstream microservice (`projects-service`, `tasks-service`, `notifications-service`) independently re-validates all headers, path/query params, and JSON payloads with its own Zod schemas (Constitution Principle II).
  2. **Predefined Active-User Verification**: Browser requests send `X-Active-User-Id` (UUID of the selected predefined team member). Both `api-gateway` and downstream services verify that the UUID belongs to one of the 5 predefined Phase 1 users before executing state-changing actions or comment author checks.
  3. **Zero-Trust Inter-Service Auth**: Downstream microservices reject any direct call missing a valid `X-Internal-Service-Token` header checked via constant-time comparison (`crypto.timingSafeEqual`), returning `401 UNAUTHORIZED_SERVICE` (Constitution Security Standards).
  4. **Sanitized Error Envelope & Security Headers**: All validation, authorization (`403 FORBIDDEN_NOT_COMMENT_AUTHOR`), and missing-resource (`404 NOT_FOUND`) errors return `{ error: { code, message, details? } }` without stack traces, SQL fragments, or internal host details. Gateway attaches `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and strict CORS origins.
- **Rationale**:
  - Ensures Phase 1's "no login" requirement does not weaken input validation, authorization invariants (such as comment author-only edit/delete), or microservice boundary security.
- **Alternatives Considered**:
  - **Gateway-only validation / trusted internal network**: Violates Constitution Principle II (*validation must occur at the API gateway and independently at the receiving microservice boundary*) and Zero-Trust Inter-Service Communication standards.
