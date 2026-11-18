/**
 * TanStack Start-style React SSR & client hydration configuration for `@taskify/web`.
 */
export const appConfig = {
  appName: "Taskify",
  port: Number(process.env.WEB_APP_PORT ?? 3000),
  apiGatewayUrl: process.env.API_GATEWAY_URL ?? "http://localhost:3001",
  ssrRoutes: ["/", "/projects/$projectId"] as const,
};

export default appConfig;
