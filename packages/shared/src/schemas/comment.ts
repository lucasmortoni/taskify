/**
 * Shared Zod schemas for `Comment` entities (`data-model.md` Domain 2.2).
 */

import { z } from "zod";
import { predefinedUserIdSchema, uuidV4Schema } from "./common.ts";

/** Validated `Comment` DTO matching `data-model.md` (`Comment.id`, `Comment.taskId`, `Comment.authorId`, `Comment.content`, `Comment.createdAt`, `Comment.updatedAt`). */
export const commentSchema = z.object({
  id: uuidV4Schema,
  taskId: uuidV4Schema,
  authorId: predefinedUserIdSchema,
  content: z.string().trim().min(1).max(1000),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Input schema for `POST /api/v1/tasks/:taskId/comments`.
 *
 * Enforces `Comment.content` (trimmed, 1..1000 chars).
 */
export const createCommentSchema = z.object({
  content: z
    .string({ required_error: "Comment content is required" })
    .trim()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment cannot exceed 1000 characters"),
});

/**
 * Input schema for `PATCH /api/v1/comments/:commentId`.
 *
 * Enforces `Comment.content` (trimmed, 1..1000 chars).
 */
export const updateCommentSchema = createCommentSchema;

export type CommentDto = z.infer<typeof commentSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
