/**
 * Modal dialog for creating a new Kanban task with Zod validation and `0..1` predefined assignee (`FR-006`).
 */

import React, { useState } from "react";
import {
  type CreateTaskInput,
  KANBAN_STATUSES,
  type KanbanStatus,
  type UserDto,
  createTaskSchema,
} from "@taskify/shared/browser";

/** Props for {@link CreateTaskModal}. */
export interface CreateTaskModalProps {
  readonly isOpen: boolean;
  readonly users: readonly UserDto[];
  readonly onClose: () => void;
  readonly onSubmit: (input: CreateTaskInput) => Promise<void>;
}

/**
 * Displays a task creation form validating title, description, initial Kanban column, and assignee.
 */
export function CreateTaskModal({ isOpen, users, onClose, onSubmit }: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<KanbanStatus>("To Do");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createTaskSchema.safeParse({
      title,
      description: description || null,
      status,
      assigneeId: assigneeId || null,
    });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? "Invalid task input");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit(parsed.data);
      setTitle("");
      setDescription("");
      setStatus("To Do");
      setAssigneeId("");
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          padding: "1.25rem",
          width: "min(460px, 92vw)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <h3 id="create-task-title" style={{ margin: 0 }}>
          Create Task
        </h3>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
          <span>Title *</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            placeholder="e.g., Implement strict schema check"
            style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
          <span>Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
            <span>Column</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as KanbanStatus)}
              style={{ padding: "0.45rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              {KANBAN_STATUSES.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
            <span>Assignee</span>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
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

        {errorMsg && (
          <div role="alert" style={{ color: "#b91c1c", fontSize: "0.85rem" }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "0.45rem 0.9rem", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "6px",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            {submitting ? "Adding..." : "Create Task"}
          </button>
        </div>
      </form>
    </div>
  );
}
