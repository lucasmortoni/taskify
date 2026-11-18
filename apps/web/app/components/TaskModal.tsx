/**
 * Task detail modal combining column status, single-assignee selector, and {@link CommentThread}.
 */

import React from "react";
import {
  type CommentDto,
  type CreateCommentInput,
  KANBAN_STATUSES,
  type KanbanStatus,
  type TaskDto,
  type UpdateCommentInput,
  type UserDto,
} from "@taskify/shared/browser";
import { CommentThread } from "./CommentThread.tsx";

/** Props for {@link TaskModal}. */
export interface TaskModalProps {
  readonly task: TaskDto | null;
  readonly comments: readonly CommentDto[];
  readonly users: readonly UserDto[];
  readonly activeUserId: string;
  readonly onClose: () => void;
  readonly onMoveStatus: (taskId: string, status: KanbanStatus) => Promise<void>;
  readonly onAssignUser: (taskId: string, assigneeId: string | null) => Promise<void>;
  readonly onAddComment: (taskId: string, input: CreateCommentInput) => Promise<void>;
  readonly onUpdateComment: (commentId: string, input: UpdateCommentInput) => Promise<void>;
  readonly onDeleteComment: (commentId: string) => Promise<void>;
}

/**
 * Displays full task details, status/assignee editors, and chronological comments.
 */
export function TaskModal({
  task,
  comments,
  users,
  activeUserId,
  onClose,
  onMoveStatus,
  onAssignUser,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: TaskModalProps) {
  if (!task) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          padding: "1.25rem",
          width: "min(620px, 94vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
          <h3 id="task-modal-title" style={{ margin: 0 }}>
            {task.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task detail"
            style={{
              padding: "0.25rem 0.6rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        {task.description && (
          <p style={{ margin: 0, fontSize: "0.88rem", color: "#334155" }}>{task.description}</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.82rem" }}>
            <span>Kanban Column</span>
            <select
              value={task.status}
              onChange={(e) => onMoveStatus(task.id, e.target.value as KanbanStatus)}
              style={{ padding: "0.45rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              {KANBAN_STATUSES.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.82rem" }}>
            <span>Assignee</span>
            <select
              value={task.assigneeId ?? ""}
              onChange={(e) => onAssignUser(task.id, e.target.value ? e.target.value : null)}
              style={{ padding: "0.45rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </label>
        </div>

        <CommentThread
          comments={comments}
          users={users}
          activeUserId={activeUserId}
          onAddComment={(input) => onAddComment(task.id, input)}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
        />
      </div>
    </div>
  );
}
