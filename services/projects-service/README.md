# `@taskify/projects-service`

Microservice owning predefined Phase 1 users and Taskify projects in the isolated `projects_domain` PostgreSQL schema (default port `3002`).

## Endpoints & Security

- Requires `X-Internal-Service-Token` verified in constant time on all domain routes.
- Independently validates all path parameters, `X-Active-User-Id` headers, and payloads via Zod schemas.
- Emits `PROJECT_CREATED` domain events to `notifications-service` over authenticated HTTP.
- Serves OpenAPI 3.1 documentation at `/swagger` and `/swagger/json`.
