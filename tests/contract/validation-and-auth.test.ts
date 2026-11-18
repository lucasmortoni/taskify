import { describe, expect, it } from "bun:test";
import { PREDEFINED_USERS, SAMPLE_PROJECTS } from "@taskify/shared";
import { createGatewayApp } from "../../services/api-gateway/src/index.ts";
import { createNotificationsStore } from "../../services/notifications-service/src/db/client.ts";
import { createNotificationsApp } from "../../services/notifications-service/src/index.ts";
import { createProjectsStore } from "../../services/projects-service/src/db/client.ts";
import { createProjectsApp } from "../../services/projects-service/src/index.ts";
import { createTasksStore } from "../../services/tasks-service/src/db/client.ts";
import { createTasksApp } from "../../services/tasks-service/src/index.ts";

async function buildTestStack() {
  const internalToken = "test-internal-secret-token";
  const projectsStore = createProjectsStore({ sqlitePath: ":memory:", usePostgres: false });
  const tasksStore = createTasksStore({ sqlitePath: ":memory:", usePostgres: false });
  const notificationsStore = createNotificationsStore({ sqlitePath: ":memory:", usePostgres: false });

  await projectsStore.migrate();
  await projectsStore.seed();
  await tasksStore.migrate();
  await tasksStore.seed();
  await notificationsStore.migrate();

  let gatewayRef: ReturnType<typeof createGatewayApp>["app"];
  let projectsRef: ReturnType<typeof createProjectsApp>["app"];
  let tasksRef: ReturnType<typeof createTasksApp>["app"];
  let notificationsRef: ReturnType<typeof createNotificationsApp>["app"];

  const routeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const req = new Request(url, init);
    if (url.startsWith("http://projects.local")) return projectsRef.handle(req);
    if (url.startsWith("http://tasks.local")) return tasksRef.handle(req);
    if (url.startsWith("http://notifications.local")) return notificationsRef.handle(req);
    if (url.startsWith("http://gateway.local")) return gatewayRef.handle(req);
    throw new Error(`Unexpected test URL: ${url}`);
  };

  notificationsRef = createNotificationsApp({
    store: notificationsStore,
    internalToken,
    gatewayUrl: "http://gateway.local",
    fetchFn: routeFetch,
  }).app;

  projectsRef = createProjectsApp({
    store: projectsStore,
    internalToken,
    notificationsUrl: "http://notifications.local",
    fetchFn: routeFetch,
  }).app;

  tasksRef = createTasksApp({
    store: tasksStore,
    internalToken,
    projectsUrl: "http://projects.local",
    notificationsUrl: "http://notifications.local",
    fetchFn: routeFetch,
  }).app;

  const gateway = createGatewayApp({
    projectsUrl: "http://projects.local",
    tasksUrl: "http://tasks.local",
    notificationsUrl: "http://notifications.local",
    internalToken,
    corsOrigin: "http://localhost:3000",
    fetchFn: routeFetch,
  });
  gatewayRef = gateway.app;

  return {
    internalToken,
    gateway: gatewayRef,
    projects: projectsRef,
    tasks: tasksRef,
    notifications: notificationsRef,
    close: async () => {
      await projectsStore.close();
      await tasksStore.close();
      await notificationsStore.close();
    },
  };
}

const pmId = PREDEFINED_USERS[0].id;
const engId = PREDEFINED_USERS[1].id;
const sampleProjectId = SAMPLE_PROJECTS[0].id;

