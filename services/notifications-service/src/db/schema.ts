/**
 * Drizzle ORM PostgreSQL schema for `notifications-service` (`notifications_domain` schema).
 *
 * Isolates `Notification` entities per `data-model.md` Section 3 with zero cross-service DB foreign keys.
 */

import { boolean, index, pgSchema, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Isolated PostgreSQL schema for Notifications domain. */
export const notificationsSchema = pgSchema("notifications_domain");

/** PostgreSQL enum for supported activity notification types. */
export const notificationTypeEnum = notificationsSchema.enum("notification_type", [
  "PROJECT_CREATED",
  "TASK_CREATED",
  "TASK_STATUS_CHANGED",
  "TASK_ASSIGNED",
  "COMMENT_CREATED",
  "COMMENT_UPDATED",
  "COMMENT_DELETED",
]);

/**
 * `notifications_domain.notifications` table (`Notification.id`, `Notification.projectId`, `Notification.taskId`, `Notification.actorId`, `Notification.recipientId`, `Notification.type`, `Notification.message`, `Notification.isRead`, `Notification.createdAt`).
 */
export const notificationsTable = notificationsSchema.table(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id"),
    actorId: uuid("actor_id").notNull(),
    recipientId: uuid("recipient_id"),
    type: notificationTypeEnum("type").notNull(),
    message: varchar("message", { length: 500 }).notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_notifications_project_created").on(table.projectId, table.createdAt),
    index("idx_notifications_recipient_read").on(table.recipientId, table.isRead),
  ],
);
