/**
 * Real-time SSE EventSource listener hook subscribing to `/api/v1/events/stream`.
 */

import { useEffect, useRef } from "react";

/** Callback handlers invoked when real-time domain SSE events arrive. */
export interface RealtimeHandlers {
  readonly onProjectCreated?: () => void;
  readonly onTaskChanged?: () => void;
  readonly onCommentChanged?: (payload: { taskId?: string }) => void;
  readonly onNotificationCreated?: () => void;
}

/**
 * Subscribes to gateway Server-Sent Events and dispatches cache/UI refresh callbacks.
 *
 * @param baseUrl - Gateway base URL (or empty string for same-origin proxy).
 * @param projectId - Optional project filter UUID.
 * @param handlers - Event callbacks for projects, tasks, comments, and notifications.
 */
export function useRealtimeEvents(
  baseUrl: string,
  projectId: string | null,
  handlers: RealtimeHandlers,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    const prefix = baseUrl.replace(/\/$/, "");
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const source = new EventSource(`${prefix}/api/v1/events/stream${query}`);

    source.addEventListener("project.created", () => {
      handlersRef.current.onProjectCreated?.();
    });
    source.addEventListener("task.created", () => {
      handlersRef.current.onTaskChanged?.();
    });
    source.addEventListener("task.updated", () => {
      handlersRef.current.onTaskChanged?.();
    });
    source.addEventListener("comment.changed", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as { taskId?: string };
        handlersRef.current.onCommentChanged?.(parsed);
      } catch {
        handlersRef.current.onCommentChanged?.({});
      }
    });
    source.addEventListener("notification.created", () => {
      handlersRef.current.onNotificationCreated?.();
    });

    return () => {
      source.close();
    };
  }, [baseUrl, projectId]);
}
