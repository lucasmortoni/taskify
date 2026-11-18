/**
 * Main ElysiaJS entrypoint for `tasks-service` (port `3003`, schema `tasks_domain`).
 */

import { Elysia } from "elysia";
import { registerSwagger, sanitizeFrameworkError } from "@taskify/shared";
import { type TasksStore, createTasksStore } from "./db/client.ts";
import { registerCommentRoutes } from "./routes/comments.ts";
import { registerTaskRoutes } from "./routes/tasks.ts";

/** Options for creating a `tasks-service` Elysia instance. */
export interface TasksAppOptions {
  readonly store?: TasksStore;
  readonly internalToken?: string;
  readonly projectsUrl?: string;
  readonly notificationsUrl?: string;
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Constructs and configures the `tasks-service` Elysia application.
 *
 * @param options - Optional store and service dependencies.
 * @returns Configured Elysia app with task/comment routes, error sanitizer, and OpenAPI 3.1 docs.
 */
export function createTasksApp(options: TasksAppOptions = {}) {
  const store = options.store ?? createTasksStore();

  const app = new Elysia()
    .onError(({ code, error, set }) => {
      const sanitized = sanitizeFrameworkError(code, error);
      set.status = sanitized.status;
      return sanitized.body;
    })
    .get("/health", () => ({ status: "ok", service: "tasks-service" }));

  registerSwagger(app, {
    title: "Taskify Tasks & Comments Service",
    version: "1.0.0",
    description: "Kanban task lifecycle, single-assignee management, and author-owned comments.",
    routes: [
      { method: "GET", path: "/api/v1/projects/:projectId/tasks", summary: "List tasks for a project" },
      { method: "POST", path: "/api/v1/projects/:projectId/tasks", summary: "Create a task in a project" },
      { method: "GET", path: "/api/v1/tasks/:taskId", summary: "Get task detail and comments" },
      { method: "PATCH", path: "/api/v1/tasks/:taskId", summary: "Update task status, assignee, or fields" },
      { method: "POST", path: "/api/v1/tasks/:taskId/comments", summary: "Add a comment to a task" },
      { method: "PATCH", path: "/api/v1/comments/:commentId", summary: "Edit own comment" },
      { method: "DELETE", path: "/api/v1/comments/:commentId", summary: "Delete own comment" },
    ],
  });

  registerTaskRoutes(app, {
    store,
    internalToken: options.internalToken,
    projectsUrl: options.projectsUrl,
    notificationsUrl: options.notificationsUrl,
    fetchFn: options.fetchFn,
  });

  registerCommentRoutes(app, {
    store,
    internalToken: options.internalToken,
    notificationsUrl: options.notificationsUrl,
    fetchFn: options.fetchFn,
  });

  return { app, store };
}

if (import.meta.main) {
  const port = Number(process.env.TASKS_SERVICE_PORT ?? 3003);
  const { app, store } = createTasksApp();
  await store.migrate();
  await store.seed();
  app.listen(port);
  console.log(`[tasks-service] Listening on http://localhost:${port}`);
}
