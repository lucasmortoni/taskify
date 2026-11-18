-- Initial migration for notifications_domain schema
CREATE SCHEMA IF NOT EXISTS notifications_domain;

DO $$ BEGIN
  CREATE TYPE notifications_domain.notification_type AS ENUM (
    'PROJECT_CREATED',
    'TASK_CREATED',
    'TASK_STATUS_CHANGED',
    'TASK_ASSIGNED',
    'COMMENT_CREATED',
    'COMMENT_UPDATED',
    'COMMENT_DELETED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notifications_domain.notifications (
  id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  task_id UUID,
  actor_id UUID NOT NULL,
  recipient_id UUID,
  type notifications_domain.notification_type NOT NULL,
  message VARCHAR(500) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_project_created
  ON notifications_domain.notifications (project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
  ON notifications_domain.notifications (recipient_id, is_read);
