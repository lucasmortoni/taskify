# Data Model: Taskify Kanban Productivity Platform

**Feature**: [spec.md](spec.md) | **Date**: 2026-11-17 | **Branch**: `feat/taskify-kanban-mvp`

## Architectural Principles

- Each stateful microservice owns its own isolated PostgreSQL schema (`projects_domain`, `tasks_domain`, `notifications_domain`) managed by its own Drizzle ORM configuration and migrations.
- **No cross-service database joins or foreign keys**: Services reference entities from sibling domains solely by immutable UUID identifiers verified through API contracts or predefined roster constants.
- All text fields undergo `.trim()` normalization before non-empty and max-length checks are applied.

---

## Domain 1: `projects-service` (`projects_domain` PostgreSQL schema)

### 1.1 `User` (`projects_domain.users`)

Represents one of the five predefined Phase 1 team members.

| Field | Drizzle / SQL Type | Constraints | Description |
|-------|--------------------|-------------|-------------|
| `id` | `uuid` | PK, NOT NULL | Fixed deterministic UUID for predefined roster |
| `name` | `varchar(100)` | NOT NULL | Full display name (trimmed, 1..100 chars) |
| `role` | `user_role` enum | NOT NULL | `'Product Manager' \| 'Engineer'` |
| `avatarUrl` | `varchar(255)` | NULLABLE | Optional UI avatar path or initials token |
| `createdAt` | `timestamptz` | NOT NULL, default `now()` | Record creation timestamp |

**Predefined Seed Roster (5 Users — `FR-001`)**:

| Fixed UUID | Name | Role |
|------------|------|------|
| `11111111-1111-4111-8111-111111111101` | Alex Morgan | `Product Manager` |
| `11111111-1111-4111-8111-111111111102` | Sam Rivera | `Engineer` |
| `11111111-1111-4111-8111-111111111103` | Jordan Lee | `Engineer` |
| `11111111-1111-4111-8111-111111111104` | Taylor Kim | `Engineer` |
| `11111111-1111-4111-8111-111111111105` | Casey Patel | `Engineer` |

### 1.2 `Project` (`projects_domain.projects`)

Represents a collaborative workspace containing a four-column Kanban board.

| Field | Drizzle / SQL Type | Constraints | Description |
|-------|--------------------|-------------|-------------|
| `id` | `uuid` | PK, NOT NULL, default `gen_random_uuid()` | Project identifier |
| `name` | `varchar(100)` | NOT NULL | Validated project name (trimmed, 1..100 chars) |
| `description` | `varchar(500)` | NULLABLE | Optional project description (trimmed, 0..500 chars) |
| `createdById` | `uuid` | NOT NULL, FK → `users.id` | Active predefined user who created the project |
| `createdAt` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updatedAt` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

**Predefined Seed Projects (3 Sample Projects — `FR-003`)**:
1. `22222222-2222-4222-8222-222222222201` — **Platform Security Audit** (created by Alex Morgan)
2. `22222222-2222-4222-8222-222222222202` — **Mobile App Redesign** (created by Alex Morgan)
3. `22222222-2222-4222-8222-222222222203` — **Q4 Analytics Pipeline** (created by Sam Rivera)

---

## Domain 2: `tasks-service` (`tasks_domain` PostgreSQL schema)

### 2.1 `Task` (`tasks_domain.tasks`)

Represents a single unit of work on a project's Kanban board.

| Field | Drizzle / SQL Type | Constraints | Description |
|-------|--------------------|-------------|-------------|
| `id` | `uuid` | PK, NOT NULL, default `gen_random_uuid()` | Task identifier |
| `projectId` | `uuid` | NOT NULL, indexed (`idx_tasks_project_status`) | External reference to `projects_domain.projects.id` |
| `title` | `varchar(150)` | NOT NULL | Validated task title (trimmed, 1..150 chars) |
| `description` | `varchar(2000)` | NULLABLE | Optional task details (trimmed, 0..2,000 chars) |
| `status` | `task_status` enum | NOT NULL, default `'To Do'` | `'To Do' \| 'In Progress' \| 'In Review' \| 'Done'` |
| `assigneeId` | `uuid` | NULLABLE | Optional `0..1` predefined user UUID (`null` = Unassigned) |
| `createdById` | `uuid` | NOT NULL | Active predefined user UUID who created the task |
| `position` | `integer` | NOT NULL, default `0`, `>= 0` | Ordering index within the task's Kanban column |
| `createdAt` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updatedAt` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

**Kanban Column State Transitions (`FR-005`, `FR-008`)**:
- Allowed states: `To Do`, `In Progress`, `In Review`, `Done`.
- **Unrestricted transitions**: Any of the 5 predefined users may transition any task directly between any two valid columns (forward, backward, or skipping columns) at any time.
- **Unrecognized status rejection**: Any status outside the four canonical values is rejected with `400 VALIDATION_ERROR`.

**Assignment Cardinality & Rules (`FR-007`)**:
- Cardinality is strictly `0..1` (`assigneeId` is either `null` or one of the 5 predefined user UUIDs).
- Any of the 5 predefined users may assign, reassign, or unassign (`null`) any task at any time.
- Seeded with representative sample tasks distributed across all 3 sample projects and all 4 columns (`To Do`, `In Progress`, `In Review`, `Done`).

