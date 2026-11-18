/**
 * Isolated data-store client for `tasks-service` (`tasks_domain`).
 *
 * Uses Bun's native PostgreSQL Drizzle driver (`drizzle-orm/bun-sql`) when `POSTGRES_ENABLED=true`,
 * and falls back to an isolated per-service `bun:sqlite` store (`.data/tasks_domain.sqlite`)
 * when running without a live Postgres daemon.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SQL } from "bun";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/bun-sql";
import type { CommentDto, KanbanStatus, TaskDto } from "@taskify/shared";
import { PREDEFINED_USERS, SAMPLE_PROJECTS } from "@taskify/shared";
import { commentsTable, tasksTable } from "./schema.ts";

/** Starter sample tasks seeded across the 3 sample projects and 4 Kanban columns (`FR-003`). */
export const STARTER_TASKS: ReadonlyArray<{
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly status: KanbanStatus;
  readonly assigneeId: string | null;
  readonly createdById: string;
  readonly position: number;
}> = [
  {
    id: "33333333-3333-4333-8333-333333333301",
    projectId: SAMPLE_PROJECTS[0].id,
    title: "Enforce Zod validation at task boundary",
    description: "Add strict schema checking for status, title, and single-assignee fields.",
    status: "In Progress",
    assigneeId: PREDEFINED_USERS[1].id,
    createdById: PREDEFINED_USERS[0].id,
    position: 0,
  },
  {
    id: "33333333-3333-4333-8333-333333333302",
    projectId: SAMPLE_PROJECTS[0].id,
    title: "Verify internal service token rotation",
    description: "Ensure constant-time verification rejects unauthorized internal callers.",
    status: "To Do",
    assigneeId: PREDEFINED_USERS[2].id,
    createdById: PREDEFINED_USERS[0].id,
    position: 0,
  },
  {
    id: "33333333-3333-4333-8333-333333333303",
    projectId: SAMPLE_PROJECTS[0].id,
    title: "Audit sanitized API error responses",
    description: "Confirm stack traces and database internals are stripped across microservices.",
    status: "In Review",
    assigneeId: PREDEFINED_USERS[3].id,
    createdById: PREDEFINED_USERS[1].id,
    position: 0,
  },
  {
    id: "33333333-3333-4333-8333-333333333304",
    projectId: SAMPLE_PROJECTS[0].id,
    title: "Document OpenAPI 3.1 gateway endpoints",
    description: "Publish Swagger JSON specs for projects, tasks, and notifications services.",
    status: "Done",
    assigneeId: PREDEFINED_USERS[4].id,
    createdById: PREDEFINED_USERS[0].id,
    position: 0,
  },
  {
    id: "33333333-3333-4333-8333-333333333305",
    projectId: SAMPLE_PROJECTS[1].id,
    title: "Design accessible Kanban column headers",
    description: "Keep all four columns visible even when task counts are zero.",
    status: "To Do",
    assigneeId: PREDEFINED_USERS[2].id,
    createdById: PREDEFINED_USERS[0].id,
    position: 0,
  },
  {
    id: "33333333-3333-4333-8333-333333333306",
    projectId: SAMPLE_PROJECTS[1].id,
    title: "Add optimistic drag-and-drop card updates",
    description: "Move task cards smoothly and roll back if server validation rejects.",
    status: "In Progress",
    assigneeId: PREDEFINED_USERS[3].id,
    createdById: PREDEFINED_USERS[0].id,
    position: 0,
  },
  {
    id: "33333333-3333-4333-8333-333333333307",
    projectId: SAMPLE_PROJECTS[2].id,
    title: "Stream SSE board events across sessions",
    description: "Broadcast project, task, and comment changes to connected browsers.",
    status: "In Review",
    assigneeId: PREDEFINED_USERS[4].id,
    createdById: PREDEFINED_USERS[1].id,
    position: 0,
  },
  {
    id: "33333333-3333-4333-8333-333333333308",
    projectId: SAMPLE_PROJECTS[2].id,
    title: "Configure isolated domain schemas",
    description: "Partition projects, tasks, and notifications schemas cleanly.",
    status: "Done",
    assigneeId: null,
    createdById: PREDEFINED_USERS[1].id,
    position: 0,
  },
];

/** Starter sample comment for the first sample task. */
export const STARTER_COMMENT = {
  id: "44444444-4444-4444-8444-444444444401",
  taskId: "33333333-3333-4333-8333-333333333301",
  authorId: PREDEFINED_USERS[1].id,
  content: "Zod DTOs are configured for strict trimming and length limits.",
};

