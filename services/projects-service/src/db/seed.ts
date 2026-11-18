/**
 * Idempotent seed script for `projects-service` populating the 5 predefined users and 3 sample projects.
 */

import { createProjectsStore } from "./client.ts";

const store = createProjectsStore();
await store.migrate();
await store.seed();
await store.close();
console.log("[projects-service] Seeded 5 predefined users and 3 sample projects.");
