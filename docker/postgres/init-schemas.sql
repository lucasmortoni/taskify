-- Create isolated schemas for each Taskify microservice (Constitution Principle III)
CREATE SCHEMA IF NOT EXISTS projects_domain;
CREATE SCHEMA IF NOT EXISTS tasks_domain;
CREATE SCHEMA IF NOT EXISTS notifications_domain;
