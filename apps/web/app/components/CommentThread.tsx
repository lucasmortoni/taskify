/**
 * Chronological task comment thread component with Zod validation and author-only Edit/Delete controls (`FR-009`).
 */

import React, { useState } from "react";
import {
  type CommentDto,
  type CreateCommentInput,
  type UpdateCommentInput,
  type UserDto,
  createCommentSchema,
  updateCommentSchema,
} from "@taskify/shared/browser";

/** Props for {@link CommentThread}. */
export interface CommentThreadProps {
  readonly comments: readonly CommentDto[];
  readonly users: readonly UserDto[];
  readonly activeUserId: string;
  readonly onAddComment: (input: CreateCommentInput) => Promise<void>;
  readonly onUpdateComment: (commentId: string, input: UpdateCommentInput) => Promise<void>;
  readonly onDeleteComment: (commentId: string) => Promise<void>;
}

/**
 * Renders chronological comments and restricts edit/delete buttons exclusively to each comment's author.
 */
export function CommentThread({
  comments,
  users,
  activeUserId,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: CommentThreadProps) {
  const [newContent, setNewContent] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createCommentSchema.safeParse({ content: newContent });
    if (!parsed.success) {
      setComposerError(parsed.error.issues[0]?.message ?? "Comment cannot be empty");
      return;
    }
    setComposerError(null);
    try {
      await onAddComment(parsed.data);
      setNewContent("");
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : "Failed to post comment");
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    const parsed = updateCommentSchema.safeParse({ content: editingText });
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? "Comment cannot be empty");
      return;
    }
    setEditError(null);
    try {
      await onUpdateComment(commentId, parsed.data);
      setEditingId(null);
      setEditingText("");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update comment");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Comments ({comments.length})</h4>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "240px", overflowY: "auto" }}>
        {comments.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: "0.82rem" }}>No comments yet. Start the discussion below.</div>
        ) : (
          comments.map((comment) => {
            const author = users.find((u) => u.id === comment.authorId);
            const isAuthor = comment.authorId === activeUserId;
            const isEditing = editingId === comment.id;

            return (
              <div
                key={comment.id}
                data-comment-id={comment.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "0.6rem 0.75rem",
                  backgroundColor: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "#475569" }}>
                  <span>
                    <strong>{author?.name ?? "Team Member"}</strong> ({author?.role ?? "Member"})
                  </span>
                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                </div>

                {isEditing ? (
                  <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <textarea
                      aria-label="Edit comment text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                    {editError && (
                      <div role="alert" style={{ color: "#b91c1c", fontSize: "0.78rem" }}>
                        {editError}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(comment.id)}
                        style={{ padding: "0.25rem 0.6rem", borderRadius: "4px", border: "none", background: "#2563eb", color: "#fff", fontSize: "0.75rem" }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditError(null);
                        }}
                        style={{ padding: "0.25rem 0.6rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "0.75rem" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "#0f172a", whiteSpace: "pre-wrap" }}>
                    {comment.content}
                  </p>
                )}

                {isAuthor && !isEditing && (
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditingText(comment.content);
                        setEditError(null);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#2563eb",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        padding: 0,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteComment(comment.id)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#dc2626",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        padding: 0,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <textarea
          aria-label="New comment"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Add a comment..."
          style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
        />
        {composerError && (
          <div role="alert" style={{ color: "#b91c1c", fontSize: "0.8rem" }}>
            {composerError}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "6px",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: "pointer",
            }}
          >
            Post Comment
          </button>
        </div>
      </form>
    </div>
  );
}
