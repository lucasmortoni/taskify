/**
 * Idempotent seed script for `tasks-service` populating starter Kanban tasks and initial comment.
 */

import { createTasksStore } from "./client.ts";

const store = createTasksStore();
await store.migrate();
await store.seed();
await store.close();
console.log("[tasks-service] Seeded starter tasks across sample projects.");