### 2.2 `Comment` (`tasks_domain.comments`)

Represents a chronological collaboration note on a task card.

| Field | Drizzle / SQL Type | Constraints | Description |
|-------|--------------------|-------------|-------------|
| `id` | `uuid` | PK, NOT NULL, default `gen_random_uuid()` | Comment identifier |
| `taskId` | `uuid` | NOT NULL, indexed (`idx_comments_task_created`), FK → `tasks.id` ON DELETE CASCADE | Parent task |
| `authorId` | `uuid` | NOT NULL | Predefined user UUID of original comment creator |
| `content` | `varchar(1000)` | NOT NULL | Validated comment text (trimmed, 1..1,000 chars) |
| `createdAt` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp (used for chronological ordering) |
| `updatedAt` | `timestamptz` | NOT NULL, default `now()` | Last edited timestamp |

**Comment Ownership & Lifecycle Rules (`FR-009`)**:
- Any of the 5 predefined users may post a comment on any task; `authorId` is always derived server-side from the validated `X-Active-User-Id` header (never trusted from request body).
- **Edit & Delete Ownership**: Only when `X-Active-User-Id === comment.authorId` may a comment be updated (`PATCH`) or deleted (`DELETE`). Requests where `X-Active-User-Id !== comment.authorId` MUST be rejected with `403 FORBIDDEN_NOT_COMMENT_AUTHOR`.

---

## Domain 3: `notifications-service` (`notifications_domain` PostgreSQL schema)

### 3.1 `Notification` (`notifications_domain.notifications`)

Stores domain activity events generated by project, task, and comment mutations and delivers real-time awareness to team members.

| Field | Drizzle / SQL Type | Constraints | Description |
|-------|--------------------|-------------|-------------|
| `id` | `uuid` | PK, NOT NULL, default `gen_random_uuid()` | Notification identifier |
| `projectId` | `uuid` | NOT NULL, indexed (`idx_notifications_project_created`) | Project associated with the event |
| `taskId` | `uuid` | NULLABLE | Task associated with the event (when applicable) |
| `actorId` | `uuid` | NOT NULL | Predefined user UUID who triggered the event |
| `recipientId` | `uuid` | NULLABLE, indexed (`idx_notifications_recipient_read`) | Target user (e.g., assignee) or `null` for team-wide event |
| `type` | `notification_type` enum | NOT NULL | `'PROJECT_CREATED' \| 'TASK_CREATED' \| 'TASK_STATUS_CHANGED' \| 'TASK_ASSIGNED' \| 'COMMENT_CREATED' \| 'COMMENT_UPDATED' \| 'COMMENT_DELETED'` |
| `message` | `varchar(500)` | NOT NULL | Human-readable summary (trimmed, 1..500 chars) |
| `isRead` | `boolean` | NOT NULL, default `false` | Read status flag |
| `createdAt` | `timestamptz` | NOT NULL, default `now()` | Event timestamp |

---

## Cross-Cutting Validation Rules (`FR-010`)

| Field / Input | Rule | Rejection Behavior |
|---------------|------|--------------------|
| `X-Active-User-Id` header | Required valid UUID matching one of the 5 predefined users on all mutating and user-scoped endpoints | `400 VALIDATION_ERROR` (malformed/missing) or `400 INVALID_USER` (unknown user ID) |
| `X-Internal-Service-Token` header | Required constant-time match on all downstream service endpoints and `/internal/*` routes | `401 UNAUTHORIZED_SERVICE` |
| `Project.name` | Trimmed non-empty string, `1..100` chars | `400 VALIDATION_ERROR` |
| `Project.description` | Optional string; if non-null, trimmed `0..500` chars | `400 VALIDATION_ERROR` |
| `Task.title` | Trimmed non-empty string, `1..150` chars | `400 VALIDATION_ERROR` |
| `Task.description` | Optional string; if non-null, trimmed `0..2000` chars | `400 VALIDATION_ERROR` |
| `Task.status` | Exact match in `['To Do', 'In Progress', 'In Review', 'Done']` | `400 VALIDATION_ERROR` |
| `Task.assigneeId` | `null` or valid UUID in the 5 predefined user IDs | `400 VALIDATION_ERROR` |
| `Task.position` | Integer `>= 0` | `400 VALIDATION_ERROR` |
| `Comment.content` | Trimmed non-empty string, `1..1000` chars | `400 VALIDATION_ERROR` |
| Path IDs (`:projectId`, `:taskId`, `:commentId`, `:notificationId`) | Valid UUID v4 format | `400 VALIDATION_ERROR` |

## Entity Relationship Diagram (Logical — Enforced via Service APIs)

```text
projects_domain.users (5 predefined)
   ├── 1:N (createdById) ──▶ projects_domain.projects
   │                              │
   │                              │ (logical projectId via REST API)
   │                              ▼
   ├── 0..N (assigneeId) ──▶ tasks_domain.tasks ── 1:N (taskId, cascade) ──▶ tasks_domain.comments
   │                              ▲                                                  ▲
   └──────────────────────────────┴────────────── (authorId / actorId) ──────────────┘
                                                  │
                                                  ▼ (async HTTP event)
                                  notifications_domain.notifications
```
