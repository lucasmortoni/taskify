/**
 * Security utilities, constant-time token verification, Zod boundary validation helpers,
 * sanitized error envelope builders, and OpenAPI 3.1 Swagger documentation registration.
 */

import { timingSafeEqual } from "node:crypto";
import type { Elysia } from "elysia";
import type { ZodError, ZodType } from "zod";
import { PREDEFINED_USER_IDS, UUID_V4_REGEX } from "../constants/users.ts";

/** Standard Taskify API error codes defined in `contracts/rest-api.md`. */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_USER"
  | "UNAUTHORIZED_SERVICE"
  | "FORBIDDEN_NOT_COMMENT_AUTHOR"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

/** Field-level validation error entry. */
export interface ErrorDetail {
  readonly field: string;
  readonly reason: string;
}

/** Standard sanitized JSON error envelope. */
export interface ApiErrorEnvelope {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly details?: readonly ErrorDetail[];
  };
}

/**
 * Resolves the configured internal service authentication token.
 *
 * @returns Non-empty internal token used for zero-trust service-to-service checks.
 */
export function getInternalServiceToken(): string {
  return process.env.INTERNAL_SERVICE_TOKEN ?? "taskify-internal-dev-token-change-in-prod";
}

/**
 * Verifies an incoming `X-Internal-Service-Token` header using constant-time comparison.
 *
 * Security Assumption: Rejects missing, empty, or mismatched tokens without leaking
 * token length or timing differences (`UNAUTHORIZED_SERVICE`).
 *
 * @param providedHeader - Raw `X-Internal-Service-Token` header value from request.
 * @param expectedToken - Configured shared internal token (defaults to env config).
 * @returns `true` if the token matches in constant time; otherwise `false`.
 */
export function verifyInternalServiceToken(
  providedHeader: string | null | undefined,
  expectedToken: string = getInternalServiceToken(),
): boolean {
  if (!providedHeader || !expectedToken) {
    return false;
  }
  const providedBytes = Buffer.from(providedHeader, "utf8");
  const expectedBytes = Buffer.from(expectedToken, "utf8");
  if (providedBytes.length !== expectedBytes.length) {
    // Perform a dummy constant-time compare to avoid leaking length discrepancies.
    timingSafeEqual(expectedBytes, expectedBytes);
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

/** Result of validating the `X-Active-User-Id` request header. */
export type ActiveUserValidationResult =
  | { readonly ok: true; readonly userId: string }
  | {
      readonly ok: false;
      readonly status: 400;
      readonly body: ApiErrorEnvelope;
    };

/**
 * Validates that `X-Active-User-Id` is present, formatted as UUIDv4, and belongs to
 * one of the 5 predefined Phase 1 team members.
 *
 * @param rawHeader - Raw `X-Active-User-Id` header value.
 * @returns Validated lowercase UUID or a sanitized `400` error envelope.
 */
export function validateActiveUserId(rawHeader: string | null | undefined): ActiveUserValidationResult {
  if (!rawHeader || typeof rawHeader !== "string" || !rawHeader.trim()) {
    return {
      ok: false,
      status: 400,
      body: buildErrorResponse("VALIDATION_ERROR", "Missing required X-Active-User-Id header", [
        { field: "X-Active-User-Id", reason: "Header must contain a valid predefined user UUID" },
      ]),
    };
  }
  const normalized = rawHeader.trim().toLowerCase();
  if (!UUID_V4_REGEX.test(normalized)) {
    return {
      ok: false,
      status: 400,
      body: buildErrorResponse("VALIDATION_ERROR", "Invalid X-Active-User-Id format", [
        { field: "X-Active-User-Id", reason: "Must be a valid UUIDv4" },
      ]),
    };
  }
  if (!PREDEFINED_USER_IDS.has(normalized)) {
    return {
      ok: false,
      status: 400,
      body: buildErrorResponse("INVALID_USER", "Selected user is not a valid predefined team member", [
        { field: "X-Active-User-Id", reason: "User ID does not exist in the Phase 1 roster" },
      ]),
    };
  }
  return { ok: true, userId: normalized };
}

/**
 * Builds a sanitized JSON error response leaking zero internal stack traces or SQL details.
 *
 * @param code - Standardized API error code.
 * @param message - User-friendly summary message.
 * @param details - Optional array of field-level validation issues.
 * @returns Standardized {@link ApiErrorEnvelope}.
 */
export function buildErrorResponse(
  code: ApiErrorCode,
  message: string,
  details?: readonly ErrorDetail[],
): ApiErrorEnvelope {
  return {
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  };
}

/**
 * Formats a `ZodError` into sanitized field-level error details.
 *
 * @param error - Zod validation error instance.
 * @returns Array of {@link ErrorDetail} items.
 */
export function formatZodErrors(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "payload",
    reason: issue.message,
  }));
}

