/**
 * API Gateway edge security middleware: security headers, strict CORS, header sanitization,
 * and authenticated downstream microservice proxy helper.
 */

import { AppHttpError, getInternalServiceToken, verifyInternalServiceToken } from "@taskify/shared";

/** Upstream service configuration and fetch adapter for `api-gateway`. */
export interface GatewayProxyConfig {
  readonly projectsUrl: string;
  readonly tasksUrl: string;
  readonly notificationsUrl: string;
  readonly internalToken: string;
  readonly corsOrigin: string;
  readonly fetchFn: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Applies security and CORS headers to an outgoing gateway response.
 *
 * @param headers - Target headers map or object.
 * @param corsOrigin - Allowed browser origin.
 */
export function applySecurityHeaders(headers: Record<string, string | number>, corsOrigin: string): void {
  headers["x-content-type-options"] = "nosniff";
  headers["x-frame-options"] = "DENY";
  headers["referrer-policy"] = "no-referrer";
  headers["access-control-allow-origin"] = corsOrigin;
  headers["access-control-allow-methods"] = "GET,POST,PATCH,DELETE,OPTIONS";
  headers["access-control-allow-headers"] = "Content-Type,X-Active-User-Id";
}

/**
 * Verifies internal token for gateway's `/internal/v1/events` ingestion endpoint.
 *
 * @param request - Incoming internal request.
 * @param expectedToken - Configured shared internal token.
 * @throws {AppHttpError} `401 UNAUTHORIZED_SERVICE` on invalid or missing token.
 */
export function assertInternalGatewayCaller(
  request: Request,
  expectedToken: string = getInternalServiceToken(),
): void {
  const token = request.headers.get("x-internal-service-token");
  if (!verifyInternalServiceToken(token, expectedToken)) {
    throw new AppHttpError(
      401,
      "UNAUTHORIZED_SERVICE",
      "Missing or invalid internal service authentication token",
    );
  }
}

/**
 * Forwards an edge-validated request to a downstream microservice, replacing any untrusted
 * external `X-Internal-Service-Token` header with the gateway's verified internal secret.
 *
 * @param targetUrl - Full downstream microservice URL.
 * @param options - HTTP method, active-user header, internal token, JSON body, and fetch implementation.
 * @returns Downstream HTTP status and parsed JSON body.
 */
export async function forwardToService(
  targetUrl: string,
  options: {
    readonly method: "GET" | "POST" | "PATCH" | "DELETE";
    readonly internalToken: string;
    readonly activeUserId?: string | null;
    readonly body?: unknown;
    readonly fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  },
): Promise<{ readonly status: number; readonly data: unknown }> {
  const headers: Record<string, string> = {
    // Strip any client-supplied internal token by explicitly overwriting it here.
    "x-internal-service-token": options.internalToken,
  };
  if (options.activeUserId) {
    headers["x-active-user-id"] = options.activeUserId;
  }
  const init: RequestInit = {
    method: options.method,
    headers,
  };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await options.fetchFn(targetUrl, init);
  const data = await response.json().catch(() => ({
    error: { code: "INTERNAL_ERROR", message: "Upstream service returned an invalid response" },
  }));
  return { status: response.status, data };
}
