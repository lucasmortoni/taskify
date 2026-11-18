/**
 * In-memory Server-Sent Events (SSE) subscriber registry and broadcast dispatcher for `api-gateway`.
 */

import type { TextEncoder } from "node:util";

/** Active SSE client subscriber handle. */
interface SseSubscriber {
  readonly id: string;
  readonly projectIdFilter: string | null;
  readonly send: (chunk: Uint8Array) => void;
  readonly close: () => void;
}

/**
 * Manages active SSE browser connections and broadcasts real-time Kanban/notification events.
 */
export class SseHub {
  private readonly subscribers = new Map<string, SseSubscriber>();
  private readonly encoder = new globalThis.TextEncoder();

  /**
   * Registers a new SSE stream response for a browser client.
   *
   * @param projectIdFilter - Optional project UUID to scope received events.
   * @param signal - Optional AbortSignal to automatically clean up closed connections.
   * @returns Standard `text/event-stream` HTTP `Response`.
   */
  public createStreamResponse(projectIdFilter: string | null, signal?: AbortSignal): Response {
    const subscriberId = crypto.randomUUID();

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const subscriber: SseSubscriber = {
          id: subscriberId,
          projectIdFilter,
          send: (chunk) => {
            try {
              controller.enqueue(chunk);
            } catch {
              this.subscribers.delete(subscriberId);
            }
          },
          close: () => {
            this.subscribers.delete(subscriberId);
            try {
              controller.close();
            } catch {
              // Stream already closed
            }
          },
        };
        this.subscribers.set(subscriberId, subscriber);

        // Send initial connected frame immediately so clients mark stream ready.
        subscriber.send(this.encoder.encode(`: connected ${subscriberId}\n\n`));

        if (signal) {
          signal.addEventListener("abort", () => subscriber.close(), { once: true });
        }
      },
      cancel: () => {
        this.subscribers.delete(subscriberId);
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  }

  /**
   * Broadcasts a named SSE event frame to all matching active subscribers.
   *
   * @param eventName - SSE event type (`project.created`, `task.created`, `task.updated`, `comment.changed`, `notification.created`).
   * @param data - JSON-serializable event payload.
   */
  public publish(eventName: string, data: Record<string, unknown>): void {
    const projectId = typeof data.projectId === "string" ? data.projectId : null;
    const frame = this.encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.projectIdFilter && projectId && subscriber.projectIdFilter !== projectId) {
        continue;
      }
      subscriber.send(frame);
    }
  }

  /** Returns the current count of active SSE subscribers (for monitoring/tests). */
  public get subscriberCount(): number {
    return this.subscribers.size;
  }
}
