/**
 * Isolated data-store client for `projects-service` (`projects_domain`).
 *
 * Uses Bun's native PostgreSQL Drizzle driver (`drizzle-orm/bun-sql`) when `POSTGRES_ENABLED=true`,
 * and falls back to an isolated per-service `bun:sqlite` store (`.data/projects_domain.sqlite`)
 * when running without a live Postgres daemon.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SQL } from "bun";
import { desc, eq } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/bun-sql";
import type { ProjectDto, UserDto } from "@taskify/shared";
import { PREDEFINED_USERS, SAMPLE_PROJECTS } from "@taskify/shared";
import { projectsTable, usersTable } from "./schema.ts";

/** Options for constructing an isolated Projects store instance. */
export interface ProjectsStoreOptions {
  readonly sqlitePath?: string;
  readonly postgresUrl?: string;
  readonly usePostgres?: boolean;
}

/** Projects repository interface isolating SQL engine details from HTTP handlers. */
export interface ProjectsStore {
  migrate(): Promise<void>;
  seed(): Promise<void>;
  listUsers(): Promise<UserDto[]>;
  listProjects(): Promise<ProjectDto[]>;
  getProjectById(id: string): Promise<ProjectDto | null>;
  createProject(input: { name: string; description: string | null; createdById: string }): Promise<ProjectDto>;
  close(): Promise<void>;
}

/**
 * Creates a {@link ProjectsStore} backed by PostgreSQL (`projects_domain` schema) or isolated SQLite.
 *
 * @param options - Storage adapter configuration.
 * @returns Initialized {@link ProjectsStore}.
 */
export function createProjectsStore(options: ProjectsStoreOptions = {}): ProjectsStore {
  const usePostgres =
    options.usePostgres ?? (process.env.POSTGRES_ENABLED === "true" && Boolean(process.env.PROJECTS_DATABASE_URL));

  if (usePostgres) {
    const url =
      options.postgresUrl ??
      process.env.PROJECTS_DATABASE_URL ??
      "postgres://taskify:taskify_dev_password@localhost:5432/taskify";
    const sqlClient = new SQL(url);
    const db = drizzlePg({ client: sqlClient });

    return {
      async migrate() {
        await sqlClient.unsafe(`
          CREATE SCHEMA IF NOT EXISTS projects_domain;
          DO $$ BEGIN
            CREATE TYPE projects_domain.user_role AS ENUM ('Product Manager', 'Engineer');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
          CREATE TABLE IF NOT EXISTS projects_domain.users (
            id UUID PRIMARY KEY NOT NULL,
            name VARCHAR(100) NOT NULL,
            role projects_domain.user_role NOT NULL,
            avatar_url VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS projects_domain.projects (
            id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            description VARCHAR(500),
            created_by_id UUID NOT NULL REFERENCES projects_domain.users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
      },
      async seed() {
        for (const user of PREDEFINED_USERS) {
          await db
            .insert(usersTable)
            .values({ id: user.id, name: user.name, role: user.role, avatarUrl: user.avatarUrl })
            .onConflictDoNothing();
        }
        for (const project of SAMPLE_PROJECTS) {
          await db
            .insert(projectsTable)
            .values({
              id: project.id,
              name: project.name,
              description: project.description,
              createdById: project.createdById,
            })
            .onConflictDoNothing();
        }
      },
      async listUsers() {
        const rows = await db.select().from(usersTable);
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          role: r.role,
          avatarUrl: r.avatarUrl ?? null,
          createdAt: new Date(r.createdAt).toISOString(),
        }));
      },
      async listProjects() {
        const rows = await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt));
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description ?? null,
          createdById: r.createdById,
          createdAt: new Date(r.createdAt).toISOString(),
          updatedAt: new Date(r.updatedAt).toISOString(),
        }));
      },
      async getProjectById(id: string) {
        const rows = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
        const r = rows[0];
        if (!r) return null;
        return {
          id: r.id,
          name: r.name,
          description: r.description ?? null,
          createdById: r.createdById,
          createdAt: new Date(r.createdAt).toISOString(),
          updatedAt: new Date(r.updatedAt).toISOString(),
        };
      },
      async createProject(input) {
        const rows = await db
          .insert(projectsTable)
          .values({
            name: input.name,
            description: input.description,
            createdById: input.createdById,
          })
          .returning();
        const r = rows[0]!;
        return {
          id: r.id,
          name: r.name,
          description: r.description ?? null,
          createdById: r.createdById,
          createdAt: new Date(r.createdAt).toISOString(),
          updatedAt: new Date(r.updatedAt).toISOString(),
        };
      },
      async close() {
        await sqlClient.close();
      },
    };
  }

  const sqlitePath = options.sqlitePath ?? process.env.PROJECTS_SQLITE_PATH ?? ".data/projects_domain.sqlite";
  if (sqlitePath !== ":memory:") {
    mkdirSync(dirname(sqlitePath), { recursive: true });
  }
  const sqlite = new Database(sqlitePath);
  sqlite.exec("PRAGMA foreign_keys = ON;");

  const mapUser = (r: {
    id: string;
    name: string;
    role: "Product Manager" | "Engineer";
    avatar_url: string | null;
    created_at: string;
  }): UserDto => ({
    id: r.id,
    name: r.name,
    role: r.role,
    avatarUrl: r.avatar_url ?? null,
    createdAt: r.created_at,
  });

  const mapProject = (r: {
    id: string;
    name: string;
    description: string | null;
    created_by_id: string;
    created_at: string;
    updated_at: string;
  }): ProjectDto => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    createdById: r.created_by_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  return {
    async migrate() {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('Product Manager', 'Engineer')),
          avatar_url TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_by_id TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    },
    async seed() {
      const now = new Date().toISOString();
      const insertUser = sqlite.prepare(
        "INSERT OR IGNORE INTO users (id, name, role, avatar_url, created_at) VALUES (?, ?, ?, ?, ?)",
      );
      for (const user of PREDEFINED_USERS) {
        insertUser.run(user.id, user.name, user.role, user.avatarUrl, now);
      }
      const insertProject = sqlite.prepare(
        "INSERT OR IGNORE INTO projects (id, name, description, created_by_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      );
      SAMPLE_PROJECTS.forEach((project, idx) => {
        const ts = new Date(Date.now() - (SAMPLE_PROJECTS.length - idx) * 60_000).toISOString();
        insertProject.run(project.id, project.name, project.description, project.createdById, ts, ts);
      });
    },
    async listUsers() {
      const rows = sqlite.query("SELECT id, name, role, avatar_url, created_at FROM users ORDER BY rowid ASC").all();
      return (rows as any[]).map(mapUser);
    },
    async listProjects() {
      const rows = sqlite
        .query("SELECT id, name, description, created_by_id, created_at, updated_at FROM projects ORDER BY created_at DESC")
        .all();
      return (rows as any[]).map(mapProject);
    },
    async getProjectById(id: string) {
      const row = sqlite
        .query("SELECT id, name, description, created_by_id, created_at, updated_at FROM projects WHERE id = ?")
        .get(id);
      return row ? mapProject(row as any) : null;
    },
    async createProject(input) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      sqlite
        .prepare(
          "INSERT INTO projects (id, name, description, created_by_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(id, input.name, input.description, input.createdById, now, now);
      return {
        id,
        name: input.name,
        description: input.description,
        createdById: input.createdById,
        createdAt: now,
        updatedAt: now,
      };
    },
    async close() {
      sqlite.close();
    },
  };
}
