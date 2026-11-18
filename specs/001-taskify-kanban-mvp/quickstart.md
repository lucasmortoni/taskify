# Quickstart & End-to-End Validation Guide: Taskify Phase 1

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Contracts**: [contracts/rest-api.md](contracts/rest-api.md) | **Data Model**: [data-model.md](data-model.md)

This guide defines how to run the Taskify microservices stack locally and validate every clarified Phase 1 requirement end-to-end.

---

## 1. Prerequisites

- **Bun**: `>= 1.1.0`
- **PostgreSQL**: `>= 16` (or **Docker** + **Docker Compose** to spin up Postgres 16 locally)
- **Playwright browsers** (optional, for automated UI/E2E test runs)

---

## 2. Environment & Database Setup

1. Create `.env` from `.env.example` at the repository root with isolated database URLs (or schema-scoped connections) and a non-empty `INTERNAL_SERVICE_TOKEN`:
   - `PROJECTS_DATABASE_URL` (`projects_domain` schema)
   - `TASKS_DATABASE_URL` (`tasks_domain` schema)
   - `NOTIFICATIONS_DATABASE_URL` (`notifications_domain` schema)
   - `INTERNAL_SERVICE_TOKEN` (shared secret for zero-trust service calls)
   - Service URLs (`PROJECTS_SERVICE_URL`, `TASKS_SERVICE_URL`, `NOTIFICATIONS_SERVICE_URL`, `API_GATEWAY_URL`)

2. Start PostgreSQL 16 (via Docker Compose or local Postgres service):
   ```bash
   docker compose up -d postgres
   ```

3. Install dependencies, run per-service Drizzle migrations, and seed the 5 predefined users, 3 sample projects, and starter Kanban tasks:
   ```bash
   bun install
   bun run db:migrate
   bun run db:seed
   ```

---

## 3. Running the Microservices & Frontend

Start all four backend services (`projects-service`, `tasks-service`, `notifications-service`, `api-gateway`) and the TanStack Start React server (`apps/web`):

```bash
bun run dev
```

Expected local endpoints:
- **TanStack Start Web App**: `http://localhost:3000`
- **API Gateway**: `http://localhost:3001` (`GET /api/v1/users`, `/api/v1/projects`, `/api/v1/tasks`, `/api/v1/notifications`, `/api/v1/events/stream`)
- **Projects Service OpenAPI**: `http://localhost:3002/swagger`
- **Tasks Service OpenAPI**: `http://localhost:3003/swagger`
- **Notifications Service OpenAPI**: `http://localhost:3004/swagger`

---

## 4. Automated Test Suite

Run unit, contract/boundary validation, and integration tests:

```bash
bun test
```

Run browser end-to-end tests (drag-and-drop, active user switching, comment permissions, real-time SSE sync):

```bash
bun run test:e2e
```

---

## 5. End-to-End Validation Scenarios

### Scenario 1: Zero-Login Workspace, 5 Predefined Users & 3 Sample Projects (`FR-001`, `FR-002`, `FR-003`, `SC-001`)

1. Open `http://localhost:3000` in a browser (or query `GET /api/v1/users` and `GET /api/v1/projects`).
2. **Expected**:
   - No login prompt appears.
   - The active-user selector displays 5 users: **Alex Morgan (Product Manager)**, **Sam Rivera (Engineer)**, **Jordan Lee (Engineer)**, **Taylor Kim (Engineer)**, and **Casey Patel (Engineer)**.
   - 3 sample projects load immediately with tasks distributed across `To Do`, `In Progress`, `In Review`, and `Done`.

### Scenario 2: Project Creation & Strict Input Validation (`FR-004`, `FR-010`, `SC-004`)

1. Submit an invalid project payload (whitespace-only name):
   ```bash
   curl -i -X POST http://localhost:3001/api/v1/projects \
     -H "Content-Type: application/json" \
     -H "X-Active-User-Id: 11111111-1111-4111-8111-111111111101" \
     -d '{"name":"   ","description":"Should fail"}'
   ```
   **Expected**: `400 Bad Request` with `VALIDATION_ERROR` and zero stack trace or internal error details.
2. Submit a valid project payload (`{"name":"Security Launch Prep","description":"Phase 1 readiness"}`):
   **Expected**: `201 Created`, project appears immediately in the UI project switcher and sidebar.
3. Verify zero-trust boundary rejection by calling `projects-service` directly (`http://localhost:3002/projects`) without `X-Internal-Service-Token`:
   **Expected**: `401 UNAUTHORIZED_SERVICE`.

### Scenario 3: Task Assignment (`0..1`) & Unrestricted Kanban Transitions (`FR-005`–`FR-008`, `SC-003`)

1. Create a task on a project assigned to `Sam Rivera` (`...1102`), then drag the card directly from `To Do` to `In Review` (skipping `In Progress`), then move it back to `To Do` or forward to `Done` using either drag-and-drop or the card status selector.
2. Reassign the task to `Alex Morgan` (Product Manager), then set it to **Unassigned** (`assigneeId: null`).
3. **Expected**:
   - All column transitions (forward, backward, skipping) succeed immediately (`<1s`) regardless of which predefined user is active.
   - Reloading the browser preserves the exact column, assignee, and position.

### Scenario 4: Comment Creation & Author-Only Edit/Delete (`FR-009`, `SC-005`)

1. Select **Sam Rivera** (`...1102`) in the active-user switcher and post a comment on a task.
2. Verify Sam Rivera sees **Edit** and **Delete** controls on that comment and successfully updates the text (`200 OK`).
3. Switch the active user to **Jordan Lee** (`...1103`).
4. **Expected**:
   - Edit and Delete controls are hidden for Sam Rivera's comment.
   - Direct API tampering (`PATCH` or `DELETE` on `/api/v1/comments/:id` with `X-Active-User-Id: 11111111-1111-4111-8111-111111111103`) returns `403 FORBIDDEN_NOT_COMMENT_AUTHOR` without modifying the comment.

### Scenario 5: Real-Time SSE Updates & Notifications REST API

1. Open the same project board in two separate browser tabs (`Tab A` as Alex Morgan, `Tab B` as Taylor Kim).
2. In `Tab A`, move a task card to `Done` or post a comment.
3. **Expected**:
   - `Tab B` receives the SSE event on `/api/v1/events/stream` and updates the Kanban board and notification bell automatically within 1 second without manual refresh.
   - `GET http://localhost:3001/api/v1/notifications` lists the newly persisted notification record.
