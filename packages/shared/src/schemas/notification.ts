/**
 * Shared Zod schemas for `Notification` entities (`data-model.md` Domain 3.1).
 */

import { z } from "zod";
import { NOTIFICATION_TYPES } from "../constants/users.ts";
import { predefinedUserIdSchema, uuidV4Schema } from "./common.ts";

/** Validated `Notification` DTO matching `data-model.md` (`Notification.id`, `Notification.projectId`, `Notification.taskId`, `Notification.actorId`, `Notification.recipientId`, `Notification.type`, `Notification.message`, `Notification.isRead`, `Notification.createdAt`). */
export const notificationSchema = z.object({
  id: uuidV4Schema,
  projectId: uuidV4Schema,
  taskId: uuidV4Schema.nullable(),
  actorId: predefinedUserIdSchema,
  recipientId: predefinedUserIdSchema.nullable(),
  type: z.enum(NOTIFICATION_TYPES),
  message: z.string().trim().min(1).max(500),
  isRead: z.boolean(),
  createdAt: z.string(),
});

/** Query parameter validation schema for `GET /api/v1/notifications`. */
export const notificationQuerySchema = z.object({
  projectId: uuidV4Schema.optional(),
  recipientId: predefinedUserIdSchema.optional(),
  unreadOnly: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

export type NotificationDto = z.infer<typeof notificationSchema>;
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
