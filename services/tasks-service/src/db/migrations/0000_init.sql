-- Initial migration for tasks_domain.tasks table
CREATE SCHEMA IF NOT EXISTS tasks_domain;

DO $$ BEGIN
  CREATE TYPE tasks_domain.task_status AS ENUM ('To Do', 'In Progress', 'In Review', 'Done');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_tasks_project_status
  ON tasks_domain.tasks (project_id, status, position);
