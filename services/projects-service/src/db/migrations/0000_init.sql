-- Initial migration for projects_domain schema
CREATE SCHEMA IF NOT EXISTS projects_domain;

DO $$ BEGIN
  CREATE TYPE projects_domain.user_role AS ENUM ('Product Manager', 'Engineer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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
