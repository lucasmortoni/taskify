# `@taskify/shared`

Shared Zod DTO contracts, predefined Phase 1 user roster constants, Kanban column enums, security utilities, and OpenAPI Swagger helper for all Taskify microservices and the TanStack Start web app.

## Contents

- `src/constants/users.ts`: Predefined 5-user team roster (1 Product Manager, 4 Engineers), 3 sample project metadata IDs, Kanban status enums, and notification event types.
- `src/schemas/`: Strict Zod schemas enforcing trimming, exact character limits, UUID formats, and domain invariants across gateway and microservice boundaries.
- `src/security/`: Timing-safe `X-Internal-Service-Token` verification, `X-Active-User-Id` validation, sanitized error envelope builders, and ElysiaJS OpenAPI 3.1 Swagger registration.
