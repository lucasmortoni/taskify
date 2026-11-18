/**
 * API Gateway routes for Projects and Predefined Users (`/api/v1/users`, `/api/v1/projects`).
 */

import type { Elysia } from "elysia";
import {
  createProjectSchema,
  projectIdParamSchema,
  validateActiveUserId,
  validateWithZod,
} from "@taskify/shared";
import { type GatewayProxyConfig, forwardToService } from "../middleware/security.ts";

/**
 * Registers edge-validated project and user proxy routes on `api-gateway`.
 *
 * @param app - Elysia gateway instance.
 * @param config - Downstream URLs, internal token, and fetch adapter.
 * @returns Configured Elysia instance.
 */
export function registerGatewayProjectRoutes<TApp extends Elysia<any, any, any, any, any, any, any>>(
  app: TApp,
  config: GatewayProxyConfig,
): TApp {
  return app
    .get("/api/v1/users", async ({ set }) => {
      const result = await forwardToService(`${config.projectsUrl}/api/v1/users`, {
        method: "GET",
        internalToken: config.internalToken,
        fetchFn: config.fetchFn,
      });
      set.status = result.status;
      return result.data;
    })
    .get("/api/v1/projects", async ({ set }) => {
      const result = await forwardToService(`${config.projectsUrl}/api/v1/projects`, {
        method: "GET",
        internalToken: config.internalToken,
        fetchFn: config.fetchFn,
      });
      set.status = result.status;
      return result.data;
    })
    .get("/api/v1/projects/:projectId", async ({ params, set }) => {
      const parsedParams = validateWithZod(projectIdParamSchema, params);
      if (!parsedParams.ok) {
        set.status = parsedParams.status;
        return parsedParams.body;
      }
      const result = await forwardToService(
        `${config.projectsUrl}/api/v1/projects/${parsedParams.data.projectId}`,
        {
          method: "GET",
          internalToken: config.internalToken,
          fetchFn: config.fetchFn,
        },
      );
      set.status = result.status;
      return result.data;
    })
    .post("/api/v1/projects", async ({ request, body, set }) => {
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

      const result = await forwardToService(`${config.projectsUrl}/api/v1/projects`, {
        method: "POST",
        internalToken: config.internalToken,
        activeUserId: activeUser.userId,
        body: parsedBody.data,
        fetchFn: config.fetchFn,
      });
      set.status = result.status;
      return result.data;
    }) as TApp;
}
