/**
 * API Gateway routes for Notifications and Real-Time SSE Streams (`/api/v1/notifications`, `/api/v1/events/stream`).
 */

import type { Elysia } from "elysia";
import { z } from "zod";
import {
  notificationIdParamSchema,
  notificationQuerySchema,
  uuidV4Schema,
  validateActiveUserId,
  validateWithZod,
} from "@taskify/shared";
import {
  type GatewayProxyConfig,
  assertInternalGatewayCaller,
  forwardToService,
} from "../middleware/security.ts";
import type { SseHub } from "../sse/hub.ts";

const gatewaySseIngestSchema = z.object({
  eventName: z.string().trim().min(1).max(80),
  data: z.record(z.unknown()),
});

const streamQuerySchema = z.object({
  projectId: uuidV4Schema.optional(),
});

/**
 * Registers notification REST endpoints, SSE event stream, and internal broadcast ingestion on `api-gateway`.
 *
 * @param app - Elysia gateway instance.
 * @param config - Downstream URLs, internal token, and fetch adapter.
 * @param sseHub - Shared SSE subscriber registry.
 * @returns Configured Elysia instance.
 */
export function registerGatewayNotificationRoutes<TApp extends Elysia<any, any, any, any, any, any, any>>(
  app: TApp,
  config: GatewayProxyConfig,
  sseHub: SseHub,
): TApp {
  return app
    .get("/api/v1/notifications", async ({ query, set }) => {
      const parsedQuery = validateWithZod(notificationQuerySchema, query ?? {});
      if (!parsedQuery.ok) {
        set.status = parsedQuery.status;
        return parsedQuery.body;
      }

      const qs = new URLSearchParams();
      if (parsedQuery.data.projectId) qs.set("projectId", parsedQuery.data.projectId);
      if (parsedQuery.data.recipientId) qs.set("recipientId", parsedQuery.data.recipientId);
      if (parsedQuery.data.unreadOnly) qs.set("unreadOnly", parsedQuery.data.unreadOnly);
      qs.set("limit", String(parsedQuery.data.limit));

      const result = await forwardToService(
        `${config.notificationsUrl}/api/v1/notifications?${qs.toString()}`,
        {
          method: "GET",
          internalToken: config.internalToken,
          fetchFn: config.fetchFn,
        },
      );
      set.status = result.status;
      return result.data;
    })
    .patch("/api/v1/notifications/:notificationId/read", async ({ request, params, set }) => {
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

      const result = await forwardToService(
        `${config.notificationsUrl}/api/v1/notifications/${parsedParams.data.notificationId}/read`,
        {
          method: "PATCH",
          internalToken: config.internalToken,
          activeUserId: activeUser.userId,
          fetchFn: config.fetchFn,
        },
      );
      set.status = result.status;
      return result.data;
    })
    .post("/internal/v1/events", async ({ request, body, set }) => {
      assertInternalGatewayCaller(request, config.internalToken);

      const parsed = validateWithZod(gatewaySseIngestSchema, body);
      if (!parsed.ok) {
        set.status = parsed.status;
        return parsed.body;
      }

      sseHub.publish(parsed.data.eventName, parsed.data.data);
      if (parsed.data.data.notification) {
        sseHub.publish("notification.created", parsed.data.data);
      }

      set.status = 202;
      return { broadcasted: true };
    })
    .get("/api/v1/events/stream", ({ request, query, set }) => {
      const parsedQuery = validateWithZod(streamQuerySchema, query ?? {});
      if (!parsedQuery.ok) {
        set.status = parsedQuery.status;
        return parsedQuery.body;
      }
      return sseHub.createStreamResponse(parsedQuery.data.projectId ?? null, request.signal);
    }) as TApp;
}
