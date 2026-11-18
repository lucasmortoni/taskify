/**
 * Task detail and chronological comment thread hooks (`FR-009`).
 */

import { useCallback, useState } from "react";
import type { CommentDto, CreateCommentInput, TaskDto, UpdateCommentInput } from "@taskify/shared";
import type { ApiClient } from "../lib/api-client.ts";

/**
 * Manages comments for an opened task detail modal.
 */
export function useComments(api: ApiClient) {
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const openTask = useCallback(
    async (taskId: string) => {
      setLoadingDetail(true);
      try {
        const detail = await api.getTaskDetail(taskId);
        setSelectedTask(detail.task);
        setComments(detail.comments);
      } finally {
        setLoadingDetail(false);
      }
    },
    [api],
  );

  const closeTask = useCallback(() => {
    setSelectedTask(null);
    setComments([]);
  }, []);

  const refreshOpenTask = useCallback(async () => {
    if (!selectedTask) return;
    const detail = await api.getTaskDetail(selectedTask.id);
    setSelectedTask(detail.task);
    setComments(detail.comments);
  }, [api, selectedTask]);

  const createComment = useCallback(
    async (taskId: string, input: CreateCommentInput): Promise<CommentDto> => {
      const comment = await api.createComment(taskId, input);
      setComments((prev) => [...prev, comment]);
      return comment;
    },
    [api],
  );

  const updateComment = useCallback(
    async (commentId: string, input: UpdateCommentInput): Promise<CommentDto> => {
      const updated = await api.updateComment(commentId, input);
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      return updated;
    },
    [api],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      await api.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [api],
  );

  return {
    selectedTask,
    setSelectedTask,
    comments,
    loadingDetail,
    openTask,
    closeTask,
    refreshOpenTask,
    createComment,
    updateComment,
    deleteComment,
  };
}
