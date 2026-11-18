/**
 * Workspace index route displaying the zero-login predefined user switcher,
 * seeded sample projects, and new project creation modal (`US1`).
 */

import React, { useState } from "react";
import type { NotificationDto, ProjectDto, UserDto } from "@taskify/shared";
import { CreateProjectModal } from "../components/CreateProjectModal.tsx";
import { NotificationBell } from "../components/NotificationBell.tsx";
import { ProjectList } from "../components/ProjectList.tsx";
import { UserSwitcher } from "../components/UserSwitcher.tsx";
import { useProjects } from "../hooks/useProjects.ts";
import type { ApiClient } from "../lib/api-client.ts";

/** Props for {@link WorkspaceIndexRoute}. */
export interface WorkspaceIndexRouteProps {
  readonly api: ApiClient;
  readonly activeUserId: string;
  readonly onSelectUser: (userId: string) => void;
  readonly onSelectProject: (projectId: string) => void;
  readonly initialUsers: UserDto[];
  readonly initialProjects: ProjectDto[];
  readonly initialNotifications: NotificationDto[];
}

/**
 * Renders the zero-login workspace landing view when no project board is selected.
 */
export function WorkspaceIndexRoute({
  api,
  activeUserId,
  onSelectUser,
  onSelectProject,
  initialUsers,
  initialProjects,
  initialNotifications,
}: WorkspaceIndexRouteProps) {
  const { users, projects, notifications, createProject, markNotificationRead } = useProjects(
    api,
    initialUsers,
    initialProjects,
    initialNotifications,
  );
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem 1.25rem",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
        <strong style={{ fontSize: "1.15rem", color: "#0f172a" }}>Taskify</strong>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <UserSwitcher users={users} activeUserId={activeUserId} onSelectUser={onSelectUser} />
          <NotificationBell notifications={notifications} onMarkRead={markNotificationRead} />
        </div>
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        <ProjectList
          projects={projects}
          selectedProjectId={null}
          onSelectProject={onSelectProject}
          onOpenCreateModal={() => setCreateOpen(true)}
        />
        <main style={{ flex: 1, padding: "2rem" }}>
          <h1 style={{ marginTop: 0 }}>Select a Project Board</h1>
          <p style={{ color: "#475569" }}>
            Choose one of the sample projects from the sidebar or create a new project to manage Kanban tasks.
          </p>
        </main>
      </div>

      <CreateProjectModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input) => {
          const created = await createProject(input);
          onSelectProject(created.id);
        }}
      />
    </div>
  );
}
