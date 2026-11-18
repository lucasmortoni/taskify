/**
 * API Gateway routes for Kanban Tasks (`/api/v1/projects/:projectId/tasks`, `/api/v1/tasks/:taskId`).
 */

import type { Elysia } from "elysia";
import {
  createTaskSchema,
  projectIdParamSchema,
  taskIdParamSchema,
  updateTaskSchema,
  validateActiveUserId,
  validateWithZod,
} from "@taskify/shared";
import { type GatewayProxyConfig, forwardToService } from "../middleware/security.ts";

/**
 * Registers edge-validated task proxy routes on `api-gateway`.
 *
 * @param app - Elysia gateway instance.
 * @param config - Downstream URLs, internal token, and fetch adapter.
 * @returns Configured Elysia instance.
 */
export function registerGatewayTaskRoutes<TApp extends Elysia<any, any, any, any, any, any, any>>(
  app: TApp,
  config: GatewayProxyConfig,
): TApp {
  return app
    .get("/api/v1/projects/:projectId/tasks", async ({ params, set }) => {
      const parsedParams = validateWithZod(projectIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }
      const result = await forwardToService(
        `${config.tasksUrl}/api/v1/projects/${parsedParams.data.projectId}/tasks`,
        {
          method: "GET",
          internalToken: config.internalToken,
          fetchFn: config.fetchFn,
        },
      );
      set.status = result.status;
      return result.data;
    })
    .post("/api/v1/projects/:projectId/tasks", async ({ request, params, body, set }) => {
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

      const result = await forwardToService(
        `${config.tasksUrl}/api/v1/projects/${parsedParams.data.projectId}/tasks`,
        {
          method: "POST",
          internalToken: config.internalToken,
          activeUserId: activeUser.userId,
          body: parsedBody.data,
          fetchFn: config.fetchFn,
        },
      );
      set.status = result.status;
      return result.data;
    })
    .get("/api/v1/tasks/:taskId", async ({ params, set }) => {
      const parsedParams = validateWithZod(taskIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }
      const result = await forwardToService(`${config.tasksUrl}/api/v1/tasks/${parsedParams.data.taskId}`, {
        method: "GET",
        internalToken: config.internalToken,
        fetchFn: config.fetchFn,
      });
      set.status = result.status;
      return result.data;
    })
    .patch("/api/v1/tasks/:taskId", async ({ request, params, body, set }) => {
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

      const result = await forwardToService(`${config.tasksUrl}/api/v1/tasks/${parsedParams.data.taskId}`, {
        method: "PATCH",
        internalToken: config.internalToken,
        activeUserId: activeUser.userId,
        body: parsedBody.data,
        fetchFn: config.fetchFn,
      });
      set.status = result.status;
      return result.data;
    }) as TApp;
}
