/**
 * Common Zod validation schemas shared across API gateway and downstream microservice boundaries.
 */

import { z } from "zod";
import { NOTIFICATION_TYPES, PREDEFINED_USER_IDS, UUID_V4_REGEX } from "../constants/users.ts";

/** Validates a canonical UUIDv4 string (case-normalized to lowercase). */
export const uuidV4Schema = z
  .string({ required_error: "Identifier is required" })
  .trim()
  .regex(UUID_V4_REGEX, "Must be a valid UUIDv4")
  .transform((val) => val.toLowerCase());

/** Validates that a UUID identifies one of the 5 predefined Phase 1 team members. */
export const predefinedUserIdSchema = uuidV4Schema.refine(
  (id) => PREDEFINED_USER_IDS.has(id),
  "User ID must correspond to one of the 5 predefined team members",
);

/** Standard path parameter schemas for REST endpoints. */
export const projectIdParamSchema = z.object({ projectId: uuidV4Schema });
export const taskIdParamSchema = z.object({ taskId: uuidV4Schema });
export const commentIdParamSchema = z.object({ commentId: uuidV4Schema });
export const notificationIdParamSchema = z.object({ notificationId: uuidV4Schema });

/** Internal domain event schema sent to `POST /internal/v1/events`. */
export const internalEventSchema = z.object({
  eventId: uuidV4Schema,
  type: z.enum(NOTIFICATION_TYPES),
  projectId: uuidV4Schema,
  taskId: uuidV4Schema.nullable().optional(),
  actorId: predefinedUserIdSchema,
  recipientId: predefinedUserIdSchema.nullable().optional(),
  message: z
    .string()
    .trim()
    .min(1, "Event message cannot be empty")
    .max(500, "Event message cannot exceed 500 characters"),
  payload: z.record(z.unknown()).optional(),
});

/** TypeScript DTO inferred from {@link internalEventSchema}. */
export type InternalEventDto = z.infer<typeof internalEventSchema>;
