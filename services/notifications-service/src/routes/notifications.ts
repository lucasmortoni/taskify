/**
 * HTTP route handlers for `notifications-service` (`/internal/v1/events`, `/api/v1/notifications`).
 */

import type { Elysia } from "elysia";
import {
  AppHttpError,
  type InternalEventDto,
  getInternalServiceToken,
  internalEventSchema,
  notificationIdParamSchema,
  notificationQuerySchema,
  validateActiveUserId,
  validateWithZod,
} from "@taskify/shared";
import type { NotificationsStore } from "../db/client.ts";
import { requireInternalServiceToken } from "../middleware/auth.ts";

/** Dependencies injected into notifications route registration. */
export interface NotificationsRouteDeps {
  readonly store: NotificationsStore;
  readonly internalToken?: string;
  readonly gatewayUrl?: string;
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
}

/** Maps internal domain event types to SSE stream event names. */
function mapEventToSseName(type: InternalEventDto["type"]): string {
  switch (type) {
    case "PROJECT_CREATED":
      return "project.created";
    case "TASK_CREATED":
      return "task.created";
    case "TASK_STATUS_CHANGED":
    case "TASK_ASSIGNED":
      return "task.updated";
    case "COMMENT_CREATED":
    case "COMMENT_UPDATED":
    case "COMMENT_DELETED":
      return "comment.changed";
  }
}

/**
 * Registers notification persistence and query endpoints onto an Elysia instance.
 *
 * @param app - Elysia service application.
 * @param deps - Store, token, and SSE relay configuration.
 * @returns Configured Elysia instance.
 */
export function registerNotificationRoutes<TApp extends Elysia<any, any, any, any, any, any, any>>(
  app: TApp,
  deps: NotificationsRouteDeps,
): TApp {
  const internalToken = deps.internalToken ?? getInternalServiceToken();
  const gatewayUrl = deps.gatewayUrl ?? process.env.API_GATEWAY_URL ?? "http://localhost:3001";
  const fetchFn = deps.fetchFn ?? ((url, init) => fetch(url, init));

  return app
    .post("/internal/v1/events", async ({ request, body, set }) => {
      requireInternalServiceToken(request, internalToken);

      const parsed = validateWithZod(internalEventSchema, body);
      if (!parsed.ok) {
        set.status = parsed.status;
        return parsed.body;
      }

      const event = parsed.data;
      const notification = await deps.store.createNotification({
        projectId: event.projectId,
        taskId: event.taskId ?? null,
        actorId: event.actorId,
        recipientId: event.recipientId ?? null,
        type: event.type,
        message: event.message,
      });

      // Best-effort fan-out to API Gateway SSE hub (never fails core persistence).
      const ssePayload = {
        eventName: mapEventToSseName(event.type),
        data: {
          ...event.payload,
          eventType: event.type,
          projectId: event.projectId,
          taskId: event.taskId ?? null,
          actorId: event.actorId,
          notification,
        },
      };

      try {
        await fetchFn(`${gatewayUrl}/internal/v1/events`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-service-token": internalToken,
          },
          body: JSON.stringify(ssePayload),
        });
      } catch {
        // SSE relay failure is non-blocking; notification remains persisted for polling.
      }

      set.status = 202;
      return { accepted: true, notificationId: notification.id };
    })
    .get("/api/v1/notifications", async ({ request, query, set }) => {
      requireInternalServiceToken(request, internalToken);

      const parsedQuery = validateWithZod(notificationQuerySchema, query ?? {});
      if (!parsedQuery.ok) {
        set.status = parsedQuery.status;
        return parsedQuery.body;
      }

      const notifications = await deps.store.listNotifications(parsedQuery.data);
      return { notifications };
    })
    .patch("/api/v1/notifications/:notificationId/read", async ({ request, params, set }) => {
      requireInternalServiceToken(request, internalToken);

      const activeUser = validateActiveUserId(request.headers.get("x-active-user-id"));
      if (!activeUser.ok) {
        set.status = activeUser.status;
        return activeUser.body;
      }

      const parsedParams = validateWithZod(notificationIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }

      const updated = await deps.store.markAsRead(parsedParams.data.notificationId);
      if (!updated) {
        throw new AppHttpError(404, "NOT_FOUND", "Notification not found");
      }

      return { notification: updated };
    }) as TApp;
}
