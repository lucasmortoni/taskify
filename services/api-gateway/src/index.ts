/**
 * Main ElysiaJS entrypoint for `api-gateway` (port `3001`).
 */

import { Elysia } from "elysia";
import { getInternalServiceToken, registerSwagger, sanitizeFrameworkError } from "@taskify/shared";
import { type GatewayProxyConfig, applySecurityHeaders } from "./middleware/security.ts";
import { registerGatewayCommentRoutes } from "./routes/comments.ts";
import { registerGatewayNotificationRoutes } from "./routes/notifications.ts";
import { registerGatewayProjectRoutes } from "./routes/projects.ts";
import { registerGatewayTaskRoutes } from "./routes/tasks.ts";
import { SseHub } from "./sse/hub.ts";

/** Options for constructing the `api-gateway` application. */
export interface GatewayAppOptions {
  readonly projectsUrl?: string;
  readonly tasksUrl?: string;
  readonly notificationsUrl?: string;
  readonly internalToken?: string;
  readonly corsOrigin?: string;
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Creates and configures the `api-gateway` Elysia instance with edge Zod validation,
 * security headers, SSE broadcasting, and downstream REST routing.
 *
 * @param options - Optional service URLs, shared token, CORS origin, and fetch adapter.
 * @returns Configured Elysia app and {@link SseHub}.
 */
export function createGatewayApp(options: GatewayAppOptions = {}) {
  const sseHub = new SseHub();
  const config: GatewayProxyConfig = {
    projectsUrl: options.projectsUrl ?? process.env.PROJECTS_SERVICE_URL ?? "http://localhost:3002",
    tasksUrl: options.tasksUrl ?? process.env.TASKS_SERVICE_URL ?? "http://localhost:3003",
    notificationsUrl:
      options.notificationsUrl ?? process.env.NOTIFICATIONS_SERVICE_URL ?? "http://localhost:3004",
    internalToken: options.internalToken ?? getInternalServiceToken(),
    corsOrigin: options.corsOrigin ?? process.env.CORS_ORIGIN ?? "http://localhost:3000",
    fetchFn: options.fetchFn ?? ((url, init) => fetch(url, init)),
  };

  const app = new Elysia()
    .onAfterHandle(({ set }) => {
      applySecurityHeaders(set.headers as Record<string, string | number>, config.corsOrigin);
    })
    .onError(({ code, error, set }) => {
      applySecurityHeaders(set.headers as Record<string, string | number>, config.corsOrigin);
      const sanitized = sanitizeFrameworkError(code, error);
      set.status = sanitized.status;
      return sanitized.body;
    })
    .options("/*", ({ set }) => {
      applySecurityHeaders(set.headers as Record<string, string | number>, config.corsOrigin);
      set.status = 204;
      return "";
    })
    .get("/health", () => ({ status: "ok", service: "api-gateway" }));

  registerSwagger(app, {
    title: "Taskify API Gateway",
    version: "1.0.0",
    description: "Edge REST & SSE Gateway for Taskify Projects, Tasks, Comments, and Notifications.",
    routes: [
      { method: "GET", path: "/api/v1/users", summary: "List 5 predefined users" },
      { method: "GET", path: "/api/v1/projects", summary: "List projects" },
      { method: "POST", path: "/api/v1/projects", summary: "Create a project" },
      { method: "GET", path: "/api/v1/projects/:projectId", summary: "Get project metadata" },
      { method: "GET", path: "/api/v1/projects/:projectId/tasks", summary: "List tasks in a project" },
      { method: "POST", path: "/api/v1/projects/:projectId/tasks", summary: "Create a task" },
      { method: "GET", path: "/api/v1/tasks/:taskId", summary: "Get task detail with comments" },
      { method: "PATCH", path: "/api/v1/tasks/:taskId", summary: "Update task status, assignee, or metadata" },
      { method: "POST", path: "/api/v1/tasks/:taskId/comments", summary: "Post a comment on a task" },
      { method: "PATCH", path: "/api/v1/comments/:commentId", summary: "Edit own comment" },
      { method: "DELETE", path: "/api/v1/comments/:commentId", summary: "Delete own comment" },
      { method: "GET", path: "/api/v1/notifications", summary: "List notifications" },
      { method: "PATCH", path: "/api/v1/notifications/:notificationId/read", summary: "Mark notification read" },
      { method: "GET", path: "/api/v1/events/stream", summary: "Subscribe to real-time SSE updates" },
    ],
  });

  registerGatewayProjectRoutes(app, config);
  registerGatewayTaskRoutes(app, config);
  registerGatewayCommentRoutes(app, config);
  registerGatewayNotificationRoutes(app, config, sseHub);

  return { app, sseHub, config };
}

if (import.meta.main) {
  const port = Number(process.env.API_GATEWAY_PORT ?? 3001);
  const { app } = createGatewayApp();
  app.listen({ port, idleTimeout: 120 });
  console.log(`[api-gateway] Listening on http://localhost:${port}`);
}
