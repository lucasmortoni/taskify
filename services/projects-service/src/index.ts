/**
 * Main ElysiaJS entrypoint for `projects-service` (port `3002`, schema `projects_domain`).
 */

import { Elysia } from "elysia";
import { registerSwagger, sanitizeFrameworkError } from "@taskify/shared";
import { type ProjectsStore, createProjectsStore } from "./db/client.ts";
import { registerProjectRoutes } from "./routes/projects.ts";

/** Options for creating a `projects-service` Elysia instance. */
export interface ProjectsAppOptions {
  readonly store?: ProjectsStore;
  readonly internalToken?: string;
  readonly notificationsUrl?: string;
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Constructs and configures the `projects-service` Elysia application.
 *
 * @param options - Optional store and service dependencies.
 * @returns Configured Elysia app with routes, error sanitizer, and OpenAPI 3.1 docs.
 */
export function createProjectsApp(options: ProjectsAppOptions = {}) {
  const store = options.store ?? createProjectsStore();

  const app = new Elysia()
    .onError(({ code, error, set }) => {
      const sanitized = sanitizeFrameworkError(code, error);
      set.status = sanitized.status;
      return sanitized.body;
    })
    .get("/health", () => ({ status: "ok", service: "projects-service" }));

  registerSwagger(app, {
    title: "Taskify Projects Service",
    version: "1.0.0",
    description: "Predefined team roster and project management service.",
    routes: [
      { method: "GET", path: "/api/v1/users", summary: "List 5 predefined users" },
      { method: "GET", path: "/api/v1/projects", summary: "List all projects" },
      { method: "POST", path: "/api/v1/projects", summary: "Create a new project" },
      { method: "GET", path: "/api/v1/projects/:projectId", summary: "Get project by ID" },
    ],
  });

  registerProjectRoutes(app, {
    store,
    internalToken: options.internalToken,
    notificationsUrl: options.notificationsUrl,
    fetchFn: options.fetchFn,
  });

  return { app, store };
}

if (import.meta.main) {
  const port = Number(process.env.PROJECTS_SERVICE_PORT ?? 3002);
  const { app, store } = createProjectsApp();
  await store.migrate();
  await store.seed();
  app.listen(port);
  console.log(`[projects-service] Listening on http://localhost:${port}`);
}
