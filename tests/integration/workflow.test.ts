import { describe, expect, it } from "bun:test";
import { PREDEFINED_USERS, SAMPLE_PROJECTS } from "@taskify/shared";
import { createGatewayApp } from "../../services/api-gateway/src/index.ts";
import { createNotificationsStore } from "../../services/notifications-service/src/db/client.ts";
import { createNotificationsApp } from "../../services/notifications-service/src/index.ts";
import { createProjectsStore } from "../../services/projects-service/src/db/client.ts";
import { createProjectsApp } from "../../services/projects-service/src/index.ts";
import { createTasksStore } from "../../services/tasks-service/src/db/client.ts";
import { createTasksApp } from "../../services/tasks-service/src/index.ts";

async function buildIntegrationStack() {
  const internalToken = "integration-internal-token";
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
    throw new Error(`Unexpected URL: ${url}`);
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
    fetchFn: routeFetch,
  });
  gatewayRef = gateway.app;

  return {
    gateway: gatewayRef,
    close: async () => {
      await projectsStore.close();
      await tasksStore.close();
      await notificationsStore.close();
    },
  };
}

describe("Taskify Phase 1 Full Workflow Integration", () => {
  it("loads 5 predefined users (1 PM, 4 Engineers) and 3 sample projects without login", async () => {
    const stack = await buildIntegrationStack();
    try {
      const usersRes = await stack.gateway.handle(new Request("http://gateway.local/api/v1/users"));
      expect(usersRes.status).toBe(200);
      const { users } = (await usersRes.json()) as { users: Array<{ role: string }> };
      expect(users).toHaveLength(5);
      expect(users.filter((u) => u.role === "Product Manager")).toHaveLength(1);
      expect(users.filter((u) => u.role === "Engineer")).toHaveLength(4);

      const projectsRes = await stack.gateway.handle(new Request("http://gateway.local/api/v1/projects"));
      expect(projectsRes.status).toBe(200);
      const { projects } = (await projectsRes.json()) as { projects: Array<{ id: string }> };
      expect(projects).toHaveLength(3);

      const tasksRes = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/projects/${SAMPLE_PROJECTS[0].id}/tasks`),
      );
      expect(tasksRes.status).toBe(200);
      const { tasks } = (await tasksRes.json()) as { tasks: Array<{ status: string }> };
      expect(tasks.length).toBeGreaterThanOrEqual(4);
    } finally {
      await stack.close();
    }
  });

  it("supports project creation, task assignment (0..1), unrestricted column moves, and comment ownership", async () => {
    const stack = await buildIntegrationStack();
    const pm = PREDEFINED_USERS[0].id;
    const sam = PREDEFINED_USERS[1].id;
    const jordan = PREDEFINED_USERS[2].id;

    try {
      // Subscribe to SSE stream first
      const sseController = new AbortController();
      const sseRes = await stack.gateway.handle(
        new Request("http://gateway.local/api/v1/events/stream", { signal: sseController.signal }),
      );
      expect(sseRes.status).toBe(200);
      const reader = sseRes.body!.getReader();
      const decoder = new TextDecoder();

      // Create new project
      const createProjRes = await stack.gateway.handle(
        new Request("http://gateway.local/api/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json", "x-active-user-id": pm },
          body: JSON.stringify({ name: "  Phase 1 Launch  ", description: "  Ship Kanban MVP  " }),
        }),
      );
      expect(createProjRes.status).toBe(201);
      const { project } = (await createProjRes.json()) as { project: { id: string; name: string } };
      expect(project.name).toBe("Phase 1 Launch");

      // Create task assigned to Sam
      const createTaskRes = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/projects/${project.id}/tasks`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-active-user-id": sam },
          body: JSON.stringify({ title: "Build SSE feed", assigneeId: sam }),
        }),
      );
      expect(createTaskRes.status).toBe(201);
      const { task } = (await createTaskRes.json()) as {
        task: { id: string; status: string; assigneeId: string | null };
      };
      expect(task.status).toBe("To Do");
      expect(task.assigneeId).toBe(sam);

      // Unrestricted column transitions: To Do -> In Review -> To Do -> Done by Jordan
      for (const nextStatus of ["In Review", "To Do", "Done"] as const) {
        const moveRes = await stack.gateway.handle(
          new Request(`http://gateway.local/api/v1/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-active-user-id": jordan },
            body: JSON.stringify({ status: nextStatus }),
          }),
        );
        expect(moveRes.status).toBe(200);
        const moved = (await moveRes.json()) as { task: { status: string } };
        expect(moved.task.status).toBe(nextStatus);
      }

      // Reassign to PM, then unassign (null)
      const reassignRes = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-active-user-id": jordan },
          body: JSON.stringify({ assigneeId: pm }),
        }),
      );
      expect(reassignRes.status).toBe(200);
      expect(((await reassignRes.json()) as any).task.assigneeId).toBe(pm);

      const unassignRes = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-active-user-id": sam },
          body: JSON.stringify({ assigneeId: null }),
        }),
      );
      expect(unassignRes.status).toBe(200);
      expect(((await unassignRes.json()) as any).task.assigneeId).toBeNull();

      // Comment creation and author-only edit/delete
      const postCommentRes = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/tasks/${task.id}/comments`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-active-user-id": sam },
          body: JSON.stringify({ content: "Initial implementation note" }),
        }),
      );
      expect(postCommentRes.status).toBe(201);
      const { comment } = (await postCommentRes.json()) as { comment: { id: string; authorId: string } };
      expect(comment.authorId).toBe(sam);

      // Non-author Jordan tries to edit or delete Sam's comment -> 403
      const forbiddenEdit = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/comments/${comment.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-active-user-id": jordan },
          body: JSON.stringify({ content: "Tampered text" }),
        }),
      );
      expect(forbiddenEdit.status).toBe(403);
      expect(((await forbiddenEdit.json()) as any).error.code).toBe("FORBIDDEN_NOT_COMMENT_AUTHOR");

      const forbiddenDelete = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/comments/${comment.id}`, {
          method: "DELETE",
          headers: { "x-active-user-id": jordan },
        }),
      );
      expect(forbiddenDelete.status).toBe(403);

      // Author Sam can edit and delete his own comment
      const allowedEdit = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/comments/${comment.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-active-user-id": sam },
          body: JSON.stringify({ content: "Updated by Sam" }),
        }),
      );
      expect(allowedEdit.status).toBe(200);
      expect(((await allowedEdit.json()) as any).comment.content).toBe("Updated by Sam");

      const allowedDelete = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/comments/${comment.id}`, {
          method: "DELETE",
          headers: { "x-active-user-id": sam },
        }),
      );
      expect(allowedDelete.status).toBe(200);

      // Notifications persisted and readable + mark as read
      const notifRes = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/notifications?projectId=${project.id}`),
      );
      expect(notifRes.status).toBe(200);
      const { notifications } = (await notifRes.json()) as {
        notifications: Array<{ id: string; isRead: boolean }>;
      };
      expect(notifications.length).toBeGreaterThanOrEqual(5);

      const readRes = await stack.gateway.handle(
        new Request(`http://gateway.local/api/v1/notifications/${notifications[0]!.id}/read`, {
          method: "PATCH",
          headers: { "x-active-user-id": pm },
        }),
      );
      expect(readRes.status).toBe(200);
      expect(((await readRes.json()) as any).notification.isRead).toBe(true);

      // Confirm SSE stream received real-time event frames
      let sseOutput = "";
      for (let i = 0; i < 25; i++) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (chunk.value) sseOutput += decoder.decode(chunk.value);
        if (
          sseOutput.includes("event: project.created") &&
          sseOutput.includes("event: task.updated") &&
          sseOutput.includes("event: comment.changed") &&
          sseOutput.includes("event: notification.created")
        ) {
          break;
        }
      }
      expect(sseOutput).toContain("event: project.created");
      expect(sseOutput).toContain("event: task.updated");
      expect(sseOutput).toContain("event: comment.changed");
      expect(sseOutput).toContain("event: notification.created");
      sseController.abort();
    } finally {
      await stack.close();
    }
  });
});
