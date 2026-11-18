# `@taskify/web`

Lightweight React 19 SSR server and client Kanban application (default port `3000`) built for Taskify Phase 1.

## Features

- Zero-login workspace with instant SSR initial hydration of the 5 predefined users and 3 sample projects.
- Active-user switcher (`X-Active-User-Id` header injection) for Alex Morgan (Product Manager) and 4 Engineers.
- Interactive 4-column drag-and-drop Kanban board (`To Do`, `In Progress`, `In Review`, `Done`) with accessible status/assignee controls and optimistic updates.
- Chronological task comments with Zod validation and author-only edit/delete actions.
- Live SSE subscription (`/api/v1/events/stream`) synchronizing boards and notifications across browser tabs in real time.
