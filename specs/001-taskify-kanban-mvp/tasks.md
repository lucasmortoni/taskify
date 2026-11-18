---

description: "Dependency-ordered implementation task list for Taskify Kanban Productivity Platform (Phase 1 MVP)"
---

# Tasks: Taskify Kanban Productivity Platform (Phase 1 MVP)

**Input**: Design documents from `/specs/001-taskify-kanban-mvp/`

**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (required), [research.md](research.md), [data-model.md](data-model.md), [rest-api.md](contracts/rest-api.md), [quickstart.md](quickstart.md)

**Tests**: Core contract, integration, and end-to-end Playwright tests from `plan.md` and `quickstart.md` are scheduled in the Polish & Cross-Cutting Concerns phase (and optional per-story verification steps are noted at each checkpoint).

**Organization**: Tasks are grouped by user story in priority order (`P1` → `P2`) so each story can be implemented, tested, and demonstrated as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`) — omitted for Setup, Foundational, and Polish phases
- Exact file paths are specified in every task description

## Path Conventions

- `packages/shared/`: Shared Zod DTOs, predefined roster constants, and security utilities
- `services/api-gateway/`: Edge ElysiaJS gateway (port `3001`), dual-layer validation, SSE hub
- `services/projects-service/`: Projects & Users microservice (port `3002`, schema `projects_domain`)
- `services/tasks-service/`: Tasks & Comments microservice (port `3003`, schema `tasks_domain`)
- `services/notifications-service/`: Notifications microservice (port `3004`, schema `notifications_domain`)
- `apps/web/`: TanStack Start React SSR frontend (port `3000`)
- `tests/`: Contract, cross-service integration, and Playwright E2E test suites

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Bun workspaces monorepo, PostgreSQL 16 Docker configuration, service manifests, and formatting/linting baseline.

- [X] T001 Create Bun workspace root manifest (including `dev`, `test`, `test:e2e`, `db:migrate`, `db:seed`, `lint`, `typecheck` scripts) and shared TypeScript compiler configuration in `package.json` and `tsconfig.base.json`
- [X] T002 Create PostgreSQL 16 service orchestration and environment template in `docker-compose.yml` and `.env.example`
- [X] T003 [P] Initialize shared contracts package manifest, TypeScript config, and package README in `packages/shared/package.json`, `packages/shared/tsconfig.json`, and `packages/shared/README.md`
- [X] T004 [P] Initialize backend microservice manifests, TypeScript configs, Drizzle configs, and service READMEs in `services/api-gateway/package.json`, `services/projects-service/package.json`, `services/tasks-service/package.json`, `services/notifications-service/package.json`, `services/projects-service/drizzle.config.ts`, `services/tasks-service/drizzle.config.ts`, `services/notifications-service/drizzle.config.ts`, and per-service `README.md` files
- [X] T005 [P] Initialize TanStack Start React SSR workspace manifest, app config, TypeScript config, and frontend README in `apps/web/package.json`, `apps/web/app.config.ts`, `apps/web/tsconfig.json`, and `apps/web/README.md`
- [X] T006 [P] Configure workspace code formatting and linting rules in `biome.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared Zod schemas, security/zero-trust guards, isolated PostgreSQL Drizzle clients, the notifications/events backbone, API gateway security/SSE infrastructure, and the React SSR shell.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Implement predefined 5-user roster constants (1 Product Manager, 4 Engineers), Kanban column status enums (`To Do`, `In Progress`, `In Review`, `Done`), and notification type enums in `packages/shared/src/constants/users.ts`
- [X] T008 [P] Implement constant-time `X-Internal-Service-Token` validation, predefined `X-Active-User-Id` verification, and sanitized error envelope helpers in `packages/shared/src/security/index.ts`
- [X] T009 [P] Implement common Zod schemas for UUID path parameters, `X-Active-User-Id` headers, standard error responses, and internal domain events in `packages/shared/src/schemas/common.ts`
- [X] T010 [P] Create PostgreSQL schema initialization scripts (`projects_domain`, `tasks_domain`, `notifications_domain`) and isolated Drizzle ORM clients in `docker/postgres/init-schemas.sql`, `services/projects-service/src/db/client.ts`, `services/tasks-service/src/db/client.ts`, and `services/notifications-service/src/db/client.ts`
- [X] T011 Implement Zero-Trust `X-Internal-Service-Token` middleware (`401 UNAUTHORIZED_SERVICE`) and boundary error sanitizers across microservices in `services/projects-service/src/middleware/auth.ts`, `services/tasks-service/src/middleware/auth.ts`, and `services/notifications-service/src/middleware/auth.ts`
- [X] T012 [P] Define `notifications_domain.notifications` Drizzle schema and Zod contracts per `data-model.md` (`Notification.id`, `Notification.projectId`, `Notification.taskId`, `Notification.actorId`, `Notification.recipientId`, `Notification.type`, `Notification.message`, `Notification.isRead`, `Notification.createdAt`) in `services/notifications-service/src/db/schema.ts`, `services/notifications-service/src/db/migrations/`, and `packages/shared/src/schemas/notification.ts`
- [X] T013 Implement `notifications-service` ElysiaJS server with `POST /internal/v1/events`, `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:notificationId/read`, gateway SSE forwarder, and `@elysiajs/swagger` OpenAPI docs in `services/notifications-service/src/routes/notifications.ts` and `services/notifications-service/src/index.ts`
- [X] T014 Implement `api-gateway` ElysiaJS bootstrap with security headers (`X-Content-Type-Options`, `X-Frame-Options`, CORS), edge Zod validation/error sanitization, SSE subscriber hub (`GET /api/v1/events/stream`, `POST /internal/v1/events`), and notification proxy routes in `services/api-gateway/src/index.ts`, `services/api-gateway/src/middleware/security.ts`, `services/api-gateway/src/sse/hub.ts`, and `services/api-gateway/src/routes/notifications.ts`
- [X] T015 [P] Implement TanStack Start root route, React Query provider, active-user context (`X-Active-User-Id`), typed API client, and SSE `EventSource` subscription hook in `apps/web/app/routes/__root.tsx`, `apps/web/app/lib/api-client.ts`, and `apps/web/app/hooks/useRealtimeEvents.ts`

