/**
 * Root application shell for Taskify React SSR & client workspace (`apps/web`).
 */

import React, { useMemo, useRef, useState } from "react";
import {
  DEFAULT_ACTIVE_USER_ID,
  type NotificationDto,
  type ProjectDto,
  type TaskDto,
  type UserDto,
} from "@taskify/shared/browser";
import { ApiClient } from "../lib/api-client.ts";
import { WorkspaceIndexRoute } from "./index.tsx";
import { ProjectBoardRoute } from "./projects.$projectId.tsx";

/** Initial server-rendered state passed to both SSR and browser hydration. */
export interface TaskifyInitialState {
  readonly users: UserDto[];
  readonly projects: ProjectDto[];
  readonly selectedProjectId: string | null;
  readonly tasks: TaskDto[];
  readonly notifications: NotificationDto[];
  readonly apiBaseUrl?: string;
}

/**
 * Root Taskify shell providing active-user state (`X-Active-User-Id`) and route switching
 * between the project workspace overview and the active Kanban board view.
 */
export function RootShell({ initialState }: { readonly initialState: TaskifyInitialState }) {
  const [activeUserId, setActiveUserId] = useState<string>(
    initialState.users[0]?.id ?? DEFAULT_ACTIVE_USER_ID,
  );
  const activeUserIdRef = useRef(activeUserId);
  activeUserIdRef.current = activeUserId;

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialState.selectedProjectId ?? initialState.projects[0]?.id ?? null,
  );

  const apiBaseUrl = initialState.apiBaseUrl ?? "";
  const api = useMemo(
    () => new ApiClient(apiBaseUrl, () => activeUserIdRef.current),
    [apiBaseUrl],
  );

  if (selectedProjectId) {
    return (
      <ProjectBoardRoute
        api={api}
        apiBaseUrl={apiBaseUrl}
        activeUserId={activeUserId}
        onSelectUser={setActiveUserId}
        selectedProjectId={selectedProjectId}
        onSelectProject={(projectId) => {
          setSelectedProjectId(projectId);
          if (typeof window !== "undefined") {
            window.history.pushState({}, "", `/projects/${projectId}`);
          }
        }}
        initialUsers={initialState.users}
        initialProjects={initialState.projects}
        initialTasks={initialState.tasks}
        initialNotifications={initialState.notifications}
      />
    );
  }

  return (
    <WorkspaceIndexRoute
      api={api}
      activeUserId={activeUserId}
      onSelectUser={setActiveUserId}
      onSelectProject={(projectId) => {
        setSelectedProjectId(projectId);
        if (typeof window !== "undefined") {
          window.history.pushState({}, "", `/projects/${projectId}`);
        }
      }}
      initialUsers={initialState.users}
      initialProjects={initialState.projects}
      initialNotifications={initialState.notifications}
    />
  );
}