/** Options for constructing an isolated Tasks store instance. */
export interface TasksStoreOptions {
  readonly sqlitePath?: string;
  readonly postgresUrl?: string;
  readonly usePostgres?: boolean;
}

/** Tasks & Comments repository interface isolating SQL driver details from HTTP handlers. */
export interface TasksStore {
  migrate(): Promise<void>;
  seed(): Promise<void>;
  listTasksByProject(projectId: string): Promise<TaskDto[]>;
  getTaskById(taskId: string): Promise<{ task: TaskDto; comments: CommentDto[] } | null>;
  createTask(input: {
    projectId: string;
    title: string;
    description: string | null;
    status: KanbanStatus;
    assigneeId: string | null;
    createdById: string;
  }): Promise<TaskDto>;
  updateTask(
    taskId: string,
    patch: {
      title?: string;
      description?: string | null;
      status?: KanbanStatus;
      assigneeId?: string | null;
      position?: number;
    },
  ): Promise<TaskDto | null>;
  createComment(input: { taskId: string; authorId: string; content: string }): Promise<CommentDto>;
  getCommentById(commentId: string): Promise<CommentDto | null>;
  updateComment(commentId: string, content: string): Promise<CommentDto | null>;
  deleteComment(commentId: string): Promise<{ deletedId: string; taskId: string } | null>;
  close(): Promise<void>;
}

/**
 * Creates a {@link TasksStore} backed by PostgreSQL (`tasks_domain` schema) or isolated SQLite.
 *
 * @param options - Storage adapter configuration.
 * @returns Initialized {@link TasksStore}.
 */
