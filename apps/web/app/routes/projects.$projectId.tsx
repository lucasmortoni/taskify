/**
 * Interactive project Kanban board route integrating `ProjectList`, `KanbanBoard`,
 * `CreateProjectModal`, `CreateTaskModal`, `TaskModal`, and live SSE updates (`US1`, `US2`, `US3`).
 */

import React, { useEffect, useState } from "react";
import type { NotificationDto, ProjectDto, TaskDto, UserDto } from "@taskify/shared";
import { CreateProjectModal } from "../components/CreateProjectModal.tsx";
import { CreateTaskModal } from "../components/CreateTaskModal.tsx";
import { KanbanBoard } from "../components/KanbanBoard.tsx";
import { NotificationBell } from "../components/NotificationBell.tsx";
import { ProjectList } from "../components/ProjectList.tsx";
import { TaskModal } from "../components/TaskModal.tsx";
import { UserSwitcher } from "../components/UserSwitcher.tsx";
import { useComments } from "../hooks/useComments.ts";
import { useProjects } from "../hooks/useProjects.ts";
import { useRealtimeEvents } from "../hooks/useRealtimeEvents.ts";
import { useTasks } from "../hooks/useTasks.ts";
import type { ApiClient } from "../lib/api-client.ts";

/** Props for {@link ProjectBoardRoute}. */
export interface ProjectBoardRouteProps {
  readonly api: ApiClient;
  readonly apiBaseUrl: string;
  readonly activeUserId: string;
  readonly onSelectUser: (userId: string) => void;
  readonly selectedProjectId: string;
  readonly onSelectProject: (projectId: string) => void;
  readonly initialUsers: UserDto[];
  readonly initialProjects: ProjectDto[];
  readonly initialTasks: TaskDto[];
  readonly initialNotifications: NotificationDto[];
}

/**
 * Renders the full Taskify Kanban workspace for a selected project with real-time SSE sync.
 */
export function ProjectBoardRoute({
  api,
  apiBaseUrl,
  activeUserId,
  onSelectUser,
  selectedProjectId,
  onSelectProject,
  initialUsers,
  initialProjects,
  initialTasks,
  initialNotifications,
}: ProjectBoardRouteProps) {
  const {
    users,
    projects,
    notifications,
    refreshProjects,
    refreshNotifications,
    createProject,
    markNotificationRead,
  } = useProjects(api, initialUsers, initialProjects, initialNotifications);

  const { tasks, refreshTasks, createTask, updateTaskOptimistic, taskError } = useTasks(
    api,
    selectedProjectId,
    initialTasks,
  );

  const {
    selectedTask,
    setSelectedTask,
    comments,
    openTask,
    closeTask,
    refreshOpenTask,
    createComment,
    updateComment,
    deleteComment,
  } = useComments(api);

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const activeProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  useEffect(() => {
    void refreshTasks(selectedProjectId);
    closeTask();
  }, [selectedProjectId, refreshTasks, closeTask]);

  useRealtimeEvents(apiBaseUrl, selectedProjectId, {
    onProjectCreated: () => {
      void refreshProjects();
    },
    onTaskChanged: () => {
      void refreshTasks(selectedProjectId);
      void refreshOpenTask();
    },
    onCommentChanged: () => {
      void refreshTasks(selectedProjectId);
      void refreshOpenTask();
    },
    onNotificationCreated: () => {
      void refreshNotifications();
    },
  });

  const handleMoveStatus = async (taskId: string, nextStatus: TaskDto["status"]) => {
    const updated = await updateTaskOptimistic(taskId, { status: nextStatus });
    if (selectedTask?.id === taskId) {
      setSelectedTask(updated);
    }
  };

  const handleAssignUser = async (taskId: string, assigneeId: string | null) => {
    const updated = await updateTaskOptimistic(taskId, { assigneeId });
    if (selectedTask?.id === taskId) {
      setSelectedTask(updated);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem 1.25rem",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <strong style={{ fontSize: "1.15rem" }}>Taskify</strong>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Team Kanban Workspace</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <UserSwitcher users={users} activeUserId={activeUserId} onSelectUser={onSelectUser} />
          <NotificationBell notifications={notifications} onMarkRead={markNotificationRead} />
        </div>
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        <ProjectList
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={onSelectProject}
          onOpenCreateModal={() => setCreateProjectOpen(true)}
        />

        <main style={{ flex: 1, padding: "1.25rem 1.5rem", overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.35rem" }}>
                {activeProject?.name ?? "Project Board"}
              </h1>
              {activeProject?.description && (
                <p style={{ margin: "0.25rem 0 0", color: "#475569", fontSize: "0.9rem" }}>
                  {activeProject.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCreateTaskOpen(true)}
              style={{
                padding: "0.5rem 0.95rem",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + New Task
            </button>
          </div>

          {taskError && (
            <div role="alert" style={{ color: "#b91c1c", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
              {taskError}
            </div>
          )}

          <KanbanBoard
            tasks={tasks}
            users={users}
            onOpenTaskDetail={openTask}
            onMoveTask={handleMoveStatus}
            onAssignTask={handleAssignUser}
          />
        </main>
      </div>

      <CreateProjectModal
        isOpen={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        onSubmit={async (input) => {
          const created = await createProject(input);
          onSelectProject(created.id);
        }}
      />

      <CreateTaskModal
        isOpen={createTaskOpen}
        users={users}
        onClose={() => setCreateTaskOpen(false)}
        onSubmit={async (input) => {
          await createTask(input, selectedProjectId);
        }}
      />

      <TaskModal
        task={selectedTask}
        comments={comments}
        users={users}
        activeUserId={activeUserId}
        onClose={closeTask}
        onMoveStatus={handleMoveStatus}
        onAssignUser={handleAssignUser}
        onAddComment={async (taskId, input) => {
          await createComment(taskId, input);
          await refreshTasks(selectedProjectId);
        }}
        onUpdateComment={async (commentId, input) => {
          await updateComment(commentId, input);
        }}
        onDeleteComment={async (commentId) => {
          await deleteComment(commentId);
          await refreshTasks(selectedProjectId);
        }}
      />
    </div>
  );
}
