/**
 * Shared Zod schemas for `User` and `Project` entities (`data-model.md` Domain 1).
 */

import { z } from "zod";
import { uuidV4Schema, predefinedUserIdSchema } from "./common.ts";

/** Validated `User` DTO matching `data-model.md` (`User.id`, `User.name`, `User.role`, `User.avatarUrl`, `User.createdAt`). */
export const userSchema = z.object({
  id: predefinedUserIdSchema,
  name: z.string().trim().min(1).max(100),
  role: z.enum(["Product Manager", "Engineer"]),
  avatarUrl: z.string().trim().max(255).nullable(),
  createdAt: z.string(),
});

/** Validated `Project` DTO matching `data-model.md` (`Project.id`, `Project.name`, `Project.description`, `Project.createdById`, `Project.createdAt`, `Project.updatedAt`). */
export const projectSchema = z.object({
  id: uuidV4Schema,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable(),
  createdById: predefinedUserIdSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Input schema for `POST /api/v1/projects`.
 *
 * Enforces `Project.name` (trimmed, 1..100 chars) and optional `Project.description` (trimmed, 0..500 chars)
 * per `data-model.md` and `FR-004`.
 */
export const createProjectSchema = z.object({
  name: z
    .string({ required_error: "Project name is required" })
    .trim()
    .min(1, "Project name cannot be empty")
    .max(100, "Project name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Project description cannot exceed 500 characters")
    .nullable()
    .optional()
    .transform((val) => (val === undefined || val === "" ? null : val)),
});

export type UserDto = z.infer<typeof userSchema>;
export type ProjectDto = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
