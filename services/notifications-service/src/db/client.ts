/**
 * Isolated data-store client for `notifications-service` (`notifications_domain`).
 *
 * Uses Bun's native PostgreSQL Drizzle driver (`drizzle-orm/bun-sql`) when `POSTGRES_ENABLED=true`,
 * and falls back to an isolated per-service `bun:sqlite` store (`.data/notifications_domain.sqlite`)
 * when running without a live Postgres daemon.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SQL } from "bun";
import { and, desc, eq } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/bun-sql";
import type { NotificationDto, NotificationQuery, NotificationType } from "@taskify/shared";
import { notificationsTable } from "./schema.ts";

/** Options for constructing an isolated Notifications store instance. */
export interface NotificationsStoreOptions {
  readonly sqlitePath?: string;
  readonly postgresUrl?: string;
  readonly usePostgres?: boolean;
}

/** Notifications repository interface isolating SQL engine details from HTTP routes. */
export interface NotificationsStore {
  migrate(): Promise<void>;
  createNotification(input: {
    projectId: string;
    taskId: string | null;
    actorId: string;
    recipientId: string | null;
    type: NotificationType;
    message: string;
  }): Promise<NotificationDto>;
  listNotifications(query: NotificationQuery): Promise<NotificationDto[]>;
  markAsRead(notificationId: string): Promise<NotificationDto | null>;
  close(): Promise<void>;
}

/**
 * Creates a {@link NotificationsStore} backed by PostgreSQL (`notifications_domain`) or isolated SQLite.
 *
 * @param options - Storage adapter configuration.
 * @returns Initialized {@link NotificationsStore}.
 */
export function createNotificationsStore(options: NotificationsStoreOptions = {}): NotificationsStore {
  const usePostgres =
    options.usePostgres ??
    (process.env.POSTGRES_ENABLED === "true" && Boolean(process.env.NOTIFICATIONS_DATABASE_URL));

  if (usePostgres) {
    const url =
      options.postgresUrl ??
      process.env.NOTIFICATIONS_DATABASE_URL ??
      "postgres://taskify:taskify_dev_password@localhost:5432/taskify";
    const sqlClient = new SQL(url);
    const db = drizzlePg({ client: sqlClient });

    const mapRow = (r: typeof notificationsTable.$inferSelect): NotificationDto => ({
      id: r.id,
      projectId: r.projectId,
      taskId: r.taskId ?? null,
      actorId: r.actorId,
      recipientId: r.recipientId ?? null,
      type: r.type,
      message: r.message,
      isRead: r.isRead,
      createdAt: new Date(r.createdAt).toISOString(),
    });

    return {
      async migrate() {
        await sqlClient.unsafe(`
          CREATE SCHEMA IF NOT EXISTS notifications_domain;
          DO $$ BEGIN
            CREATE TYPE notifications_domain.notification_type AS ENUM (
              'PROJECT_CREATED', 'TASK_CREATED', 'TASK_STATUS_CHANGED',
              'TASK_ASSIGNED', 'COMMENT_CREATED', 'COMMENT_UPDATED', 'COMMENT_DELETED'
            );
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
          CREATE TABLE IF NOT EXISTS notifications_domain.notifications (
            id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL,
            task_id UUID,
            actor_id UUID NOT NULL,
            recipient_id UUID,
            type notifications_domain.notification_type NOT NULL,
            message VARCHAR(500) NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_notifications_project_created ON notifications_domain.notifications (project_id, created_at);
          CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications_domain.notifications (recipient_id, is_read);
        `);
      },
      async createNotification(input) {
        const rows = await db
          .insert(notificationsTable)
          .values({
            projectId: input.projectId,
            taskId: input.taskId,
            actorId: input.actorId,
            recipientId: input.recipientId,
            type: input.type,
            message: input.message,
          })
          .returning();
        return mapRow(rows[0]!);
      },
      async listNotifications(query) {
        const conditions = [];
        if (query.projectId) conditions.push(eq(notificationsTable.projectId, query.projectId));
        if (query.recipientId) conditions.push(eq(notificationsTable.recipientId, query.recipientId));
        if (query.unreadOnly === "true") conditions.push(eq(notificationsTable.isRead, false));
        if (query.unreadOnly === "false") conditions.push(eq(notificationsTable.isRead, true));
        const rows = await db
          .select()
          .from(notificationsTable)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(notificationsTable.createdAt))
          .limit(query.limit);
        return rows.map(mapRow);
      },
      async markAsRead(notificationId) {
        const rows = await db
          .update(notificationsTable)
          .set({ isRead: true })
          .where(eq(notificationsTable.id, notificationId))
          .returning();
        return rows[0] ? mapRow(rows[0]) : null;
      },
      async close() {
        await sqlClient.close();
      },
    };
  }

  const sqlitePath =
    options.sqlitePath ?? process.env.NOTIFICATIONS_SQLITE_PATH ?? ".data/notifications_domain.sqlite";
  if (sqlitePath !== ":memory:") {
    mkdirSync(dirname(sqlitePath), { recursive: true });
  }
  const sqlite = new Database(sqlitePath);

  const mapRow = (r: any): NotificationDto => ({
    id: r.id,
    projectId: r.project_id,
    taskId: r.task_id ?? null,
    actorId: r.actor_id,
    recipientId: r.recipient_id ?? null,
    type: r.type,
    message: r.message,
    isRead: Boolean(r.is_read),
    createdAt: r.created_at,
  });

  return {
    async migrate() {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          task_id TEXT,
          actor_id TEXT NOT NULL,
          recipient_id TEXT,
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_project_created ON notifications (project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications (recipient_id, is_read);
      `);
    },
    async createNotification(input) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      sqlite
        .prepare(
          "INSERT INTO notifications (id, project_id, task_id, actor_id, recipient_id, type, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
        )
        .run(id, input.projectId, input.taskId, input.actorId, input.recipientId, input.type, input.message, now);
      return {
        id,
        projectId: input.projectId,
        taskId: input.taskId,
        actorId: input.actorId,
        recipientId: input.recipientId,
        type: input.type,
        message: input.message,
        isRead: false,
        createdAt: now,
      };
    },
    async listNotifications(query) {
      const clauses: string[] = [];
      const params: Array<string | number> = [];
      if (query.projectId) {
        clauses.push("project_id = ?");
        params.push(query.projectId);
      }
      if (query.recipientId) {
        clauses.push("recipient_id = ?");
        params.push(query.recipientId);
      }
      if (query.unreadOnly === "true") {
        clauses.push("is_read = 0");
      } else if (query.unreadOnly === "false") {
        clauses.push("is_read = 1");
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      params.push(query.limit);
      const rows = sqlite
        .query(`SELECT * FROM notifications ${where} ORDER BY created_at DESC, rowid DESC LIMIT ?`)
        .all(...params);
      return (rows as any[]).map(mapRow);
    },
    async markAsRead(notificationId) {
      const existing = sqlite.query("SELECT * FROM notifications WHERE id = ?").get(notificationId);
      if (!existing) return null;
      sqlite.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(notificationId);
      const updated = sqlite.query("SELECT * FROM notifications WHERE id = ?").get(notificationId);
      return updated ? mapRow(updated) : null;
    },
    async close() {
      sqlite.close();
    },
  };
}