**Checkpoint**: Foundation ready — `projects-service`, `tasks-service`, `api-gateway`, and `apps/web` user story phases can now proceed.

---

## Phase 3: User Story 1 - Browse Sample Projects and Create New Projects (Priority: P1) 🎯 MVP

**Goal**: Enable predefined users to open Taskify with zero login steps, switch between the 5 predefined team members (1 Product Manager, 4 Engineers), browse the 3 seeded sample projects, and create new validated projects.

**Independent Test**: Open `http://localhost:3000` with no login barrier, verify all 5 predefined users and 3 sample projects load immediately, switch active users, submit an invalid/whitespace project name (expecting `400 VALIDATION_ERROR`), and create a valid project that appears immediately in the workspace and persists across reloads.

### Implementation for User Story 1

- [X] T016 [P] [US1] Define `projects_domain.users` and `projects_domain.projects` Drizzle schemas per `data-model.md` (`User.id`, `User.name`, `User.role`, `User.avatarUrl`, `User.createdAt`, `Project.id`, `Project.name`, `Project.description`, `Project.createdById`, `Project.createdAt`, `Project.updatedAt`) in `services/projects-service/src/db/schema.ts`
- [X] T017 [P] [US1] Define shared Zod DTOs for users and project creation/retrieval per `data-model.md` (`User.id`, `User.name`, `User.role`, `User.avatarUrl`, `User.createdAt`, `Project.id`, `Project.name`, `Project.description`, `Project.createdById`, `Project.createdAt`, `Project.updatedAt`) in `packages/shared/src/schemas/project.ts`
- [X] T018 [US1] Generate Drizzle migration and implement idempotent seed script for the 5 predefined users and 3 sample projects in `services/projects-service/src/db/migrations/` and `services/projects-service/src/db/seed.ts`
- [X] T019 [US1] Implement `projects-service` ElysiaJS routes (`GET /users`, `GET /projects`, `POST /projects`, `GET /projects/:projectId`) with Zod boundary validation, `PROJECT_CREATED` event dispatch to `notifications-service`, and `@elysiajs/swagger` OpenAPI docs in `services/projects-service/src/routes/projects.ts` and `services/projects-service/src/index.ts`
- [X] T020 [US1] Implement `api-gateway` project and user proxy routes (`/api/v1/users`, `/api/v1/projects`, `/api/v1/projects/:projectId`) with edge Zod validation and `X-Internal-Service-Token` injection in `services/api-gateway/src/routes/projects.ts`
- [X] T021 [P] [US1] Create `UserSwitcher` (zero-login 5-user selector) and `ProjectList` navigation components in `apps/web/app/components/UserSwitcher.tsx` and `apps/web/app/components/ProjectList.tsx`
- [X] T022 [P] [US1] Create `CreateProjectModal` component with client-side Zod form validation and sanitized server error feedback in `apps/web/app/components/CreateProjectModal.tsx`
- [X] T023 [P] [US1] Create `NotificationBell` component displaying recent team activity notifications and mark-as-read controls in `apps/web/app/components/NotificationBell.tsx`
- [X] T024 [US1] Implement TanStack Start workspace landing route and `@tanstack/react-query` hooks (`useUsers`, `useProjects`, `useCreateProject`) in `apps/web/app/routes/index.tsx` and `apps/web/app/hooks/useProjects.ts`

