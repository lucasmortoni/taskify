/**
 * Typed HTTP client for `apps/web` communicating with `api-gateway` (`/api/v1/*`).
 *
 * Security: Automatically attaches `X-Active-User-Id` on all requests and parses
 * sanitized `{ error: { code, message, details } }` payloads without exposing raw traces.
 */

import type {
  CommentDto,
  CreateCommentInput,
  CreateProjectInput,
  CreateTaskInput,
  NotificationDto,
  ProjectDto,
  TaskDto,
  UpdateCommentInput,
  UpdateTaskInput,
  UserDto,
} from "@taskify/shared";

/** Structured error thrown by {@link ApiClient} when the server rejects a request. */
export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: ReadonlyArray<{ readonly field: string; readonly reason: string }>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ReadonlyArray<{ readonly field: string; readonly reason: string }>,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Typed REST client wrapping `fetch` for Taskify API Gateway endpoints.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private getActiveUserId: () => string;

  /**
   * @param baseUrl - API Gateway origin or empty string for same-origin proxy.
   * @param getActiveUserId - Callback resolving the currently selected predefined user UUID.
   */
  constructor(baseUrl: string, getActiveUserId: () => string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.getActiveUserId = getActiveUserId;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("x-active-user-id", this.getActiveUserId());
    if (init.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const errObj = payload?.error;
      throw new ApiRequestError(
        res.status,
        errObj?.code ?? "INTERNAL_ERROR",
        errObj?.message ?? "Request failed",
        errObj?.details,
      );
    }
    return payload as T;
  }

  public async listUsers(): Promise<UserDto[]> {
    const res = await this.request<{ users: UserDto[] }>("/api/v1/users");
    return res.users;
  }

  public async listProjects(): Promise<ProjectDto[]> {
    const res = await this.request<{ projects: ProjectDto[] }>("/api/v1/projects");
    return res.projects;
  }

  public async createProject(input: CreateProjectInput): Promise<ProjectDto> {
    const res = await this.request<{ project: ProjectDto }>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return res.project;
  }

  public async listTasks(projectId: string): Promise<TaskDto[]> {
    const res = await this.request<{ tasks: TaskDto[] }>(`/api/v1/projects/${projectId}/tasks`);
    return res.tasks;
  }

  public async createTask(projectId: string, input: CreateTaskInput): Promise<TaskDto> {
    const res = await this.request<{ task: TaskDto }>(`/api/v1/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return res.task;
  }

  public async getTaskDetail(taskId: string): Promise<{ task: TaskDto; comments: CommentDto[] }> {
    return this.request<{ task: TaskDto; comments: CommentDto[] }>(`/api/v1/tasks/${taskId}`);
  }

  public async updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskDto> {
    const res = await this.request<{ task: TaskDto }>(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return res.task;
  }

  public async createComment(taskId: string, input: CreateCommentInput): Promise<CommentDto> {
    const res = await this.request<{ comment: CommentDto }>(`/api/v1/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return res.comment;
  }

  public async updateComment(commentId: string, input: UpdateCommentInput): Promise<CommentDto> {
    const res = await this.request<{ comment: CommentDto }>(`/api/v1/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return res.comment;
  }

  public async deleteComment(commentId: string): Promise<{ deletedId: string; taskId: string }> {
    return this.request<{ deletedId: string; taskId: string }>(`/api/v1/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  public async listNotifications(projectId?: string): Promise<NotificationDto[]> {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const res = await this.request<{ notifications: NotificationDto[] }>(`/api/v1/notifications${qs}`);
    return res.notifications;
  }

  public async markNotificationRead(notificationId: string): Promise<NotificationDto> {
    const res = await this.request<{ notification: NotificationDto }>(
      `/api/v1/notifications/${notificationId}/read`,
      { method: "PATCH" },
    );
    return res.notification;
  }
}
