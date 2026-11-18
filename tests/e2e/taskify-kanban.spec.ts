import { describe, expect, it } from "bun:test";
import { chromium } from "playwright";
import { PREDEFINED_USERS, SAMPLE_PROJECTS } from "@taskify/shared";
import { createWebRequestHandler } from "../../apps/web/src/server.tsx";
import { createGatewayApp } from "../../services/api-gateway/src/index.ts";
import { createNotificationsStore } from "../../services/notifications-service/src/db/client.ts";
import { createNotificationsApp } from "../../services/notifications-service/src/index.ts";
import { createProjectsStore } from "../../services/projects-service/src/db/client.ts";
import { createProjectsApp } from "../../services/projects-service/src/index.ts";
import { createTasksStore } from "../../services/tasks-service/src/db/client.ts";
import { createTasksApp } from "../../services/tasks-service/src/index.ts";

describe("Taskify Web SSR & End-to-End Proxy Flows", () => {
  it("renders zero-login Kanban board HTML with 5 predefined users, 3 sample projects, and bundled client script", async () => {
    const internalToken = "e2e-internal-token";
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
    gatewayRef = createGatewayApp({
      projectsUrl: "http://projects.local",
      tasksUrl: "http://tasks.local",
      notificationsUrl: "http://notifications.local",
      internalToken,
      fetchFn: routeFetch,
    }).app;

    const handleWebRequest = createWebRequestHandler({
      gatewayUrl: "http://gateway.local",
      fetchFn: routeFetch,
    });

    try {
      const pageRes = await handleWebRequest(new Request("http://localhost:3000/"));
      expect(pageRes.status).toBe(200);
      const html = await pageRes.text();

      for (const user of PREDEFINED_USERS) {
        expect(html).toContain(user.name);
      }
      for (const project of SAMPLE_PROJECTS) {
        expect(html).toContain(project.name);
      }
      for (const col of ["To Do", "In Progress", "In Review", "Done"]) {
        expect(html).toContain(col);
      }

      const clientJsRes = await handleWebRequest(new Request("http://localhost:3000/assets/client.js"));
      expect(clientJsRes.status).toBe(200);
      const clientJs = await clientJsRes.text();
      expect(clientJs.length).toBeGreaterThan(100);

      const createRes = await handleWebRequest(
        new Request(`http://localhost:3000/api/v1/projects/${SAMPLE_PROJECTS[1].id}/tasks`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-active-user-id": PREDEFINED_USERS[3].id,
          },
          body: JSON.stringify({ title: "E2E Proxy Task", assigneeId: PREDEFINED_USERS[0].id }),
        }),
      );
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { task: { title: string; assigneeId: string } };
      expect(created.task.title).toBe("E2E Proxy Task");
      expect(created.task.assigneeId).toBe(PREDEFINED_USERS[0].id);
    } finally {
      await projectsStore.close();
      await tasksStore.close();
      await notificationsStore.close();
    }
  });

  it(
    "executes full Kanban, assignment, validation, comment ownership, and real-time notification flows in headless Chromium",
    async () => {
      const internalToken = process.env.INTERNAL_SERVICE_TOKEN ?? "e2e-browser-internal-token";
      const webPort = 14100;
      const gatewayPort = 14101;
      const projectsPort = 14102;
      const tasksPort = 14103;
      const notificationsPort = 14104;

      const projectsUrl = `http://127.0.0.1:${projectsPort}`;
      const tasksUrl = `http://127.0.0.1:${tasksPort}`;
      const notificationsUrl = `http://127.0.0.1:${notificationsPort}`;
      const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
      const webUrl = `http://127.0.0.1:${webPort}`;

      const projectsStore = createProjectsStore();
      const tasksStore = createTasksStore();
      const notificationsStore = createNotificationsStore();

      await projectsStore.migrate();
      await projectsStore.seed();
      await tasksStore.migrate();
      await tasksStore.seed();
      await notificationsStore.migrate();

      const notificationsService = createNotificationsApp({
        store: notificationsStore,
        internalToken,
        gatewayUrl,
      });
      const projectsService = createProjectsApp({
        store: projectsStore,
        internalToken,
        notificationsUrl,
      });
      const tasksService = createTasksApp({
        store: tasksStore,
        internalToken,
        projectsUrl,
        notificationsUrl,
      });
      const gatewayService = createGatewayApp({
        projectsUrl,
        tasksUrl,
        notificationsUrl,
        internalToken,
        corsOrigin: webUrl,
      });

      notificationsService.app.listen({ hostname: "127.0.0.1", port: notificationsPort });
      projectsService.app.listen({ hostname: "127.0.0.1", port: projectsPort });
      tasksService.app.listen({ hostname: "127.0.0.1", port: tasksPort });
      gatewayService.app.listen({ hostname: "127.0.0.1", port: gatewayPort, idleTimeout: 120 });

      const webServer = Bun.serve({
        hostname: "127.0.0.1",
        port: webPort,
        idleTimeout: 120,
        fetch: createWebRequestHandler({ gatewayUrl }),
      });

      const browser = await chromium.launch({
        headless: true,
        env: {
          ...process.env,
          LD_LIBRARY_PATH: `/tmp/pw-libs/usr/lib/x86_64-linux-gnu:${process.env.LD_LIBRARY_PATH ?? ""}`,
        },
      });

      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(5000);

        const consoleErrors: string[] = [];
        page.on("pageerror", (err) => consoleErrors.push(err.message));
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        await page.goto(webUrl, { waitUntil: "load" });

        // 1. Zero login barrier; 5 predefined users and 3 sample projects visible
        const userSelect = page.locator("#active-user-select");
        await userSelect.waitFor({ state: "visible" });
        const optionTexts = await userSelect.locator("option").allTextContents();
        expect(optionTexts).toHaveLength(5);
        for (const user of PREDEFINED_USERS) {
          expect(optionTexts.some((txt) => txt.includes(user.name) && txt.includes(user.role))).toBe(true);
        }
        for (const project of SAMPLE_PROJECTS) {
          await page.getByRole("button", { name: new RegExp(project.name) }).first().waitFor({ state: "visible" });
        }

        // 2. Project validation error on whitespace name, then create a valid project
        const uniqueSuffix = Date.now();
        const newProjectName = `Browser E2E Project ${uniqueSuffix}`;
        await page.getByRole("button", { name: "+ New Project" }).click();
        await page.getByLabel("Project Name *").fill("   ");
        await page.getByRole("button", { name: "Create Project" }).click();
        const projectAlert = page.getByRole("alert");
        await projectAlert.waitFor({ state: "visible" });
        expect(await projectAlert.textContent()).toContain("empty");

        await page.getByLabel("Project Name *").fill(newProjectName);
        await page.getByLabel("Description (optional)").fill("Created via headless Chromium");
        await page.getByRole("button", { name: "Create Project" }).click();
        await page.getByRole("heading", { name: newProjectName }).waitFor({ state: "visible" });

        // 3. Create task assigned to Sam Rivera
        const taskTitle = `Headless Chromium Task ${uniqueSuffix}`;
        await page.getByRole("button", { name: "+ New Task" }).click();
        await page.getByLabel("Title *").fill(taskTitle);
        await page.getByLabel("Assignee").selectOption(PREDEFINED_USERS[1].id);
        await page.getByRole("button", { name: "Create Task" }).click();

        const todoColumn = page.locator('[data-column-status="To Do"]');
        const inReviewColumn = page.locator('[data-column-status="In Review"]');
        const doneColumn = page.locator('[data-column-status="Done"]');

        const cardInTodo = todoColumn.locator("article", { hasText: taskTitle });
        await cardInTodo.waitFor({ state: "visible" });

        // 4. Drag-and-drop card directly from To Do to In Review, then move to Done via dropdown
        await cardInTodo.locator("[data-drag-handle]").dragTo(inReviewColumn);
        const cardInReview = inReviewColumn.locator("article", { hasText: taskTitle });
        await cardInReview.waitFor({ state: "visible" });

        await cardInReview.getByLabel(`Move ${taskTitle} to column`).selectOption("Done");
        const cardInDone = doneColumn.locator("article", { hasText: taskTitle });
        await cardInDone.waitFor({ state: "visible" });

        // Reassign to Alex Morgan, then unassign
        await cardInDone.getByLabel(`Assign ${taskTitle}`).selectOption(PREDEFINED_USERS[0].id);
        await cardInDone.getByText("Alex Morgan (PM)").waitFor({ state: "visible" });
        await cardInDone.getByLabel(`Assign ${taskTitle}`).selectOption("");
        await cardInDone.locator("span", { hasText: /^Unassigned$/ }).waitFor({ state: "visible" });

        // Confirm persistence across browser reload
        await page.reload({ waitUntil: "load" });
        await page
          .locator('[data-column-status="Done"] article', { hasText: taskTitle })
          .waitFor({ state: "visible" });

        // 5. Open TaskModal, post and edit comment as Alex Morgan, verify Jordan Lee cannot see Edit/Delete
        await page.getByRole("button", { name: taskTitle }).click();
        const modal = page.getByRole("dialog");
        await modal.waitFor({ state: "visible" });

        const originalComment = `Verified in Chromium ${uniqueSuffix}`;
        const updatedComment = `Edited in Chromium ${uniqueSuffix}`;
        await modal.getByLabel("New comment").fill(originalComment);
        await modal.getByRole("button", { name: "Post Comment" }).click();
        await modal.getByText(originalComment).waitFor({ state: "visible" });

        const commentLocator = modal.locator("[data-comment-id]", { hasText: originalComment });
        const commentId = await commentLocator.getAttribute("data-comment-id");
        const commentCard = modal.locator(`[data-comment-id="${commentId}"]`);
        await commentCard.getByRole("button", { name: "Edit" }).click();
        await commentCard.getByLabel("Edit comment text").fill(updatedComment);
        await commentCard.getByRole("button", { name: "Save" }).click();
        await modal.getByText(updatedComment).waitFor({ state: "visible" });

        // Switch active user to Jordan Lee -> Edit/Delete must disappear on Alex's comment
        await modal.getByRole("button", { name: "Close task detail" }).click();
        await userSelect.selectOption(PREDEFINED_USERS[2].id);
        await page.getByRole("button", { name: taskTitle }).click();
        const reopenedModal = page.getByRole("dialog");
        await reopenedModal.getByText(updatedComment).waitFor({ state: "visible" });
        const alexCommentCard = reopenedModal.locator("[data-comment-id]", { hasText: updatedComment });
        expect(await alexCommentCard.getByRole("button", { name: "Edit" }).count()).toBe(0);
        expect(await alexCommentCard.getByRole("button", { name: "Delete" }).count()).toBe(0);
        await reopenedModal.getByRole("button", { name: "Close task detail" }).click();

        // 6. Open Notifications bell and confirm live activity notifications
        await page.getByRole("button", { name: /^Notifications/ }).click();
        const notifPanel = page.getByRole("region", { name: "Recent notifications" });
        await notifPanel.waitFor({ state: "visible" });
        await notifPanel.getByText(new RegExp(newProjectName)).first().waitFor({ state: "visible" });

        expect(consoleErrors).toEqual([]);
      } finally {
        await browser.close();
        webServer.stop(true);
        gatewayService.app.server?.stop(true);
        tasksService.app.server?.stop(true);
        projectsService.app.server?.stop(true);
        notificationsService.app.server?.stop(true);
        await projectsStore.close();
        await tasksStore.close();
        await notificationsStore.close();
      }
    },
    { timeout: 30_000 },
  );
});
