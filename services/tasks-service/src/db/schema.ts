/**
 * Drizzle ORM PostgreSQL schema for `tasks-service` (`tasks_domain` schema).
 *
 * Isolates `Task` and `Comment` entities per `data-model.md` Section 2 with zero cross-service DB foreign keys.
 */

import { index, integer, pgSchema, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Isolated PostgreSQL schema for Tasks & Comments domain. */
export const tasksSchema = pgSchema("tasks_domain");

/** PostgreSQL enum for fixed Phase 1 Kanban columns (`FR-005`). */
export const taskStatusEnum = tasksSchema.enum("task_status", [
  "To Do",
  "In Progress",
  "In Review",
  "Done",
]);

/**
 * `tasks_domain.tasks` table (`Task.id`, `Task.projectId`, `Task.title`, `Task.description`, `Task.status`, `Task.assigneeId`, `Task.createdById`, `Task.position`, `Task.createdAt`, `Task.updatedAt`).
 */
export const tasksTable = tasksSchema.table(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    projectId: uuid("project_id").notNull(),
    title: varchar("title", { length: 150 }).notNull(),
    description: varchar("description", { length: 2000 }),
    status: taskStatusEnum("status").default("To Do").notNull(),
    assigneeId: uuid("assignee_id"),
    createdById: uuid("created_by_id").notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [index("idx_tasks_project_status").on(table.projectId, table.status, table.position)],
);

/**
 * `tasks_domain.comments` table (`Comment.id`, `Comment.taskId`, `Comment.authorId`, `Comment.content`, `Comment.createdAt`, `Comment.updatedAt`).
 */
export const commentsTable = tasksSchema.table(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull(),
    content: varchar("content", { length: 1000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [index("idx_comments_task_created").on(table.taskId, table.createdAt)],
);
