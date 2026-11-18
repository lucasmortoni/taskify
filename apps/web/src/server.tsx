/**
 * Lightweight React 19 SSR server & API proxy for `@taskify/web` (port `3000`).
 *
 * Hydrates initial predefined users, sample projects, tasks, and notifications server-side
 * so zero login steps block initial workspace rendering (`SC-001`).
 */

import React from "react";
import { renderToString } from "react-dom/server";
import type { NotificationDto, ProjectDto, TaskDto, UserDto } from "@taskify/shared";
import { PREDEFINED_USERS, SAMPLE_PROJECTS } from "@taskify/shared";
import appConfig from "../app.config.ts";
import { RootShell, type TaskifyInitialState } from "../app/routes/__root.tsx";

/** Options for creating the `@taskify/web` SSR request handler. */
export interface WebServerOptions {
  readonly gatewayUrl?: string;
  readonly fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
  readonly clientBundleJs?: string;
}

/** Builds the browser client bundle once via `Bun.build`. */
async function buildClientBundle(): Promise<string> {
  try {
    const result = await Bun.build({
      entrypoints: [`${import.meta.dir}/client.tsx`],
      target: "browser",
      minify: true,
    });
    if (result.success && result.outputs[0]) {
      return await result.outputs[0].text();
    }
  } catch {
    // Fallback empty script if invoked in unit-only test environments
  }
  return "";
}

/** Fetches initial SSR data from `api-gateway`, falling back to roster defaults if gateway is starting up. */
async function loadInitialState(
  requestedProjectId: string | null,
  gatewayUrl: string,
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>,
): Promise<TaskifyInitialState> {
  let users: UserDto[] = PREDEFINED_USERS.map((u) => ({
    ...u,
    createdAt: new Date(0).toISOString(),
  }));
  let projects: ProjectDto[] = SAMPLE_PROJECTS.map((p) => ({
    ...p,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
  let tasks: TaskDto[] = [];
  let notifications: NotificationDto[] = [];

  try {
    const [usersRes, projectsRes, notifRes] = await Promise.all([
      fetchFn(`${gatewayUrl}/api/v1/users`),
      fetchFn(`${gatewayUrl}/api/v1/projects`),
      fetchFn(`${gatewayUrl}/api/v1/notifications`),
    ]);

    if (usersRes.ok) {
      const data = (await usersRes.json()) as { users: UserDto[] };
      users = data.users;
    }
    if (projectsRes.ok) {
      const data = (await projectsRes.json()) as { projects: ProjectDto[] };
      projects = data.projects;
    }
    if (notifRes.ok) {
      const data = (await notifRes.json()) as { notifications: NotificationDto[] };
      notifications = data.notifications;
    }

    const selectedProjectId =
      requestedProjectId && projects.some((p) => p.id === requestedProjectId)
        ? requestedProjectId
        : (projects[0]?.id ?? null);

    if (selectedProjectId) {
      const tasksRes = await fetchFn(`${gatewayUrl}/api/v1/projects/${selectedProjectId}/tasks`);
      if (tasksRes.ok) {
        const data = (await tasksRes.json()) as { tasks: TaskDto[] };
        tasks = data.tasks;
      }
    }

    return { users, projects, selectedProjectId, tasks, notifications, apiBaseUrl: "" };
  } catch {
    return {
      users,
      projects,
      selectedProjectId: projects[0]?.id ?? null,
      tasks,
      notifications,
      apiBaseUrl: "",
    };
  }
}

/**
 * Creates a Bun HTTP request handler serving SSR pages, bundled client assets, and `/api/v1/*` proxies.
 */
export function createWebRequestHandler(options: WebServerOptions = {}) {
  const gatewayUrl = (options.gatewayUrl ?? appConfig.apiGatewayUrl).replace(/\/$/, "");
  const fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
  const clientBundlePromise = options.clientBundleJs
    ? Promise.resolve(options.clientBundleJs)
    : buildClientBundle();

  return async function handleWebRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/assets/client.js") {
      const js = await clientBundlePromise;
      return new Response(js, {
        status: 200,
        headers: { "content-type": "application/javascript; charset=utf-8" },
      });
    }

    if (url.pathname.startsWith("/api/v1/")) {
      const upstreamUrl = `${gatewayUrl}${url.pathname}${url.search}`;
      const headers = new Headers(request.headers);
      headers.delete("host");
      const upstreamRes = await fetchFn(upstreamUrl, {
        method: request.method,
        headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined,
      });
      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: upstreamRes.headers,
      });
    }

    const projectMatch = url.pathname.match(/^\/projects\/([0-9a-f-]{36})$/i);
    const requestedProjectId = projectMatch ? projectMatch[1]!.toLowerCase() : null;
    const initialState = await loadInitialState(requestedProjectId, gatewayUrl, fetchFn);
    const ssrHtml = renderToString(<RootShell initialState={initialState} />);
    const serializedState = JSON.stringify(initialState).replace(/</g, "\\u003c");

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Taskify - Team Kanban Platform</title>
</head>
<body style="margin:0;background:#f8fafc;">
  <div id="root">${ssrHtml}</div>
  <script id="__TASKIFY_INITIAL_DATA__" type="application/json">${serializedState}</script>
  <script type="module" src="/assets/client.js"></script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      },
    });
  };
}

if (import.meta.main) {
  const handler = createWebRequestHandler();
  const server = Bun.serve({
    port: appConfig.port,
    idleTimeout: 120,
    fetch: handler,
  });
  console.log(`[web] Listening on http://localhost:${server.port}`);
}
