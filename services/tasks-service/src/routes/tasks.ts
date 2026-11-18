/**
 * HTTP route handlers for `tasks-service` task endpoints (`/api/v1/projects/:projectId/tasks`, `/api/v1/tasks/:taskId`).
 */

import type { Elysia } from "elysia";
import {
  AppHttpError,
  PREDEFINED_USER_MAP,
  createTaskSchema,
  getInternalServiceToken,
  projectIdParamSchema,
  taskIdParamSchema,
  updateTaskSchema,
  validateActiveUserId,
  validateWithZod,
} from "@taskify/shared";
import type { TasksStore } from "../db/client.ts";
import { requireInternalServiceToken } from "../middleware/auth.ts";

/** Dependencies injected into task route handlers. */
export interface TasksRouteDeps {
  readonly store: TasksStore;
  readonly internalToken?: string;
  readonly projectsUrl?: string;
  readonly notificationsUrl?: string;
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Verifies a project exists in `projects-service` over an authenticated internal HTTP call.
 *
 * @param projectId - Project UUIDv4 to verify.
 * @param deps - Service URLs, internal token, and fetch function.
 * @throws {AppHttpError} `404 NOT_FOUND` if the project does not exist.
 */
async function ensureProjectExists(
  projectId: string,
  projectsUrl: string,
  internalToken: string,
  fetchFn: (url: string, init: RequestInit) => Promise<Response>,
): Promise<void> {
  const res = await fetchFn(`${projectsUrl}/api/v1/projects/${projectId}`, {
    method: "GET",
    headers: { "x-internal-service-token": internalToken },
  });
  if (res.status === 404) {
    throw new AppHttpError(404, "NOT_FOUND", "Project not found");
  }
  if (!res.ok) {
    throw new AppHttpError(502, "INTERNAL_ERROR", "Unable to verify project existence");
  }
}

/**
 * Registers task CRUD and Kanban board routes onto an Elysia instance.
 *
 * @param app - Elysia service application.
 * @param deps - Store, service URLs, and internal token configuration.
 * @returns Configured Elysia instance.
 */
export function registerTaskRoutes<TApp extends Elysia<any, any, any, any, any, any, any>>(
  app: TApp,
  deps: TasksRouteDeps,
): TApp {
  const internalToken = deps.internalToken ?? getInternalServiceToken();
  const projectsUrl = deps.projectsUrl ?? process.env.PROJECTS_SERVICE_URL ?? "http://localhost:3002";
  const notificationsUrl =
    deps.notificationsUrl ?? process.env.NOTIFICATIONS_SERVICE_URL ?? "http://localhost:3004";
  const fetchFn = deps.fetchFn ?? ((url, init) => fetch(url, init));

  const emitEvent = async (event: Record<string, unknown>) => {
    try {
      await fetchFn(`${notificationsUrl}/internal/v1/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-service-token": internalToken,
        },
        body: JSON.stringify(event),
      });
    } catch {
      // Non-blocking notification emission
    }
  };

  return app
    .get("/api/v1/projects/:projectId/tasks", async ({ request, params, set }) => {
      requireInternalServiceToken(request, internalToken);

      const parsedParams = validateWithZod(projectIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }

      await ensureProjectExists(parsedParams.data.projectId, projectsUrl, internalToken, fetchFn);
      const tasks = await deps.store.listTasksByProject(parsedParams.data.projectId);
      return { projectId: parsedParams.data.projectId, tasks };
    })
    .post("/api/v1/projects/:projectId/tasks", async ({ request, params, body, set }) => {
      requireInternalServiceToken(request, internalToken);

      const activeUser = validateActiveUserId(request.headers.get("x-active-user-id"));
      if (!activeUser.ok) {
        set.status = activeUser.status;
        return activeUser.body;
      }

      const parsedParams = validateWithZod(projectIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }

      const parsedBody = validateWithZod(createTaskSchema, body);
      if (!parsedBody.ok) {
        set.status = parsedBody.status;
        return parsedBody.body;
      }

      await ensureProjectExists(parsedParams.data.projectId, projectsUrl, internalToken, fetchFn);

      const task = await deps.store.createTask({
        projectId: parsedParams.data.projectId,
        title: parsedBody.data.title,
        description: parsedBody.data.description ?? null,
        status: parsedBody.data.status ?? "To Do",
        assigneeId: parsedBody.data.assigneeId ?? null,
        createdById: activeUser.userId,
      });

      const actorName = PREDEFINED_USER_MAP.get(activeUser.userId)?.name ?? "Team Member";
      await emitEvent({
        eventId: crypto.randomUUID(),
        type: "TASK_CREATED",
        projectId: task.projectId,
        taskId: task.id,
        actorId: activeUser.userId,
        recipientId: task.assigneeId,
        message: `${actorName} created task "${task.title}" in ${task.status}`,
        payload: { task },
      });

      set.status = 201;
      return { task };
    })
    .get("/api/v1/tasks/:taskId", async ({ request, params, set }) => {
      requireInternalServiceToken(request, internalToken);

      const parsedParams = validateWithZod(taskIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }

      const detail = await deps.store.getTaskById(parsedParams.data.taskId);
      if (!detail) {
        throw new AppHttpError(404, "NOT_FOUND", "Task not found");
      }

      return detail;
    })
    .patch("/api/v1/tasks/:taskId", async ({ request, params, body, set }) => {
      requireInternalServiceToken(request, internalToken);

      const activeUser = validateActiveUserId(request.headers.get("x-active-user-id"));
      if (!activeUser.ok) {
        set.status = activeUser.status;
        return activeUser.body;
      }

      const parsedParams = validateWithZod(taskIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }

      const parsedBody = validateWithZod(updateTaskSchema, body);
      if (!parsedBody.ok) {
        set.status = parsedBody.status;
        return parsedBody.body;
      }

      const existing = await deps.store.getTaskById(parsedParams.data.taskId);
      if (!existing) {
        throw new AppHttpError(404, "NOT_FOUND", "Task not found");
      }

      const updated = await deps.store.updateTask(parsedParams.data.taskId, parsedBody.data);
      if (!updated) {
        throw new AppHttpError(404, "NOT_FOUND", "Task not found");
      }

      const actorName = PREDEFINED_USER_MAP.get(activeUser.userId)?.name ?? "Team Member";
      const statusChanged = existing.task.status !== updated.status;
      const assigneeChanged = existing.task.assigneeId !== updated.assigneeId;

      if (statusChanged) {
        await emitEvent({
          eventId: crypto.randomUUID(),
          type: "TASK_STATUS_CHANGED",
          projectId: updated.projectId,
          taskId: updated.id,
          actorId: activeUser.userId,
          recipientId: updated.assigneeId,
          message: `${actorName} moved "${updated.title}" from ${existing.task.status} to ${updated.status}`,
          payload: { task: updated, previousStatus: existing.task.status, status: updated.status },
        });
      }

      if (assigneeChanged || (!statusChanged && parsedBody.data.title !== undefined)) {
        const assigneeName = updated.assigneeId
          ? (PREDEFINED_USER_MAP.get(updated.assigneeId)?.name ?? "Team Member")
          : "Unassigned";
        await emitEvent({
          eventId: crypto.randomUUID(),
          type: "TASK_ASSIGNED",
          projectId: updated.projectId,
          taskId: updated.id,
          actorId: activeUser.userId,
          recipientId: updated.assigneeId,
          message: assigneeChanged
            ? `${actorName} assigned "${updated.title}" to ${assigneeName}`
            : `${actorName} updated "${updated.title}"`,
          payload: { task: updated },
        });
      }

      return { task: updated };
    }) as TApp;
}
