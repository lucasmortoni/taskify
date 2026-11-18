/**
 * Draggable Kanban task card component with accessible status and single-assignee controls (`FR-007`, `FR-008`).
 */

import React from "react";
import { KANBAN_STATUSES, type KanbanStatus, type TaskDto, type UserDto } from "@taskify/shared/browser";

/** Props for {@link TaskCard}. */
export interface TaskCardProps {
  readonly task: TaskDto;
  readonly users: readonly UserDto[];
  readonly onOpenDetail: (taskId: string) => void;
  readonly onMoveStatus: (taskId: string, nextStatus: KanbanStatus) => Promise<void>;
  readonly onAssignUser: (taskId: string, assigneeId: string | null) => Promise<void>;
  readonly onDragStart: (taskId: string) => void;
}

/**
 * Renders an individual Kanban card supporting HTML5 drag-and-drop and keyboard-accessible controls.
 */
export function TaskCard({
  task,
  users,
  onOpenDetail,
  onMoveStatus,
  onAssignUser,
  onDragStart,
}: TaskCardProps) {
  const assignee = task.assigneeId ? users.find((u) => u.id === task.assigneeId) : null;

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(task.id);
      }}
      data-task-id={task.id}
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
        cursor: "grab",
      }}
    >
      <div
        data-drag-handle
        style={{
          fontSize: "0.7rem",
          color: "#94a3b8",
          userSelect: "none",
          letterSpacing: "0.02em",
        }}
      >
        ⋮⋮ Drag card
      </div>
      <button
        type="button"
        onClick={() => onOpenDetail(task.id)}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          textAlign: "left",
          fontWeight: 600,
          fontSize: "0.9rem",
          color: "#0f172a",
          cursor: "pointer",
        }}
      >
        {task.title}
      </button>

      {task.description && (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "#475569", lineHeight: 1.35 }}>
          {task.description.length > 90 ? `${task.description.slice(0, 87)}...` : task.description}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.25rem" }}>
        <label style={{ fontSize: "0.75rem", color: "#475569", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.35rem" }}>
          <span>Assignee:</span>
          <select
            aria-label={`Assign ${task.title}`}
            value={task.assigneeId ?? ""}
            onChange={(e) => onAssignUser(task.id, e.target.value ? e.target.value : null)}
            style={{ flex: 1, fontSize: "0.75rem", padding: "0.2rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: "0.75rem", color: "#475569", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.35rem" }}>
          <span>Column:</span>
          <select
            aria-label={`Move ${task.title} to column`}
            value={task.status}
            onChange={(e) => onMoveStatus(task.id, e.target.value as KanbanStatus)}
            style={{ flex: 1, fontSize: "0.75rem", padding: "0.2rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
          >
            {KANBAN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", color: "#64748b" }}>
        <span>{assignee ? `${assignee.name} (${assignee.role === "Product Manager" ? "PM" : "Eng"})` : "Unassigned"}</span>
        <span>{task.commentCount ?? 0} comments</span>
      </div>
    </article>
  );
}
