# REST & Real-Time API Contracts: Taskify Phase 1

**Feature**: [spec.md](../spec.md) | **Data Model**: [data-model.md](../data-model.md) | **Date**: 2026-11-17

All external client traffic enters through `api-gateway` (default base URL `http://localhost:3001`) under `/api/v1/*`, which enforces Zod schema validation at the edge before forwarding requests over authenticated service boundaries (`X-Internal-Service-Token`). Every downstream microservice (`projects-service`, `tasks-service`, `notifications-service`) exposes OpenAPI 3.1 docs via `@elysiajs/swagger` and independently re-validates all inputs.

---

## 1. Global Headers & Error Envelope

### Request Headers

| Header | Scope | Required | Description |
|--------|-------|----------|-------------|
| `Content-Type` | All `POST`/`PATCH` endpoints | Yes | Must be `application/json` |
| `X-Active-User-Id` | All mutating REST endpoints (`POST`, `PATCH`, `DELETE`) & optional on `GET` | Yes (mutations) | UUID of one of the 5 predefined users acting in the current session |
| `X-Internal-Service-Token` | All microservice-to-microservice & `/internal/*` calls | Yes (internal) | Shared secret verified via constant-time comparison; stripped/injected by gateway |

### Standard Error Response Envelope

All validation, authorization, and missing-resource failures return JSON without stack traces or internal infrastructure details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description of the validation or permission error",
    "details": [
      {
        "field": "name",
        "reason": "Must be between 1 and 100 characters after trimming"
      }
    ]
  }
}
```

| HTTP Status | Error Code | Trigger |
|-------------|------------|---------|
| `400` | `VALIDATION_ERROR` | Malformed UUID, missing required field, whitespace-only text, out-of-range length, invalid Kanban column status |
| `400` | `INVALID_USER` | `X-Active-User-Id` or `assigneeId` does not match one of the 5 predefined users |
| `401` | `UNAUTHORIZED_SERVICE` | Missing or invalid `X-Internal-Service-Token` on microservice boundary |
| `403` | `FORBIDDEN_NOT_COMMENT_AUTHOR` | `PATCH` or `DELETE` on `/api/v1/comments/:commentId` where `X-Active-User-Id !== comment.authorId` |
| `404` | `NOT_FOUND` | Referenced project, task, comment, or notification does not exist |

---

## 2. Projects & Users Service Contracts (`projects-service`)

### `GET /api/v1/users`

Returns the 5 predefined Phase 1 users (1 Product Manager, 4 Engineers).

- **Response `200 OK`**:
```json
{
  "users": [
    {
      "id": "11111111-1111-4111-8111-111111111101",
      "name": "Alex Morgan",
      "role": "Product Manager",
      "avatarUrl": null,
      "createdAt": "2026-11-17T00:00:00.000Z"
    }
  ]
}
```

### `GET /api/v1/projects`

Lists all projects (ordered newest first or seed order), including the 3 pre-populated sample projects.

- **Response `200 OK`**:
```json
{
  "projects": [
    {
      "id": "22222222-2222-4222-8222-222222222201",
      "name": "Platform Security Audit",
      "description": "Hardening input schemas and service boundaries across Taskify.",
      "createdById": "11111111-1111-4111-8111-111111111101",
      "createdAt": "2026-11-17T00:00:00.000Z",
      "updatedAt": "2026-11-17T00:00:00.000Z"
    }
  ]
}
```

### `POST /api/v1/projects`

Creates a new project attributed to `X-Active-User-Id`.

- **Headers**: `X-Active-User-Id` (required)
- **Request Body**:
```json
{
  "name": "Q1 Customer Portal",
  "description": "Kanban workspace for Q1 portal deliverables."
}
```
  - `name`: string, trimmed non-empty (`1..100` chars)
  - `description`: optional string or `null`, trimmed (`0..500` chars)
- **Response `201 Created`**: Returns `{ "project": { ... } }`
- **Side Effect**: Emits `PROJECT_CREATED` event to `notifications-service` (`POST /internal/v1/events`) and SSE stream.

### `GET /api/v1/projects/:projectId`

Fetches metadata for a single project (`400 VALIDATION_ERROR` if `:projectId` is not UUID v4; `404 NOT_FOUND` if missing).

- **Response `200 OK`**: `{ "project": { ... } }`

---

## 3. Tasks & Comments Service Contracts (`tasks-service`)

### `GET /api/v1/projects/:projectId/tasks`

Lists all tasks belonging to `:projectId`, ordered by Kanban column and `position`, including comment counts per task.

- **Verification**: Confirms `:projectId` exists via `projects-service` before returning tasks (`404 NOT_FOUND` if missing).
- **Response `200 OK`**:
```json
{
  "projectId": "22222222-2222-4222-8222-222222222201",
  "tasks": [
    {
      "id": "33333333-3333-4333-8333-333333333301",
      "projectId": "22222222-2222-4222-8222-222222222201",
      "title": "Enforce Zod validation at task boundary",
      "description": "Add strict schema checking for status and assignee fields.",
      "status": "In Progress",
      "assigneeId": "11111111-1111-4111-8111-111111111102",
      "createdById": "11111111-1111-4111-8111-111111111101",
      "position": 0,
      "commentCount": 2,
      "createdAt": "2026-11-17T00:00:00.000Z",
      "updatedAt": "2026-11-17T00:05:00.000Z"
    }
  ]
}
```

### `POST /api/v1/projects/:projectId/tasks`

Creates a new task inside `:projectId`.

- **Headers**: `X-Active-User-Id` (required)
- **Request Body**:
```json
{
  "title": "Add SSE reconnect backoff",
  "description": "Handle transient network disconnects gracefully.",
  "status": "To Do",
  "assigneeId": "11111111-1111-4111-8111-111111111103"
}
```
  - `title`: string, trimmed non-empty (`1..150` chars)
  - `description`: optional string or `null`, trimmed (`0..2000` chars)
  - `status`: optional enum (`'To Do' | 'In Progress' | 'In Review' | 'Done'`), defaults to `'To Do'`
  - `assigneeId`: optional `null` or UUID in predefined 5 users (`0..1` assignee)
- **Response `201 Created`**: `{ "task": { ... } }`
- **Side Effect**: Emits `TASK_CREATED` (and `TASK_ASSIGNED` if `assigneeId` is set) event to `notifications-service` and SSE stream.

### `GET /api/v1/tasks/:taskId`

Returns task details along with all comments ordered chronologically (`createdAt ASC`).

- **Response `200 OK`**:
```json
{
  "task": {
    "id": "33333333-3333-4333-8333-333333333301",
    "projectId": "22222222-2222-4222-8222-222222222201",
    "title": "Enforce Zod validation at task boundary",
    "description": "Add strict schema checking for status and assignee fields.",
    "status": "In Progress",
    "assigneeId": "11111111-1111-4111-8111-111111111102",
    "createdById": "11111111-1111-4111-8111-111111111101",
    "position": 0,
    "createdAt": "2026-11-17T00:00:00.000Z",
    "updatedAt": "2026-11-17T00:05:00.000Z"
  },
  "comments": [
    {
      "id": "44444444-4444-4444-8444-444444444401",
      "taskId": "33333333-3333-4333-8333-333333333301",
      "authorId": "11111111-1111-4111-8111-111111111102",
      "content": "Schemas are ready for review.",
      "createdAt": "2026-11-17T00:06:00.000Z",
      "updatedAt": "2026-11-17T00:06:00.000Z"
    }
  ]
}
```

### `PATCH /api/v1/tasks/:taskId`

Updates task column status (unrestricted across `To Do`, `In Progress`, `In Review`, `Done`), single assignee (`assigneeId` UUID or `null` to unassign), `position`, `title`, or `description`.

- **Headers**: `X-Active-User-Id` (required)
- **Request Body** (at least one updatable field required):
```json
{
  "status": "In Review",
  "assigneeId": null,
  "position": 0
}
```
- **Response `200 OK`**: `{ "task": { ... } }`
- **Side Effect**: Emits `TASK_STATUS_CHANGED` and/or `TASK_ASSIGNED` events to `notifications-service` and SSE stream.

### `POST /api/v1/tasks/:taskId/comments`

Posts a new comment on `:taskId`. Author is always set to `X-Active-User-Id`.

- **Headers**: `X-Active-User-Id` (required)
- **Request Body**:
```json
{
  "content": "Verified boundary validation against malformed payloads."
}
```
  - `content`: string, trimmed non-empty (`1..1000` chars)
- **Response `201 Created`**: `{ "comment": { ... } }`
- **Side Effect**: Emits `COMMENT_CREATED` event to `notifications-service` and SSE stream.

### `PATCH /api/v1/comments/:commentId`

Edits an existing comment. Only permitted when `X-Active-User-Id === comment.authorId`.

- **Headers**: `X-Active-User-Id` (required)
- **Request Body**:
```json
{
  "content": "Updated verification note after final check."
}
```
- **Responses**:
  - `200 OK`: `{ "comment": { ... } }`
  - `403 FORBIDDEN_NOT_COMMENT_AUTHOR`: Active user is not the original comment author
  - `404 NOT_FOUND`: Comment does not exist
- **Side Effect**: Emits `COMMENT_UPDATED` event to `notifications-service` and SSE stream.

### `DELETE /api/v1/comments/:commentId`

Deletes an existing comment. Only permitted when `X-Active-User-Id === comment.authorId`.

- **Headers**: `X-Active-User-Id` (required)
- **Responses**:
  - `200 OK`: `{ "deletedId": "44444444-4444-4444-8444-444444444401", "taskId": "..." }`
  - `403 FORBIDDEN_NOT_COMMENT_AUTHOR`: Active user is not the original comment author
  - `404 NOT_FOUND`: Comment does not exist
- **Side Effect**: Emits `COMMENT_DELETED` event to `notifications-service` and SSE stream.

---

## 4. Notifications & Real-Time Event Contracts (`notifications-service` + `api-gateway`)

### `GET /api/v1/notifications`

Lists recent activity notifications ordered by `createdAt DESC`.

- **Query Parameters**:
  - `projectId` (optional UUID): Filter to a single project
  - `recipientId` (optional UUID): Filter to notifications targeted at a specific user (or global events)
  - `unreadOnly` (optional boolean string `'true' | 'false'`): Filter to unread notifications
  - `limit` (optional integer `1..100`, default `30`)
- **Response `200 OK`**:
```json
{
  "notifications": [
    {
      "id": "55555555-5555-4555-8555-555555555501",
      "projectId": "22222222-2222-4222-8222-222222222201",
      "taskId": "33333333-3333-4333-8333-333333333301",
      "actorId": "11111111-1111-4111-8111-111111111101",
      "recipientId": "11111111-1111-4111-8111-111111111102",
      "type": "TASK_ASSIGNED",
      "message": "Alex Morgan assigned \"Enforce Zod validation at task boundary\" to Sam Rivera",
      "isRead": false,
      "createdAt": "2026-11-17T00:05:00.000Z"
    }
  ]
}
```

### `PATCH /api/v1/notifications/:notificationId/read`

Marks a notification as read (`isRead: true`).

- **Headers**: `X-Active-User-Id` (required)
- **Response `200 OK`**: `{ "notification": { ... } }`

### `POST /internal/v1/events` *(Internal Microservice Boundary)*

Receives validated domain events from `projects-service` and `tasks-service`, persists a `Notification` record in `notifications_domain`, and publishes the live event to `api-gateway` SSE subscribers.

- **Headers**: `X-Internal-Service-Token` (required)
- **Request Body**:
```json
{
  "eventId": "66666666-6666-4666-8666-666666666601",
  "type": "TASK_STATUS_CHANGED",
  "projectId": "22222222-2222-4222-8222-222222222201",
  "taskId": "33333333-3333-4333-8333-333333333301",
  "actorId": "11111111-1111-4111-8111-111111111102",
  "recipientId": "11111111-1111-4111-8111-111111111101",
  "message": "Sam Rivera moved \"Enforce Zod validation at task boundary\" to In Review",
  "payload": {
    "status": "In Review",
    "previousStatus": "In Progress"
  }
}
```
- **Response `202 Accepted`**: `{ "accepted": true, "notificationId": "..." }`

### `GET /api/v1/events/stream` *(Server-Sent Events)*

Persistent HTTP `text/event-stream` endpoint on `api-gateway` pushing real-time board & notification updates to active TanStack Start clients.

- **Query Parameters**: `projectId` (optional UUID filter)
- **Emitted Event Frames**:
  - `event: project.created`
  - `event: task.created`
  - `event: task.updated`
  - `event: comment.changed`
  - `event: notification.created`
- **Sample Frame**:
```text
event: task.updated
data: {"projectId":"22222222-2222-4222-8222-222222222201","taskId":"33333333-3333-4333-8333-333333333301","status":"In Review","actorId":"11111111-1111-4111-8111-111111111102"}

```