**Checkpoint**: User Story 1 is complete and independently verifiable as the Phase 1 project workspace MVP.

---

## Phase 4: User Story 2 - Create, Assign, and Move Tasks Across Kanban Columns (Priority: P1)

**Goal**: Enable any predefined user to create tasks within a project, assign/reassign/unassign a single user (`0..1` among all 5 predefined users), and move task cards freely across `To Do`, `In Progress`, `In Review`, and `Done` with drag-and-drop and real-time persistence.

**Independent Test**: Open any sample or newly created project, create a task, assign it to an Engineer or the Product Manager (and verify setting to Unassigned), drag and move the card freely across adjacent, non-adjacent, and backward Kanban columns (`To Do` → `In Review` → `To Do` → `Done`), confirm `<1s` UI update + persistence on reload, and verify multi-tab SSE board sync.

### Implementation for User Story 2

- [X] T025 [P] [US2] Define `tasks_domain.tasks` Drizzle schema per `data-model.md` (`Task.id`, `Task.projectId`, `Task.title`, `Task.description`, `Task.status`, `Task.assigneeId`, `Task.createdById`, `Task.position`, `Task.createdAt`, `Task.updatedAt`) in `services/tasks-service/src/db/schema.ts`
- [X] T026 [P] [US2] Define shared Zod DTOs for task creation and partial task updates (`0..1` assignee, unrestricted status transitions) per `data-model.md` (`Task.id`, `Task.projectId`, `Task.title`, `Task.description`, `Task.status`, `Task.assigneeId`, `Task.createdById`, `Task.position`, `Task.createdAt`, `Task.updatedAt`) in `packages/shared/src/schemas/task.ts`
- [X] T027 [US2] Generate Drizzle migration and implement idempotent starter tasks seed across the 3 sample projects and all 4 Kanban columns in `services/tasks-service/src/db/migrations/` and `services/tasks-service/src/db/seed.ts`
- [X] T028 [US2] Implement `tasks-service` task endpoints (`GET /projects/:projectId/tasks`, `POST /projects/:projectId/tasks`, `GET /tasks/:taskId`, `PATCH /tasks/:taskId`) verifying `:projectId` via `projects-service`, enforcing Zod validation, emitting `TASK_CREATED`/`TASK_STATUS_CHANGED`/`TASK_ASSIGNED` events, and exposing `@elysiajs/swagger` OpenAPI docs in `services/tasks-service/src/routes/tasks.ts` and `services/tasks-service/src/index.ts`
- [X] T029 [US2] Implement `api-gateway` task proxy routes (`/api/v1/projects/:projectId/tasks`, `/api/v1/tasks/:taskId`) with edge Zod validation and `X-Internal-Service-Token` injection in `services/api-gateway/src/routes/tasks.ts`
- [X] T030 [P] [US2] Create `KanbanBoard` and `TaskCard` components using `@dnd-kit/core` and `@dnd-kit/sortable` with four fixed columns (`To Do`, `In Progress`, `In Review`, `Done`), drag-and-drop transitions, and accessible status/assignee controls in `apps/web/app/components/KanbanBoard.tsx` and `apps/web/app/components/TaskCard.tsx`
- [X] T031 [P] [US2] Create `CreateTaskModal` component with Zod validation and single-assignee (`0..1`) selector across the 5 predefined users in `apps/web/app/components/CreateTaskModal.tsx`
- [X] T032 [US2] Implement React Query task hooks with optimistic column move/assignment mutations and SSE board cache synchronization in `apps/web/app/hooks/useTasks.ts`
- [X] T033 [US2] Implement project Kanban board SSR route integrating `KanbanBoard`, `TaskCard`, `CreateTaskModal`, and live SSE updates in `apps/web/app/routes/projects.$projectId.tsx`