export function createTasksStore(options: TasksStoreOptions = {}): TasksStore {
  const usePostgres =
    options.usePostgres ?? (process.env.POSTGRES_ENABLED === "true" && Boolean(process.env.TASKS_DATABASE_URL));

  if (usePostgres) {
    const url =
      options.postgresUrl ??
      process.env.TASKS_DATABASE_URL ??
      "postgres://taskify:taskify_dev_password@localhost:5432/taskify";
    const sqlClient = new SQL(url);
    const db = drizzlePg({ client: sqlClient });

    const mapTaskRow = (r: typeof tasksTable.$inferSelect, commentCount?: number): TaskDto => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      description: r.description ?? null,
      status: r.status,
      assigneeId: r.assigneeId ?? null,
      createdById: r.createdById,
      position: r.position,
      ...(commentCount !== undefined ? { commentCount } : {}),
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    });

    const mapCommentRow = (r: typeof commentsTable.$inferSelect): CommentDto => ({
      id: r.id,
      taskId: r.taskId,
      authorId: r.authorId,
      content: r.content,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    });

    return {
      async migrate() {
        await sqlClient.unsafe(`
          CREATE SCHEMA IF NOT EXISTS tasks_domain;
          DO $$ BEGIN
            CREATE TYPE tasks_domain.task_status AS ENUM ('To Do', 'In Progress', 'In Review', 'Done');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
          CREATE TABLE IF NOT EXISTS tasks_domain.tasks (
            id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL,
            title VARCHAR(150) NOT NULL,
            description VARCHAR(2000),
            status tasks_domain.task_status NOT NULL DEFAULT 'To Do',
            assignee_id UUID,
            created_by_id UUID NOT NULL,
            position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks_domain.tasks (project_id, status, position);
          CREATE TABLE IF NOT EXISTS tasks_domain.comments (
            id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
            task_id UUID NOT NULL REFERENCES tasks_domain.tasks(id) ON DELETE CASCADE,
            author_id UUID NOT NULL,
            content VARCHAR(1000) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_comments_task_created ON tasks_domain.comments (task_id, created_at);
        `);
      },
      async seed() {
        for (const task of STARTER_TASKS) {
          await db.insert(tasksTable).values(task).onConflictDoNothing();
        }
        await db.insert(commentsTable).values(STARTER_COMMENT).onConflictDoNothing();
      },
      async listTasksByProject(projectId) {
        const rows = await db
          .select({
            task: tasksTable,
            commentCount: sql<number>`(SELECT count(*)::int FROM tasks_domain.comments c WHERE c.task_id = ${tasksTable.id})`,
          })
          .from(tasksTable)
          .where(eq(tasksTable.projectId, projectId))
          .orderBy(asc(tasksTable.position), asc(tasksTable.createdAt));
        return rows.map((row) => mapTaskRow(row.task, Number(row.commentCount ?? 0)));
      },
      async getTaskById(taskId) {
        const rows = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
        const task = rows[0];
        if (!task) return null;
        const comments = await db
          .select()
          .from(commentsTable)
          .where(eq(commentsTable.taskId, taskId))
          .orderBy(asc(commentsTable.createdAt));
        return {
          task: mapTaskRow(task),
          comments: comments.map(mapCommentRow),
        };
      },
      async createTask(input) {
        const existing = await db
          .select()
          .from(tasksTable)
          .where(eq(tasksTable.projectId, input.projectId));
        const sameColumn = existing.filter((t) => t.status === input.status);
        const nextPos = sameColumn.reduce((max, item) => Math.max(max, item.position + 1), 0);
        const inserted = await db
          .insert(tasksTable)
          .values({
            projectId: input.projectId,
            title: input.title,
            description: input.description,
            status: input.status,
            assigneeId: input.assigneeId,
            createdById: input.createdById,
            position: nextPos,
          })
          .returning();
        return mapTaskRow(inserted[0]!, 0);
      },
      async updateTask(taskId, patch) {
        const existingRows = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
        if (!existingRows[0]) return null;
        const updatePayload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        if (patch.title !== undefined) updatePayload.title = patch.title;
        if (patch.description !== undefined) updatePayload.description = patch.description;
        if (patch.status !== undefined) updatePayload.status = patch.status;
        if (patch.assigneeId !== undefined) updatePayload.assigneeId = patch.assigneeId;
        if (patch.position !== undefined) updatePayload.position = patch.position;
        const updated = await db
          .update(tasksTable)
          .set(updatePayload)
          .where(eq(tasksTable.id, taskId))
          .returning();
        return updated[0] ? mapTaskRow(updated[0]) : null;
      },
      async createComment(input) {
        const inserted = await db
          .insert(commentsTable)
          .values({ taskId: input.taskId, authorId: input.authorId, content: input.content })
          .returning();
        return mapCommentRow(inserted[0]!);
      },
      async getCommentById(commentId) {
        const rows = await db.select().from(commentsTable).where(eq(commentsTable.id, commentId));
        return rows[0] ? mapCommentRow(rows[0]) : null;
      },
      async updateComment(commentId, content) {
        const updated = await db
          .update(commentsTable)
          .set({ content, updatedAt: new Date().toISOString() })
          .where(eq(commentsTable.id, commentId))
          .returning();
        return updated[0] ? mapCommentRow(updated[0]) : null;
      },
      async deleteComment(commentId) {
        const deleted = await db
          .delete(commentsTable)
          .where(eq(commentsTable.id, commentId))
          .returning({ deletedId: commentsTable.id, taskId: commentsTable.taskId });
        return deleted[0] ?? null;
      },
      async close() {
        await sqlClient.close();
      },
    };
  }

  const sqlitePath = options.sqlitePath ?? process.env.TASKS_SQLITE_PATH ?? ".data/tasks_domain.sqlite";
  if (sqlitePath !== ":memory:") {
    mkdirSync(dirname(sqlitePath), { recursive: true });
  }
  const sqlite = new Database(sqlitePath);
  sqlite.exec("PRAGMA foreign_keys = ON;");

  const mapTask = (r: any): TaskDto => ({
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description ?? null,
    status: r.status,
    assigneeId: r.assignee_id ?? null,
    createdById: r.created_by_id,
    position: Number(r.position),
    ...(r.comment_count !== undefined ? { commentCount: Number(r.comment_count) } : {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  const mapComment = (r: any): CommentDto => ({
    id: r.id,
    taskId: r.task_id,
    authorId: r.author_id,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  return {
    async migrate() {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL CHECK (status IN ('To Do', 'In Progress', 'In Review', 'Done')),
          assignee_id TEXT,
          created_by_id TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks (project_id, status, position);
        CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          author_id TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_comments_task_created ON comments (task_id, created_at);
      `);
    },
    async seed() {
      const now = new Date().toISOString();
      const insertTask = sqlite.prepare(
        "INSERT OR IGNORE INTO tasks (id, project_id, title, description, status, assignee_id, created_by_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      for (const task of STARTER_TASKS) {
        insertTask.run(
          task.id,
          task.projectId,
          task.title,
          task.description,
          task.status,
          task.assigneeId,
          task.createdById,
          task.position,
          now,
          now,
        );
      }
      sqlite
        .prepare(
          "INSERT OR IGNORE INTO comments (id, task_id, author_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          STARTER_COMMENT.id,
          STARTER_COMMENT.taskId,
          STARTER_COMMENT.authorId,
          STARTER_COMMENT.content,
          now,
          now,
        );
    },
    async listTasksByProject(projectId) {
      const rows = sqlite
        .query(
          `SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count
           FROM tasks t WHERE t.project_id = ? ORDER BY t.position ASC, t.created_at ASC`,
        )
        .all(projectId);
      return (rows as any[]).map(mapTask);
    },
    async getTaskById(taskId) {
      const taskRow = sqlite.query("SELECT * FROM tasks WHERE id = ?").get(taskId);
      if (!taskRow) return null;
      const commentRows = sqlite
        .query("SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC, rowid ASC")
        .all(taskId);
      return {
        task: mapTask(taskRow),
        comments: (commentRows as any[]).map(mapComment),
      };
    },
    async createTask(input) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const posRow = sqlite
        .query("SELECT COALESCE(MAX(position) + 1, 0) AS next_pos FROM tasks WHERE project_id = ? AND status = ?")
        .get(input.projectId, input.status) as { next_pos: number };
      const position = Number(posRow?.next_pos ?? 0);
      sqlite
        .prepare(
          "INSERT INTO tasks (id, project_id, title, description, status, assignee_id, created_by_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          id,
          input.projectId,
          input.title,
          input.description,
          input.status,
          input.assigneeId,
          input.createdById,
          position,
          now,
          now,
        );
      return {
        id,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        status: input.status,
        assigneeId: input.assigneeId,
        createdById: input.createdById,
        position,
        commentCount: 0,
        createdAt: now,
        updatedAt: now,
      };
    },
    async updateTask(taskId, patch) {
      const existing = sqlite.query("SELECT * FROM tasks WHERE id = ?").get(taskId) as any;
      if (!existing) return null;
      const now = new Date().toISOString();
      const nextTitle = patch.title !== undefined ? patch.title : existing.title;
      const nextDescription = patch.description !== undefined ? patch.description : existing.description;
      const nextStatus = patch.status !== undefined ? patch.status : existing.status;
      const nextAssigneeId = patch.assigneeId !== undefined ? patch.assigneeId : existing.assignee_id;
      const nextPosition = patch.position !== undefined ? patch.position : Number(existing.position);
      sqlite
        .prepare(
          "UPDATE tasks SET title = ?, description = ?, status = ?, assignee_id = ?, position = ?, updated_at = ? WHERE id = ?",
        )
        .run(nextTitle, nextDescription, nextStatus, nextAssigneeId, nextPosition, now, taskId);
      const updated = sqlite
        .query(
          `SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count FROM tasks t WHERE t.id = ?`,
        )
        .get(taskId);
      return updated ? mapTask(updated) : null;
    },
    async createComment(input) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      sqlite
        .prepare(
          "INSERT INTO comments (id, task_id, author_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(id, input.taskId, input.authorId, input.content, now, now);
      return {
        id,
        taskId: input.taskId,
        authorId: input.authorId,
        content: input.content,
        createdAt: now,
        updatedAt: now,
      };
    },
    async getCommentById(commentId) {
      const row = sqlite.query("SELECT * FROM comments WHERE id = ?").get(commentId);
      return row ? mapComment(row) : null;
    },
    async updateComment(commentId, content) {
      const existing = sqlite.query("SELECT * FROM comments WHERE id = ?").get(commentId);
      if (!existing) return null;
      const now = new Date().toISOString();
      sqlite.prepare("UPDATE comments SET content = ?, updated_at = ? WHERE id = ?").run(content, now, commentId);
      const updated = sqlite.query("SELECT * FROM comments WHERE id = ?").get(commentId);
      return updated ? mapComment(updated) : null;
    },
    async deleteComment(commentId) {
      const existing = sqlite.query("SELECT id, task_id FROM comments WHERE id = ?").get(commentId) as
        | { id: string; task_id: string }
        | null;
      if (!existing) return null;
      sqlite.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
      return { deletedId: existing.id, taskId: existing.task_id };
    },
    async close() {
      sqlite.close();
    },
  };
}