/** Result of parsing an input value with a Zod schema. */
export type ParseResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly status: 400; readonly body: ApiErrorEnvelope };

/**
 * Parses and normalizes unknown input against a Zod schema, returning a sanitized `400 VALIDATION_ERROR`
 * payload on failure.
 *
 * @param schema - Zod schema used to validate and transform the payload.
 * @param input - Untrusted external input.
 * @returns Parsed typed data or sanitized error envelope.
 */
export function validateWithZod<TOutput>(
  schema: ZodType<TOutput, any, unknown>,
  input: unknown,
): ParseResult<TOutput> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = formatZodErrors(result.error);
    return {
      ok: false,
      status: 400,
      body: buildErrorResponse("VALIDATION_ERROR", "Input validation failed", details),
    };
  }
  return { ok: true, data: result.data };
}

/** Typed domain error thrown by route handlers and converted cleanly by Elysia `.onError`. */
export class AppHttpError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly details?: readonly ErrorDetail[];

  constructor(status: number, code: ApiErrorCode, message: string, details?: readonly ErrorDetail[]) {
    super(message);
    this.name = "AppHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Normalizes any Elysia validation or unexpected runtime error into a sanitized HTTP error envelope.
 *
 * @param code - Elysia error code (`VALIDATION`, `NOT_FOUND`, `PARSE`, etc.).
 * @param error - Thrown error object.
 * @returns HTTP status code and sanitized {@link ApiErrorEnvelope}.
 */
export function sanitizeFrameworkError(
  code: string | number,
  error: unknown,
): { readonly status: number; readonly body: ApiErrorEnvelope } {
  if (error instanceof AppHttpError) {
    return {
      status: error.status,
      body: buildErrorResponse(error.code, error.message, error.details),
    };
  }
  if (code === "VALIDATION") {
    const maybeErr = error as { message?: string; all?: Array<{ path?: string; message?: string }> };
    const details: ErrorDetail[] =
      Array.isArray(maybeErr?.all) && maybeErr.all.length > 0
        ? maybeErr.all.map((entry) => ({
            field: (entry.path ?? "payload").replace(/^\//, "") || "payload",
            reason: entry.message ?? "Invalid value",
          }))
        : [{ field: "payload", reason: "Request validation failed" }];
    return {
      status: 400,
      body: buildErrorResponse("VALIDATION_ERROR", "Input validation failed", details),
    };
  }
  if (code === "PARSE") {
    return {
      status: 400,
      body: buildErrorResponse("VALIDATION_ERROR", "Malformed JSON request body"),
    };
  }
  if (code === "NOT_FOUND") {
    return {
      status: 404,
      body: buildErrorResponse("NOT_FOUND", "Requested resource was not found"),
    };
  }
  return {
    status: 500,
    body: buildErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"),
  };
}

/** Metadata used to generate OpenAPI 3.1 Swagger endpoints for each microservice. */
export interface SwaggerServiceMeta {
  readonly title: string;
  readonly version: string;
  readonly description: string;
  readonly routes: ReadonlyArray<{
    readonly method: "GET" | "POST" | "PATCH" | "DELETE";
    readonly path: string;
    readonly summary: string;
  }>;
}

/**
 * Registers OpenAPI 3.1 documentation endpoints (`/swagger/json` and `/swagger`) on an Elysia service.
 *
 * @param app - Elysia application instance.
 * @param meta - Service title, version, description, and endpoint catalog.
 * @returns Modified Elysia instance.
 */
export function registerSwagger<TApp extends Elysia<any, any, any, any, any, any, any>>(
  app: TApp,
  meta: SwaggerServiceMeta,
): TApp {
  const paths: Record<string, Record<string, { summary: string; responses: Record<string, { description: string }> }>> =
    {};
  for (const route of meta.routes) {
    const openApiPath = route.path.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
    paths[openApiPath] ??= {};
    paths[openApiPath][route.method.toLowerCase()] = {
      summary: route.summary,
      responses: {
        "200": { description: "Success" },
        "400": { description: "Validation Error" },
      },
    };
  }

  const specDocument = {
    openapi: "3.1.0",
    info: {
      title: meta.title,
      version: meta.version,
      description: meta.description,
    },
    paths,
  };

  return app
    .get("/swagger/json", () => specDocument)
    .get("/swagger", ({ set }) => {
      set.headers["content-type"] = "text/html; charset=utf-8";
      return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${meta.title} - OpenAPI 3.1</title></head>
<body style="font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;">
<h1>${meta.title} (${meta.version})</h1>
<p>${meta.description}</p>
<p>OpenAPI JSON: <a href="/swagger/json">/swagger/json</a></p>
<pre style="background:#f6f8fa;padding:1rem;border-radius:8px;overflow:auto;">${JSON.stringify(specDocument, null, 2)}</pre>
</body>
</html>`;
    }) as TApp;
}
