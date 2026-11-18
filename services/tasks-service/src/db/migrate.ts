/**
 * CLI migration entrypoint for `tasks-service` (`tasks_domain`).
 */

import { createTasksStore } from "./client.ts";

const store = createTasksStore();
await store.migrate();
await store.close();
console.log("[tasks-service] Migrations applied cleanly.");
