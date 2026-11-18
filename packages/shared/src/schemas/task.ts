/**
 * Shared Zod schemas for `Task` entities (`data-model.md` Domain 2.1).
 */

import { z } from "zod";
import { KANBAN_STATUSES } from "../constants/users.ts";
import { predefinedUserIdSchema, uuidV4Schema } from "./common.ts";

/** Validated Kanban column status schema (`To Do`, `In Progress`, `In Review`, `Done`). */
export const taskStatusSchema = z.enum(KANBAN_STATUSES, {
  errorMap: () => ({
    message: "Status must be one of: To Do, In Progress, In Review, Done",
  }),
});

/** Validated `Task` DTO matching `data-model.md` (`Task.id`, `Task.projectId`, `Task.title`, `Task.description`, `Task.status`, `Task.assigneeId`, `Task.createdById`, `Task.position`, `Task.createdAt`, `Task.updatedAt`). */
export const taskSchema = z.object({
  id: uuidV4Schema,
  projectId: uuidV4Schema,
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable(),
  status: taskStatusSchema,
  assigneeId: predefinedUserIdSchema.nullable(),
  createdById: predefinedUserIdSchema,
  position: z.number().int().min(0),
  commentCount: z.number().int().min(0).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Input schema for `POST /api/v1/projects/:projectId/tasks`.
 *
 * Enforces `Task.title` (1..150 chars), `Task.description` (0..2000 chars),
 * `Task.status` (default `'To Do'`), and `Task.assigneeId` (`0..1` predefined user UUID or `null`).
 */
export const createTaskSchema = z.object({
  title: z
    .string({ required_error: "Task title is required" })
    .trim()
    .min(1, "Task title cannot be empty")
    .max(150, "Task title cannot exceed 150 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Task description cannot exceed 2000 characters")
    .nullable()
    .optional()
    .transform((val) => (val === undefined || val === "" ? null : val)),
  status: taskStatusSchema.optional().default("To Do"),
  assigneeId: predefinedUserIdSchema
    .nullable()
    .optional()
    .transform((val) => (val === undefined ? null : val)),
});

/**
 * Input schema for `PATCH /api/v1/tasks/:taskId`.
 *
 * Distinguishes omitted `assigneeId` (no change) from explicit `null` (unassign).
 * Requires at least one updatable field.
 */
export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Task title cannot be empty")
      .max(150, "Task title cannot exceed 150 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Task description cannot exceed 2000 characters")
      .nullable()
      .optional()
      .transform((val) => (val === "" ? null : val)),
    status: taskStatusSchema.optional(),
    assigneeId: predefinedUserIdSchema.nullable().optional(),
    position: z.number().int().min(0, "Position must be a non-negative integer").optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.assigneeId !== undefined ||
      data.position !== undefined,
    { message: "At least one updatable task field must be provided" },
  );

export type TaskDto = z.infer<typeof taskSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
