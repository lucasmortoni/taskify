/**
 * Kanban task hooks supporting optimistic drag-and-drop column transitions and single-assignee updates.
 */

import { useCallback, useState } from "react";
import type { CreateTaskInput, TaskDto, UpdateTaskInput } from "@taskify/shared";
import type { ApiClient } from "../lib/api-client.ts";

/**
 * Manages tasks for the active project board with immediate optimistic updates and rollback on error.
 */
export function useTasks(api: ApiClient, projectId: string, initialTasks: TaskDto[]) {
  const [tasks, setTasks] = useState<TaskDto[]>(initialTasks);
  const [taskError, setTaskError] = useState<string | null>(null);

  const refreshTasks = useCallback(
    async (targetProjectId: string = projectId) => {
      const next = await api.listTasks(targetProjectId);
      setTasks(next);
    },
    [api, projectId],
  );

  const createTask = useCallback(
    async (input: CreateTaskInput, targetProjectId: string = projectId): Promise<TaskDto> => {
      setTaskError(null);
      const created = await api.createTask(targetProjectId, input);
      setTasks((prev) => [...prev, created]);
      return created;
    },
    [api, projectId],
  );

  const updateTaskOptimistic = useCallback(
    async (taskId: string, patch: UpdateTaskInput): Promise<TaskDto> => {
      setTaskError(null);
      const previous = tasks;
      setTasks((prev) =>
        prev.map((item) =>
          item.id === taskId
            ? {
                ...item,
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.description !== undefined ? { description: patch.description } : {}),
                ...(patch.status !== undefined ? { status: patch.status } : {}),
                ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
                ...(patch.position !== undefined ? { position: patch.position } : {}),
              }
            : item,
        ),
      );

      try {
        const updated = await api.updateTask(taskId, patch);
        setTasks((prev) => prev.map((item) => (item.id === taskId ? { ...item, ...updated } : item)));
        return updated;
      } catch (err) {
        setTasks(previous);
        setTaskError(err instanceof Error ? err.message : "Failed to update task");
        throw err;
      }
    },
    [api, tasks],
  );

  return {
    tasks,
    setTasks,
    taskError,
    refreshTasks,
    createTask,
    updateTaskOptimistic,
  };
}
