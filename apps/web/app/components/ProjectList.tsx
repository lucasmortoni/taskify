/**
 * Project navigation sidebar and sample project directory component (`FR-003`, `FR-004`).
 */

import React from "react";
import type { ProjectDto } from "@taskify/shared";

/** Props for {@link ProjectList}. */
export interface ProjectListProps {
  readonly projects: readonly ProjectDto[];
  readonly selectedProjectId: string | null;
  readonly onSelectProject: (projectId: string) => void;
  readonly onOpenCreateModal: () => void;
}

/**
 * Displays all projects (including the 3 seeded sample projects) and triggers new project creation.
 */
export function ProjectList({
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenCreateModal,
}: ProjectListProps) {
  return (
    <aside
      aria-label="Projects"
      style={{
        width: "260px",
        flexShrink: 0,
        borderRight: "1px solid #e2e8f0",
        padding: "1rem",
        backgroundColor: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
          Projects ({projects.length})
        </h2>
        <button
          type="button"
          onClick={onOpenCreateModal}
          style={{
            padding: "0.35rem 0.65rem",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          + New Project
        </button>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {projects.map((project) => {
          const isSelected = project.id === selectedProjectId;
          return (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onSelectProject(project.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "8px",
                  border: isSelected ? "1px solid #3b82f6" : "1px solid transparent",
                  backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{project.name}</div>
                {project.description && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#475569",
                      marginTop: "0.2rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {project.description}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
