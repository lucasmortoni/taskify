-- Comments migration for tasks_domain.comments table
CREATE TABLE IF NOT EXISTS tasks_domain.comments (
  id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks_domain.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_task_created
  ON tasks_domain.comments (task_id, created_at);
