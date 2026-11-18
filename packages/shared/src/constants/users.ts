/**
 * Canonical Phase 1 team roster, sample project metadata, Kanban statuses, and notification event types.
 *
 * Security Assumption: User IDs are fixed deterministic UUIDv4 identifiers for Phase 1
 * (no login). State-changing endpoints MUST still verify that `X-Active-User-Id` and
 * `assigneeId` values match an ID in {@link PREDEFINED_USER_IDS}.
 */

/** Allowed team member roles in Phase 1. */
export type UserRole = "Product Manager" | "Engineer";

/** UUID v4 validation regex (case-insensitive). */
export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Predefined user definition. */
export interface PredefinedUser {
  readonly id: string;
  readonly name: string;
  readonly role: UserRole;
  readonly avatarUrl: string | null;
}

/**
 * Five predefined Phase 1 team members: 1 Product Manager and 4 Engineers (`FR-001`).
 */
export const PREDEFINED_USERS: readonly PredefinedUser[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    name: "Alex Morgan",
    role: "Product Manager",
    avatarUrl: null,
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    name: "Sam Rivera",
    role: "Engineer",
    avatarUrl: null,
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    name: "Jordan Lee",
    role: "Engineer",
    avatarUrl: null,
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    name: "Taylor Kim",
    role: "Engineer",
    avatarUrl: null,
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    name: "Casey Patel",
    role: "Engineer",
    avatarUrl: null,
  },
] as const;

/** Set of allowed predefined user UUIDs for O(1) validation at gateway and service boundaries. */
export const PREDEFINED_USER_IDS = new Set<string>(PREDEFINED_USERS.map((user) => user.id));

/** Map of predefined user IDs to user metadata. */
export const PREDEFINED_USER_MAP = new Map<string, PredefinedUser>(
  PREDEFINED_USERS.map((user) => [user.id, user]),
);

/** Default active user when no selection has been stored yet (Product Manager). */
export const DEFAULT_ACTIVE_USER_ID = PREDEFINED_USERS[0].id;

/**
 * Three pre-populated sample projects (`FR-003`).
 */
export const SAMPLE_PROJECTS = [
  {
    id: "22222222-2222-4222-8222-222222222201",
    name: "Platform Security Audit",
    description: "Hardening input schemas, boundary checks, and zero-trust controls across Taskify.",
    createdById: "11111111-1111-4111-8111-111111111101",
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    name: "Mobile App Redesign",
    description: "Streamlined Kanban board layout and touch-friendly task cards.",
    createdById: "11111111-1111-4111-8111-111111111101",
  },
  {
    id: "22222222-2222-4222-8222-222222222203",
    name: "Q4 Analytics Pipeline",
    description: "Real-time activity ingestion and metrics aggregation across services.",
    createdById: "11111111-1111-4111-8111-111111111102",
  },
] as const;

/** Ordered Kanban columns fixed for Phase 1 (`FR-005`). */
export const KANBAN_STATUSES = ["To Do", "In Progress", "In Review", "Done"] as const;

/** Kanban column status union type. */
export type KanbanStatus = (typeof KANBAN_STATUSES)[number];

/** Domain notification event types emitted to `notifications-service` and SSE streams. */
export const NOTIFICATION_TYPES = [
  "PROJECT_CREATED",
  "TASK_CREATED",
  "TASK_STATUS_CHANGED",
  "TASK_ASSIGNED",
  "COMMENT_CREATED",
  "COMMENT_UPDATED",
  "COMMENT_DELETED",
] as const;

/** Notification event type union. */
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