describe("Boundary Validation, Zero-Trust Security & OpenAPI Contracts", () => {
  it("rejects direct microservice requests missing or with wrong X-Internal-Service-Token (401)", async () => {
    const stack = await buildTestStack();
    try {
      for (const [app, path] of [
        [stack.projects, "http://projects.local/api/v1/projects"],
        [stack.tasks, `http://tasks.local/api/v1/projects/${sampleProjectId}/tasks`],
        [stack.notifications, "http://notifications.local/api/v1/notifications"],
        [stack.gateway, "http://gateway.local/internal/v1/events"],
      ] as const) {
        const resNoToken = await app.handle(new Request(path, { method: path.includes("internal") ? "POST" : "GET" }));
        expect(resNoToken.status).toBe(401);
        const body = (await resNoToken.json()) as { error: { code: string } };
        expect(body.error.code).toBe("UNAUTHORIZED_SERVICE");

        const resWrongToken = await app.handle(
          new Request(path, {
            method: path.includes("internal") ? "POST" : "GET",
            headers: { "x-internal-service-token": "wrong-secret" },
          }),
        );
        expect(resWrongToken.status).toBe(401);
      }
    } finally {
      await stack.close();
    }
  });

  it("enforces Zod validation independently at microservice boundaries too", async () => {
    const stack = await buildTestStack();
    try {
      const res = await stack.projects.handle(
        new Request("http://projects.local/api/v1/projects", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-service-token": stack.internalToken,
            "x-active-user-id": pmId,
          },
          body: JSON.stringify({ name: "    ", description: "Should fail at microservice boundary" }),
        }),
      );
      expect(res.status).toBe(400);
      const payload = (await res.json()) as { error: { code: string; details?: unknown[] } };
      expect(payload.error.code).toBe("VALIDATION_ERROR");
      expect(Array.isArray(payload.error.details)).toBe(true);
    } finally {
      await stack.close();
    }
  });

  it("rejects invalid project, task, status, assignee, header, and comment payloads at the gateway with 400", async () => {
    const stack = await buildTestStack();
    try {
      // Missing X-Active-User-Id
      const missingUser = await stack.gateway.handle(
        new Request("http://gateway.local/api/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Valid Project" }),
        }),
      );
      expect(missingUser.status).toBe(400);

      // Unknown X-Active-User-Id UUID
      const unknownUser = await stack.gateway.handle(
        new Request("http://gateway.local/api/v1/projects", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-active-user-id": "99999999-9999-4999-8999-999999999999",
          },
          body: JSON.stringify({ name: "Valid Project" }),
        }),
      );
      expect(unknownUser.status).toBe(400);
      expect(((await unknownUser.json()) as any).error.code).toBe("INVALID_USER");

      // Over-limit project name (>100 chars)
      const longProject = await stack.gateway.handle(
        new Request("http://gateway.local/api/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json", "x-active-user-id": pmId },
          body: JSON.stringify({ name: "a".repeat(101) }),
        }),
      );
      expect(longProject.status).toBe(400);

      // Unrecognized Kanban column status & invalid assignee UUID
      const badTask = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/projects/${sampleProjectId}/tasks`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-active-user-id": engId },
          body: JSON.stringify({ title: "Test", status: "Archived" }),
        }),
      );
      expect(badTask.status).toBe(400);
      expect(((await badTask.json()) as any).error.code).toBe("VALIDATION_ERROR");

      const badAssignee = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/projects/${sampleProjectId}/tasks`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-active-user-id": engId },
          body: JSON.stringify({
            title: "Test",
            assigneeId: "99999999-9999-4999-8999-999999999999",
          }),
        }),
      );
      expect(badAssignee.status).toBe(400);

      // Whitespace-only comment
      const badComment = await stack.gateway.handle(
        new Request("http://gateway.local/api/v1/tasks/33333333-3333-4333-8333-333333333301/comments", {
          method: "POST",
          headers: { "content-type": "application/json", "x-active-user-id": engId },
          body: JSON.stringify({ content: "   \n\t  " }),
        }),
      );
      expect(badComment.status).toBe(400);
    } finally {
      await stack.close();
    }
  });

  it("attaches security headers and exposes OpenAPI 3.1 Swagger docs on all services", async () => {
    const stack = await buildTestStack();
    try {
      const gwRes = await stack.gateway.handle(new Request("http://gateway.local/api/v1/users"));
      expect(gwRes.status).toBe(200);
      expect(gwRes.headers.get("x-content-type-options")).toBe("nosniff");
      expect(gwRes.headers.get("x-frame-options")).toBe("DENY");
      expect(gwRes.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");

      for (const [app, url] of [
        [stack.gateway, "http://gateway.local/swagger/json"],
        [stack.projects, "http://projects.local/swagger/json"],
        [stack.tasks, "http://tasks.local/swagger/json"],
        [stack.notifications, "http://notifications.local/swagger/json"],
      ] as const) {
        const docRes = await app.handle(new Request(url));
        expect(docRes.status).toBe(200);
        const spec = (await docRes.json()) as { openapi: string; paths: Record<string, unknown> };
        expect(spec.openapi).toBe("3.1.0");
        expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
      }
    } finally {
      await stack.close();
    }
  });
});
