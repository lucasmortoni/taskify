/**
 * Main ElysiaJS entrypoint for `notifications-service` (port `3004`, schema `notifications_domain`).
 */

import { Elysia } from "elysia";
import { registerSwagger, sanitizeFrameworkError } from "@taskify/shared";
import { type NotificationsStore, createNotificationsStore } from "./db/client.ts";
import { registerNotificationRoutes } from "./routes/notifications.ts";

/** Options for creating a `notifications-service` Elysia instance. */
export interface NotificationsAppOptions {
  readonly store?: NotificationsStore;
  readonly internalToken?: string;
  readonly gatewayUrl?: string;
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Constructs and configures the `notifications-service` Elysia application.
 *
 * @param options - Optional store and service dependencies (for testing or custom wiring).
 * @returns Configured Elysia app with routes, error sanitizer, and OpenAPI 3.1 docs.
 */
export function createNotificationsApp(options: NotificationsAppOptions = {}) {
  const store = options.store ?? createNotificationsStore();

  const app = new Elysia()
    .onError(({ code, error, set }) => {
      const sanitized = sanitizeFrameworkError(code, error);
      set.status = sanitized.status;
      return sanitized.body;
    })
    .get("/health", () => ({ status: "ok", service: "notifications-service" }));

  registerSwagger(app, {
    title: "Taskify Notifications Service",
    version: "1.0.0",
    description: "Activity notification persistence and internal domain event ingestion.",
    routes: [
      { method: "GET", path: "/api/v1/notifications", summary: "List recent activity notifications" },
      { method: "PATCH", path: "/api/v1/notifications/:notificationId/read", summary: "Mark notification as read" },
      { method: "POST", path: "/internal/v1/events", summary: "Ingest internal domain event" },
    ],
  });

  registerNotificationRoutes(app, {
    store,
    internalToken: options.internalToken,
    gatewayUrl: options.gatewayUrl,
    fetchFn: options.fetchFn,
  });

  return { app, store };
}

if (import.meta.main) {
  const port = Number(process.env.NOTIFICATIONS_SERVICE_PORT ?? 3004);
  const { app, store } = createNotificationsApp();
  await store.migrate();
  app.listen(port);
  console.log(`[notifications-service] Listening on http://localhost:${port}`);
}
