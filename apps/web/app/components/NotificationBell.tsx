/**
 * Notification bell dropdown displaying real-time team activity events and read toggles.
 */

import React, { useState } from "react";
import type { NotificationDto } from "@taskify/shared";

/** Props for {@link NotificationBell}. */
export interface NotificationBellProps {
  readonly notifications: readonly NotificationDto[];
  readonly onMarkRead: (notificationId: string) => void;
}

/**
 * Renders the unread notification badge and activity dropdown list.
 */
export function NotificationBell({ notifications, onMarkRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={`Notifications (${unreadCount} unread)`}
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "0.4rem 0.7rem",
          borderRadius: "6px",
          border: "1px solid #cbd5e1",
          backgroundColor: "#ffffff",
          cursor: "pointer",
          fontSize: "0.85rem",
          fontWeight: 600,
        }}
      >
        Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Recent notifications"
          style={{
            position: "absolute",
            right: 0,
            top: "115%",
            width: "320px",
            maxHeight: "360px",
            overflowY: "auto",
            backgroundColor: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
            padding: "0.75rem",
            zIndex: 40,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            Team Activity
          </div>
          {notifications.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: "0.8rem" }}>No recent notifications</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "6px",
                    backgroundColor: n.isRead ? "#f8fafc" : "#eff6ff",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.8rem",
                  }}
                >
                  <div>{n.message}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", color: "#64748b", fontSize: "0.7rem" }}>
                    <span>{new Date(n.createdAt).toLocaleTimeString()}</span>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(n.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#2563eb",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                        }}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
