export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NOTIFICATIONS_DATABASE_URL ?? "postgres://taskify:taskify_dev_password@localhost:5432/taskify",
  },
  schemaFilter: ["notifications_domain"],
};
