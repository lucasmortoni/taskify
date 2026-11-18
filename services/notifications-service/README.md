# `@taskify/notifications-service`

Microservice owning team activity notifications in the isolated `notifications_domain` PostgreSQL schema (default port `3004`).

## Endpoints & Security

- Requires `X-Internal-Service-Token` verified in constant time on all `/internal/v1/events` and `/notifications` routes.
- Persists validated domain events emitted by `projects-service` and `tasks-service`, and pushes real-time notifications to `api-gateway` SSE subscribers.
- Serves OpenAPI 3.1 documentation at `/swagger` and `/swagger/json`.
