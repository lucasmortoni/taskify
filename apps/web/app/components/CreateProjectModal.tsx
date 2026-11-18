/**
 * Modal dialog for creating a new Taskify project with client-side Zod validation (`FR-004`).
 */

import React, { useState } from "react";
import { type CreateProjectInput, createProjectSchema } from "@taskify/shared/browser";

/** Props for {@link CreateProjectModal}. */
export interface CreateProjectModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (input: CreateProjectInput) => Promise<void>;
}

/**
 * Displays a project creation modal validating name (1..100 chars) and description (0..500 chars).
 */
export function CreateProjectModal({ isOpen, onClose, onSubmit }: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createProjectSchema.safeParse({
      name,
      description: description || null,
    });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? "Invalid project input");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit(parsed.data);
      setName("");
      setDescription("");
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          padding: "1.25rem",
          width: "min(440px, 92vw)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <h3 id="create-project-title" style={{ margin: 0 }}>
          Create New Project
        </h3>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
          <span>Project Name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Customer Portal MVP"
            maxLength={100}
            style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
          <span>Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Short summary of project scope"
            style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          />
        </label>

        {errorMsg && (
          <div role="alert" style={{ color: "#b91c1c", fontSize: "0.85rem" }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "0.45rem 0.9rem", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "6px",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}
