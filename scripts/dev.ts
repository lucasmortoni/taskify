/**
 * Local orchestrator script launching all 4 backend services and the React SSR web server.
 */

const processes = [
  { name: "notifications-service", cmd: ["bun", "run", "services/notifications-service/src/index.ts"] },
  { name: "projects-service", cmd: ["bun", "run", "services/projects-service/src/index.ts"] },
  { name: "tasks-service", cmd: ["bun", "run", "services/tasks-service/src/index.ts"] },
  { name: "api-gateway", cmd: ["bun", "run", "services/api-gateway/src/index.ts"] },
  { name: "web", cmd: ["bun", "run", "apps/web/src/server.tsx"] },
];

const children = processes.map((proc) =>
  Bun.spawn(proc.cmd, {
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  }),
);

process.on("SIGINT", () => {
  for (const child of children) child.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  for (const child of children) child.kill();
  process.exit(0);
});

await Promise.all(children.map((child) => child.exited));
