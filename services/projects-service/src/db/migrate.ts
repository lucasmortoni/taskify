/**
 * CLI migration entrypoint for `projects-service` (`projects_domain`).
 */

import { createProjectsStore } from "./client.ts";

const store = createProjectsStore();
await store.migrate();
await store.close();
console.log("[projects-service] Migrations applied cleanly.");
