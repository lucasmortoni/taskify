/**
 * Drizzle ORM PostgreSQL schema for `projects-service` (`projects_domain` schema).
 *
 * Isolates `User` and `Project` entities per `data-model.md` Section 1 with zero cross-service joins.
 */

import { pgSchema, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Isolated PostgreSQL schema for Projects & Users domain. */
export const projectsSchema = pgSchema("projects_domain");

/** PostgreSQL enum for Phase 1 team member roles. */
export const userRoleEnum = projectsSchema.enum("user_role", ["Product Manager", "Engineer"]);

/**
 * `projects_domain.users` table (`User.id`, `User.name`, `User.role`, `User.avatarUrl`, `User.createdAt`).
 */
export const usersTable = projectsSchema.table("users", {
  id: uuid("id").primaryKey().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  role: userRoleEnum("role").notNull(),
  avatarUrl: varchar("avatar_url", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

/**
 * `projects_domain.projects` table (`Project.id`, `Project.name`, `Project.description`, `Project.createdById`, `Project.createdAt`, `Project.updatedAt`).
 */
export const projectsTable = projectsSchema.table("projects", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 500 }),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});
