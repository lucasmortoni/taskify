# `@taskify/tasks-service`

Microservice owning Kanban tasks and chronological task comments in the isolated `tasks_domain` PostgreSQL schema (default port `3003`).

## Endpoints & Security

- Requires `X-Internal-Service-Token` verified in constant time on all domain routes.
- Independently validates all headers, UUID path params, and JSON payloads with Zod schemas.
- Enforces unrestricted Kanban status transitions (`To Do`, `In Progress`, `In Review`, `Done`), single-assignee (`0..1`) rules, and author-only edit/delete on comments (`403 FORBIDDEN_NOT_COMMENT_AUTHOR`).
- Verifies project existence via `projects-service` and emits domain events to `notifications-service`.
- Serves OpenAPI 3.1 documentation at `/swagger` and `/swagger/json`.
