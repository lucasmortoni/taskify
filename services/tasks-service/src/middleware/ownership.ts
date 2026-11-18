/**
 * Comment ownership enforcement middleware for `tasks-service` (`FR-009`).
 *
 * Security Assumption: Only the comment's original creator (`comment.authorId === activeUserId`)
 * may edit or delete a comment; violations fail with `403 FORBIDDEN_NOT_COMMENT_AUTHOR`.
 */

import { AppHttpError, type CommentDto } from "@taskify/shared";

/**
 * Ensures the active user matches the comment's original author.
 *
 * @param comment - Persisted comment record (or `null` if not found).
 * @param activeUserId - Validated `X-Active-User-Id` UUID.
 * @returns The verified {@link CommentDto} when ownership succeeds.
 * @throws {AppHttpError} `404 NOT_FOUND` if missing; `403 FORBIDDEN_NOT_COMMENT_AUTHOR` if not author.
 */
export function assertCommentAuthor(comment: CommentDto | null, activeUserId: string): CommentDto {
  if (!comment) {
    throw new AppHttpError(404, "NOT_FOUND", "Comment not found");
  }
  if (comment.authorId !== activeUserId) {
    throw new AppHttpError(
      403,
      "FORBIDDEN_NOT_COMMENT_AUTHOR",
      "Only the comment author can edit or delete this comment",
    );
  }
  return comment;
}