**Checkpoint**: User Stories 1 and 2 work end-to-end — complete Kanban project and task management is operational.

---

## Phase 5: User Story 3 - Comment on Tasks for Team Collaboration (Priority: P2)

**Goal**: Enable any predefined user to view chronological comments on a task, post validated comments attributed to the active user, and edit or delete exclusively their own comments.

**Independent Test**: Open a task detail modal as User A, post a comment, verify Edit and Delete controls succeed (`200 OK`), switch active user to User B, verify Edit/Delete controls are absent for User A's comment and direct `PATCH`/`DELETE` requests as User B return `403 FORBIDDEN_NOT_COMMENT_AUTHOR`.

### Implementation for User Story 3

- [X] T034 [P] [US3] Add `tasks_domain.comments` Drizzle schema with cascade FK to `tasks.id` and generate Drizzle migration per `data-model.md` (`Comment.id`, `Comment.taskId`, `Comment.authorId`, `Comment.content`, `Comment.createdAt`, `Comment.updatedAt`) in `services/tasks-service/src/db/schema.ts` and `services/tasks-service/src/db/migrations/`
- [X] T035 [P] [US3] Define shared Zod DTOs for comment creation and updates per `data-model.md` (`Comment.id`, `Comment.taskId`, `Comment.authorId`, `Comment.content`, `Comment.createdAt`, `Comment.updatedAt`) in `packages/shared/src/schemas/comment.ts`
- [X] T036 [US3] Implement comment author ownership guard (`403 FORBIDDEN_NOT_COMMENT_AUTHOR` when `X-Active-User-Id !== comment.authorId`) in `services/tasks-service/src/middleware/ownership.ts`
- [X] T037 [US3] Implement `tasks-service` comment routes (`POST /tasks/:taskId/comments`, `PATCH /comments/:commentId`, `DELETE /comments/:commentId`), chronological ordering in `GET /tasks/:taskId`, and `COMMENT_CREATED`/`COMMENT_UPDATED`/`COMMENT_DELETED` event emission in `services/tasks-service/src/routes/comments.ts` and `services/tasks-service/src/routes/tasks.ts`
- [X] T038 [US3] Implement `api-gateway` comment proxy routes (`/api/v1/tasks/:taskId/comments`, `/api/v1/comments/:commentId`) with edge Zod validation in `services/api-gateway/src/routes/comments.ts`
- [X] T039 [P] [US3] Create `TaskModal` and `CommentThread` components displaying chronological comment history, Zod-validated comment composer, and author-only Edit/Delete actions in `apps/web/app/components/TaskModal.tsx` and `apps/web/app/components/CommentThread.tsx`
- [X] T040 [US3] Implement comment React Query hooks (`useTaskDetail`, `useCreateComment`, `useUpdateComment`, `useDeleteComment`) with real-time `comment.changed` SSE sync and wire `TaskModal` into the board route in `apps/web/app/hooks/useComments.ts` and `apps/web/app/routes/projects.$projectId.tsx`

**Checkpoint**: All three user stories (`US1`, `US2`, `US3`) are complete and independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ensure Constitution documentation compliance, verify dual-layer security/validation contracts, run automated E2E verification, and validate `quickstart.md`.

