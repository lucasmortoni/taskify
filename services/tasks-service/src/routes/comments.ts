/**
 * HTTP route handlers for `tasks-service` comment endpoints (`FR-009`).
 */

import type { Elysia } from "elysia";
import {
  AppHttpError,
  PREDEFINED_USER_MAP,
  commentIdParamSchema,
  createCommentSchema,
  getInternalServiceToken,
  taskIdParamSchema,
  updateCommentSchema,
  validateActiveUserId,
  validateWithZod,
} from "@taskify/shared";
import type { TasksStore } from "../db/client.ts";
import { requireInternalServiceToken } from "../middleware/auth.ts";
import { assertCommentAuthor } from "../middleware/ownership.ts";

/** Dependencies injected into comment route handlers. */
export interface CommentsRouteDeps {
  readonly store: TasksStore;
  readonly internalToken?: string;
  readonly notificationsUrl?: string;
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Registers task comment creation, author-owned editing, and author-owned deletion endpoints.
 *
 * @param app - Elysia service application.
 * @param deps - Store, token, and notification emitter configuration.
 * @returns Configured Elysia instance.
 */
export function registerCommentRoutes<TApp extends Elysia<any, any, any, any, any, any, any>>(
  app: TApp,
  deps: CommentsRouteDeps,
): TApp {
  const internalToken = deps.internalToken ?? getInternalServiceToken();
  const notificationsUrl =
    deps.notificationsUrl ?? process.env.NOTIFICATIONS_SERVICE_URL ?? "http://localhost:3004";
  const fetchFn = deps.fetchFn ?? ((url, init) => fetch(url, init));

  const emitCommentEvent = async (event: Record<string, unknown>) => {
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
    .post("/api/v1/tasks/:taskId/comments", async ({ request, params, body, set }) => {
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

      const parsedBody = validateWithZod(createCommentSchema, body);
      if (!parsedBody.ok) {
        set.status = parsedBody.status;
        return parsedBody.body;
      }

      const taskDetail = await deps.store.getTaskById(parsedParams.data.taskId);
      if (!taskDetail) {
        throw new AppHttpError(404, "NOT_FOUND", "Task not found");
      }

      // Author is derived strictly from the validated active-user header.
      const comment = await deps.store.createComment({
        taskId: parsedParams.data.taskId,
        authorId: activeUser.userId,
        content: parsedBody.data.content,
      });

      const actorName = PREDEFINED_USER_MAP.get(activeUser.userId)?.name ?? "Team Member";
      await emitCommentEvent({
        eventId: crypto.randomUUID(),
        type: "COMMENT_CREATED",
        projectId: taskDetail.task.projectId,
        taskId: taskDetail.task.id,
        actorId: activeUser.userId,
        recipientId: taskDetail.task.assigneeId,
        message: `${actorName} commented on "${taskDetail.task.title}"`,
        payload: { comment, taskId: taskDetail.task.id },
      });

      set.status = 201;
      return { comment };
    })
    .patch("/api/v1/comments/:commentId", async ({ request, params, body, set }) => {
      requireInternalServiceToken(request, internalToken);

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

      const existing = await deps.store.getCommentById(parsedParams.data.commentId);
      assertCommentAuthor(existing, activeUser.userId);

      const updated = await deps.store.updateComment(parsedParams.data.commentId, parsedBody.data.content);
      if (!updated) {
        throw new AppHttpError(404, "NOT_FOUND", "Comment not found");
      }

      const taskDetail = await deps.store.getTaskById(updated.taskId);
      const actorName = PREDEFINED_USER_MAP.get(activeUser.userId)?.name ?? "Team Member";
      if (taskDetail) {
        await emitCommentEvent({
          eventId: crypto.randomUUID(),
          type: "COMMENT_UPDATED",
          projectId: taskDetail.task.projectId,
          taskId: taskDetail.task.id,
          actorId: activeUser.userId,
          recipientId: taskDetail.task.assigneeId,
          message: `${actorName} edited a comment on "${taskDetail.task.title}"`,
          payload: { comment: updated, taskId: taskDetail.task.id },
        });
      }

      return { comment: updated };
    })
    .delete("/api/v1/comments/:commentId", async ({ request, params, set }) => {
      requireInternalServiceToken(request, internalToken);

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

      const existing = await deps.store.getCommentById(parsedParams.data.commentId);
      assertCommentAuthor(existing, activeUser.userId);

      const deleted = await deps.store.deleteComment(parsedParams.data.commentId);
      if (!deleted) {
        throw new AppHttpError(404, "NOT_FOUND", "Comment not found");
      }

      const taskDetail = await deps.store.getTaskById(deleted.taskId);
      const actorName = PREDEFINED_USER_MAP.get(activeUser.userId)?.name ?? "Team Member";
      if (taskDetail) {
        await emitCommentEvent({
          eventId: crypto.randomUUID(),
          type: "COMMENT_DELETED",
          projectId: taskDetail.task.projectId,
          taskId: taskDetail.task.id,
          actorId: activeUser.userId,
          recipientId: taskDetail.task.assigneeId,
          message: `${actorName} deleted a comment on "${taskDetail.task.title}"`,
          payload: { deletedId: deleted.deletedId, taskId: deleted.taskId },
        });
      }

      return deleted;
    }) as TApp;
}
