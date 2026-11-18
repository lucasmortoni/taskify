/**
 * HTTP route handlers for `projects-service` (`/api/v1/users`, `/api/v1/projects`).
 */

import type { Elysia } from "elysia";
import {
  AppHttpError,
  PREDEFINED_USER_MAP,
  createProjectSchema,
  getInternalServiceToken,
  projectIdParamSchema,
  validateActiveUserId,
  validateWithZod,
} from "@taskify/shared";
import type { ProjectsStore } from "../db/client.ts";
import { requireInternalServiceToken } from "../middleware/auth.ts";

/** Dependencies injected into projects route handlers. */
export interface ProjectsRouteDeps {
  readonly store: ProjectsStore;
  readonly internalToken?: string;
  readonly notificationsUrl?: string;
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Registers user and project REST endpoints onto an Elysia service instance.
 *
 * @param app - Elysia service application.
 * @param deps - Store, internal token, and notification emitter configuration.
 * @returns Configured Elysia instance.
 */
export function registerProjectRoutes<TApp extends Elysia<any, any, any, any, any, any, any>>(
  app: TApp,
  deps: ProjectsRouteDeps,
): TApp {
  const internalToken = deps.internalToken ?? getInternalServiceToken();
  const notificationsUrl =
    deps.notificationsUrl ?? process.env.NOTIFICATIONS_SERVICE_URL ?? "http://localhost:3004";
  const fetchFn = deps.fetchFn ?? ((url, init) => fetch(url, init));

  return app
    .get("/api/v1/users", async ({ request }) => {
      requireInternalServiceToken(request, internalToken);
      const users = await deps.store.listUsers();
      return { users };
    })
    .get("/api/v1/projects", async ({ request }) => {
      requireInternalServiceToken(request, internalToken);
      const projects = await deps.store.listProjects();
      return { projects };
    })
    .get("/api/v1/projects/:projectId", async ({ request, params, set }) => {
      requireInternalServiceToken(request, internalToken);

      const parsedParams = validateWithZod(projectIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }

      const project = await deps.store.getProjectById(parsedParams.data.projectId);
      if (!project) {
        throw new AppHttpError(404, "NOT_FOUND", "Project not found");
      }

      return { project };
    })
    .post("/api/v1/projects", async ({ request, body, set }) => {
      requireInternalServiceToken(request, internalToken);

      const activeUser = validateActiveUserId(request.headers.get("x-active-user-id"));
      if (!activeUser.ok) {
        set.status = activeUser.status;
        return activeUser.body;
      }

      const parsedBody = validateWithZod(createProjectSchema, body);
      if (!parsedBody.ok) {
        set.status = parsedBody.status;
        return parsedBody.body;
      }

      const project = await deps.store.createProject({
        name: parsedBody.data.name,
        description: parsedBody.data.description ?? null,
        createdById: activeUser.userId,
      });

      const actorName = PREDEFINED_USER_MAP.get(activeUser.userId)?.name ?? "Team Member";
      try {
        await fetchFn(`${notificationsUrl}/internal/v1/events`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-service-token": internalToken,
          },
          body: JSON.stringify({
            eventId: crypto.randomUUID(),
            type: "PROJECT_CREATED",
            projectId: project.id,
            taskId: null,
            actorId: activeUser.userId,
            recipientId: null,
            message: `${actorName} created project "${project.name}"`,
            payload: { project },
          }),
        });
      } catch {
        // Non-blocking notification emission
      }

      set.status = 201;
      return { project };
    }) as TApp;
}
