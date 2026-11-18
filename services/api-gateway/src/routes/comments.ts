/**
 * API Gateway routes for Task Comments (`/api/v1/tasks/:taskId/comments`, `/api/v1/comments/:commentId`).
 */

import type { Elysia } from "elysia";
import {
  commentIdParamSchema,
  createCommentSchema,
  taskIdParamSchema,
  updateCommentSchema,
  validateActiveUserId,
  validateWithZod,
} from "@taskify/shared";
import { type GatewayProxyConfig, forwardToService } from "../middleware/security.ts";

/**
 * Registers edge-validated comment proxy routes on `api-gateway`.
 *
 * @param app - Elysia gateway instance.
 * @param config - Downstream URLs, internal token, and fetch adapter.
 * @returns Configured Elysia instance.
 */
export function registerGatewayCommentRoutes<TApp extends Elysia<any, any, any, any, any, any, any>>(
  app: TApp,
  config: GatewayProxyConfig,
): TApp {
  return app
    .post("/api/v1/tasks/:taskId/comments", async ({ request, params, body, set }) => {
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

      const parsedBody = validateWithZod(createCommentSchema, body);
      if (!parsedBody.ok) {
        set.status = parsedBody.status;
        return parsedBody.body;
      }

      const result = await forwardToService(
        `${config.tasksUrl}/api/v1/tasks/${parsedParams.data.taskId}/comments`,
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
    .patch("/api/v1/comments/:commentId", async ({ request, params, body, set }) => {
      const activeUser = validateActiveUserId(request.headers.get("x-active-user-id"));
      if (!activeUser.ok) {
        set.status = activeUser.status;
        return activeUser.body;
      }

      const parsedParams = validateWithZod(commentIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }

      const parsedBody = validateWithZod(updateCommentSchema, body);
      if (!parsedBody.ok) {
        set.status = parsedBody.status;
        return parsedBody.body;
      }

      const result = await forwardToService(
        `${config.tasksUrl}/api/v1/comments/${parsedParams.data.commentId}`,
        {
          method: "PATCH",
          internalToken: config.internalToken,
          activeUserId: activeUser.userId,
          body: parsedBody.data,
          fetchFn: config.fetchFn,
        },
      );
      set.status = result.status;
      return result.data;
    })
    .delete("/api/v1/comments/:commentId", async ({ request, params, set }) => {
      const activeUser = validateActiveUserId(request.headers.get("x-active-user-id"));
      if (!activeUser.ok) {
        set.status = activeUser.status;
        return activeUser.body;
      }

      const parsedParams = validateWithZod(commentIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }

      const result = await forwardToService(
        `${config.tasksUrl}/api/v1/comments/${parsedParams.data.commentId}`,
        {
          method: "DELETE",
          internalToken: config.internalToken,
          activeUserId: activeUser.userId,
          fetchFn: config.fetchFn,
        },
      );
      set.status = result.status;
      return result.data;
    }) as TApp;
}