- [X] T041 [P] Complete JSDoc/TSDoc docstrings (inputs, outputs, error conditions, security assumptions), Swagger route annotations, and service-level README guides across `packages/shared/`, `services/*/`, and `apps/web/`
- [X] T042 [P] Implement boundary Zod validation tests, `401 UNAUTHORIZED_SERVICE` zero-trust boundary tests, `403 FORBIDDEN_NOT_COMMENT_AUTHOR` ownership tests, and cross-service workflow integration tests in `tests/contract/validation-and-auth.test.ts` and `tests/integration/workflow.test.ts`
- [X] T043 Implement Playwright E2E test suite verifying 5 predefined users, 3 sample projects, zero-login load, Kanban drag-and-drop transitions, single-assignee updates, author-only comment edits/deletes, and SSE real-time sync in `tests/e2e/taskify-kanban.spec.ts`
- [X] T044 Execute full `quickstart.md` scenarios, `bun test`, and `bun run test:e2e` against the running stack and verify all outputs in `specs/001-taskify-kanban-mvp/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS** all user stories (`US1`, `US2`, `US3`).
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational (Phase 2) completion — establishes predefined users, sample projects, and workspace shell.
- **User Story 2 (Phase 4 - P1)**: Depends on Foundational (Phase 2) and integrates with `projects-service` project lookup from `US1` (`T019`). Schema/DTO/component tasks (`T025`, `T026`, `T030`, `T031`) can start in parallel right after Phase 2.
- **User Story 3 (Phase 5 - P2)**: Depends on Foundational (Phase 2) and `tasks` table/routes from `US2` (`T025`, `T028`). Zod DTO (`T035`) and UI components (`T039`) can start in parallel.
- **Polish (Phase 6)**: Depends on completion of `US1`, `US2`, and `US3`.

### Within Each User Story

- Drizzle schemas and shared Zod DTOs (`[P]`) before database migrations/seeds
- Migrations/seeds before service route handlers
- Microservice route handlers before `api-gateway` proxy routes
- Frontend UI components (`[P]`) and React Query hooks before route integration

### Parallel Opportunities

- **Setup**: `T003`, `T004`, `T005`, `T006` run concurrently after `T001`–`T002`.
- **Foundational**: `T008`, `T009`, `T010`, `T012`, `T015` execute in parallel across `packages/shared`, DB clients, and `apps/web`.
- **US1**: `T016` + `T017` (backend schemas/Zod DTOs) and `T021` + `T022` + `T023` (frontend UI components) run concurrently.
- **US2**: `T025` + `T026` (task Drizzle schema + Zod DTOs) and `T030` + `T031` (`KanbanBoard`/`TaskCard` + `CreateTaskModal`) run concurrently.
- **US3**: `T034` + `T035` + `T039` execute in parallel before service/gateway wiring.
- **Polish**: `T041` (docs/docstrings) and `T042` (contract/integration tests) execute in parallel.

---

## Parallel Examples per User Story

### User Story 1 Parallel Batch

```text
T016 [US1] Drizzle schemas (users, projects) in services/projects-service/src/db/schema.ts
T017 [US1] Zod DTOs (users, projects) in packages/shared/src/schemas/project.ts
T021 [US1] UserSwitcher & ProjectList UI in apps/web/app/components/UserSwitcher.tsx & ProjectList.tsx
T022 [US1] CreateProjectModal UI in apps/web/app/components/CreateProjectModal.tsx
T023 [US1] NotificationBell UI in apps/web/app/components/NotificationBell.tsx
```

### User Story 2 Parallel Batch

```text
T025 [US2] Drizzle schema (tasks) in services/tasks-service/src/db/schema.ts
T026 [US2] Zod DTOs (tasks) in packages/shared/src/schemas/task.ts
T030 [US2] KanbanBoard & TaskCard UI in apps/web/app/components/KanbanBoard.tsx & TaskCard.tsx
T031 [US2] CreateTaskModal UI in apps/web/app/components/CreateTaskModal.tsx
```

### User Story 3 Parallel Batch

```text
T034 [US3] Drizzle schema + migration (comments) in services/tasks-service/src/db/schema.ts
T035 [US3] Zod DTOs (comments) in packages/shared/src/schemas/comment.ts
T039 [US3] TaskModal & CommentThread UI in apps/web/app/components/TaskModal.tsx & CommentThread.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 → User Story 2)

1. Complete **Phase 1: Setup** (`T001`–`T006`) and **Phase 2: Foundational** (`T007`–`T015`).
2. Complete **Phase 3: User Story 1** (`T016`–`T024`) and validate independently (5 predefined users, 3 sample projects, zero-login project creation & notifications).
3. Complete **Phase 4: User Story 2** (`T025`–`T033`) to deliver full drag-and-drop Kanban task management across `To Do`, `In Progress`, `In Review`, and `Done`.

### Incremental Delivery

1. **Increment 1**: Setup + Foundational + US1 (`T001`–`T024`) → Navigable zero-login team workspace with seeded users & sample projects.
2. **Increment 2**: Add US2 (`T025`–`T033`) → Interactive Kanban board, single-assignee management, and real-time SSE sync.
3. **Increment 3**: Add US3 (`T034`–`T040`) → Task discussion threads with author-only edit/delete enforcement.
4. **Increment 4**: Polish (`T041`–`T044`) → Full JSDoc/OpenAPI documentation audit, security contract tests, and Playwright E2E validation.
