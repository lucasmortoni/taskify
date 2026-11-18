/**
 * Four-column Kanban board component (`To Do`, `In Progress`, `In Review`, `Done`) supporting
 * unrestricted drag-and-drop transitions across columns (`FR-005`, `FR-008`).
 */

import React, { useState } from "react";
import { KANBAN_STATUSES, type KanbanStatus, type TaskDto, type UserDto } from "@taskify/shared/browser";
import { TaskCard } from "./TaskCard.tsx";

/** Props for {@link KanbanBoard}. */
export interface KanbanBoardProps {
  readonly tasks: readonly TaskDto[];
  readonly users: readonly UserDto[];
  readonly onOpenTaskDetail: (taskId: string) => void;
  readonly onMoveTask: (taskId: string, nextStatus: KanbanStatus) => Promise<void>;
  readonly onAssignTask: (taskId: string, assigneeId: string | null) => Promise<void>;
}

/**
 * Renders the fixed 4-column Kanban board, keeping empty columns visible as valid drop zones.
 */
export function KanbanBoard({
  tasks,
  users,
  onOpenTaskDetail,
  onMoveTask,
  onAssignTask,
}: KanbanBoardProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<KanbanStatus | null>(null);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
        gap: "1rem",
        alignItems: "start",
      }}
    >
      {KANBAN_STATUSES.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column);
        const isOver = dropTargetColumn === column;

        return (
          <section
            key={column}
            aria-label={`${column} column`}
            data-column-status={column}
            onDragEnter={(e) => {
              e.preventDefault();
              setDropTargetColumn(column);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropTargetColumn(column);
            }}
            onDragLeave={() => setDropTargetColumn((curr) => (curr === column ? null : curr))}
            onDrop={async (e) => {
              e.preventDefault();
              setDropTargetColumn(null);
              const taskId = e.dataTransfer.getData("text/plain") || draggingTaskId;
              setDraggingTaskId(null);
              if (taskId) {
                const task = tasks.find((t) => t.id === taskId);
                if (task && task.status !== column) {
                  await onMoveTask(taskId, column);
                }
              }
            }}
            style={{
              backgroundColor: isOver ? "#dbeafe" : "#f1f5f9",
              border: isOver ? "2px dashed #3b82f6" : "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "0.75rem",
              minHeight: "340px",
              display: "flex",
              flexDirection: "column",
              gap: "0.65rem",
            }}
          >
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#1e293b" }}>
                {column}
              </h3>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.15rem 0.45rem",
                  borderRadius: "999px",
                  backgroundColor: "#e2e8f0",
                  color: "#334155",
                }}
              >
                {columnTasks.length}
              </span>
            </header>

            {columnTasks.length === 0 ? (
              <div
                style={{
                  border: "1px dashed #cbd5e1",
                  borderRadius: "6px",
                  padding: "1rem",
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: "0.8rem",
                }}
              >
                No tasks in {column}
              </div>
            ) : (
              columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  users={users}
                  onOpenDetail={onOpenTaskDetail}
                  onMoveStatus={onMoveTask}
                  onAssignUser={onAssignTask}
                  onDragStart={setDraggingTaskId}
                />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
