# `@taskify/api-gateway`

Stateless edge BFF/API gateway (default port `3001`) for Taskify.

## Responsibilities

- Enforces edge Zod schema validation across `/api/v1/*` REST endpoints before forwarding to downstream microservices.
- Strips incoming external `X-Internal-Service-Token` headers and injects the verified shared `INTERNAL_SERVICE_TOKEN` for zero-trust microservice communication.
- Attaches security response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`) and strict CORS headers.
- Hosts the real-time Server-Sent Events (SSE) hub at `GET /api/v1/events/stream` fed by `POST /internal/v1/events`.
- Serves interactive OpenAPI 3.1 docs at `/swagger` and `/swagger/json`.
