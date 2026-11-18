/**
 * CLI migration entrypoint for `notifications-service` (`notifications_domain`).
 */

import { createNotificationsStore } from "./client.ts";

const store = createNotificationsStore();
await store.migrate();
await store.close();
console.log("[notifications-service] Migrations applied cleanly.");
