/**
 * Project, user roster, and notification React hooks for Taskify Phase 1.
 */

import { useCallback, useState } from "react";
import type { CreateProjectInput, NotificationDto, ProjectDto, UserDto } from "@taskify/shared";
import type { ApiClient } from "../lib/api-client.ts";

/**
 * Manages users, projects, project creation, and activity notifications with optimistic read state.
 */
export function useProjects(
  api: ApiClient,
  initialUsers: UserDto[],
  initialProjects: ProjectDto[],
  initialNotifications: NotificationDto[] = [],
) {
  const [users, setUsers] = useState<UserDto[]>(initialUsers);
  const [projects, setProjects] = useState<ProjectDto[]>(initialProjects);
  const [notifications, setNotifications] = useState<NotificationDto[]>(initialNotifications);
  const [error, setError] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    const next = await api.listUsers();
    setUsers(next);
  }, [api]);

  const refreshProjects = useCallback(async () => {
    const next = await api.listProjects();
    setProjects(next);
  }, [api]);

  const refreshNotifications = useCallback(
    async (projectId?: string) => {
      const next = await api.listNotifications(projectId);
      setNotifications(next);
    },
    [api],
  );

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<ProjectDto> => {
      setError(null);
      const created = await api.createProject(input);
      setProjects((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      return created;
    },
    [api],
  );

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)),
      );
      try {
        await api.markNotificationRead(notificationId);
      } catch {
        await refreshNotifications();
      }
    },
    [api, refreshNotifications],
  );

  return {
    users,
    projects,
    notifications,
    error,
    refreshUsers,
    refreshProjects,
    refreshNotifications,
    createProject,
    markNotificationRead,
  };
}
