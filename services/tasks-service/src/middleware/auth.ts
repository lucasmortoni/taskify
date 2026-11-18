/**
 * Zero-Trust internal service token verification guard for `tasks-service`.
 *
 * Security Assumption: All task and comment endpoints require `X-Internal-Service-Token`
 * verified in constant time against the configured secret.
 */

import {
  AppHttpError,
  getInternalServiceToken,
  verifyInternalServiceToken,
} from "@taskify/shared";

/**
 * Verifies the `X-Internal-Service-Token` header on protected microservice requests.
 *
 * @param request - Incoming HTTP request.
 * @param expectedToken - Configured shared internal token.
 * @throws {AppHttpError} `401 UNAUTHORIZED_SERVICE` when token is absent or invalid.
 */
export function requireInternalServiceToken(
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
