/**
 * Zero-login active user selector component (`FR-001`, `FR-002`).
 */

import React from "react";
import type { UserDto } from "@taskify/shared";

/** Props for {@link UserSwitcher}. */
export interface UserSwitcherProps {
  readonly users: readonly UserDto[];
  readonly activeUserId: string;
  readonly onSelectUser: (userId: string) => void;
}

/**
 * Renders the active predefined team member selector in the workspace header.
 */
export function UserSwitcher({ users, activeUserId, onSelectUser }: UserSwitcherProps) {
  const activeUser = users.find((u) => u.id === activeUserId);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <label htmlFor="active-user-select" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
        Acting as:
      </label>
      <select
        id="active-user-select"
        aria-label="Acting as predefined user"
        value={activeUserId}
        onChange={(e) => onSelectUser(e.target.value)}
        style={{
          padding: "0.4rem 0.65rem",
          borderRadius: "6px",
          border: "1px solid #cbd5e1",
          backgroundColor: "#ffffff",
          fontSize: "0.9rem",
        }}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.role})
          </option>
        ))}
      </select>
      {activeUser && (
        <span
          style={{
            fontSize: "0.75rem",
            padding: "0.2rem 0.5rem",
            borderRadius: "999px",
            backgroundColor: activeUser.role === "Product Manager" ? "#ede9fe" : "#e0f2fe",
            color: activeUser.role === "Product Manager" ? "#5b21b6" : "#075985",
            fontWeight: 600,
          }}
        >
          {activeUser.role}
        </span>
      )}
    </div>
  );
}
