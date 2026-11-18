# Feature Specification: Taskify Kanban Productivity Platform (Phase 1 MVP)

**Feature Branch**: `feat/taskify-kanban-mvp`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Develop Taskify, a team productivity platform where predefined users create projects, assign tasks, comment, and move tasks across Kanban columns (To Do, In Progress, In Review, Done). Five users (one product manager, four engineers), three sample projects, no login for this first phase."

## Clarifications

### Session 2026-11-17

- Q: When moving a task card across the Kanban board, can any team member move a task freely between any two columns, or are status changes restricted by column sequence or user role? (FR-008) → A: Unrestricted transitions & any user: Any of the 5 predefined users can move any task card to any of the 4 columns in any order (forward, backward, or skipping columns).
- Q: What permissions govern creating, editing, and deleting comments on a task card across the five predefined users? (FR-009) → A: Author can edit/delete own comments: Any of the 5 users can post comments on any task, and only the comment's author (active user matches comment author) can edit or delete their own comment.
- Q: What rules govern assigning users to a task card regarding who may change assignments, which users may be assigned, and how many assignees a task can have? (FR-007) → A: Single assignee, any of the 5 users, changed by anyone: Each task has at most 1 assignee chosen from any of the 5 predefined users (PM or Engineer), and any active user can assign, reassign, or unassign it.

### Session 2026-11-18

- Q: Which schema validation library should be used for strict input validation across boundaries? (FR-010) → A: Use Zod instead of TypeBox for all schema definitions and runtime input validation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Sample Projects and Create New Projects (Priority: P1)

Predefined team members open Taskify without a login barrier, select who they are acting as from the list of five predefined users (one Product Manager and four Engineers), browse the three pre-populated sample projects, switch between projects to view their Kanban boards, and create new projects with a validated name and optional description.

**Why this priority**: Project selection, creation, and active-user context form the foundation of the platform; without accessible projects and an active team member identity, no task or collaboration workflows can occur.

**Independent Test**: Can be fully tested by opening the application, confirming all 5 predefined users and 3 sample projects are immediately available without login, switching the active user, and creating a new project that appears in the project list with an empty Kanban board.

**Acceptance Scenarios**:

1. **Given** the application is opened for the first time, **When** the workspace loads, **Then** no login screen is shown, all 5 predefined users (1 Product Manager, 4 Engineers) are available in the active-user selector, and 3 sample projects are listed and accessible.
2. **Given** an active predefined user is selected, **When** the user selects any of the 3 sample projects, **Then** the project's details and Kanban board with its pre-populated tasks are displayed.
3. **Given** an active predefined user is selected, **When** the user submits a new project with a valid name and optional description, **Then** the new project is created, attributed to the active user, and displayed in the project list with a four-column Kanban board.
4. **Given** a user attempts to create a project with an empty or whitespace-only name, **When** the form is submitted, **Then** the system rejects the submission and displays a clear validation error message without creating the project.

---

### User Story 2 - Create, Assign, and Move Tasks Across Kanban Columns (Priority: P1)

Within any project, team members create tasks, assign or reassign tasks to any of the five predefined users (or leave them unassigned), and move tasks across the four ordered Kanban columns (`To Do`, `In Progress`, `In Review`, `Done`) to track work progress.

**Why this priority**: Task management and Kanban workflow movement represent the core productivity value of Taskify for day-to-day team execution.

**Independent Test**: Can be fully tested by opening a sample or newly created project, creating a task assigned to one of the 4 Engineers, moving the task from `To Do` through `In Progress`, `In Review`, and `Done`, reassigning it to another team member, and verifying all updates persist.

**Acceptance Scenarios**:

1. **Given** a user is viewing a project's Kanban board, **When** they submit a new task with a valid title, optional description, and optional assignee from the 5 predefined users, **Then** the task is created in the `To Do` column (or chosen initial column) and displays its title and assignee.
2. **Given** an existing task on the Kanban board, **When** any active predefined user assigns or reassigns the task to any single user among the 5 predefined users (Product Manager or Engineer) or sets it to unassigned, **Then** the task card immediately reflects the updated single assignee (or unassigned state).
3. **Given** a task in any Kanban column (`To Do`, `In Progress`, `In Review`, `Done`), **When** any of the 5 predefined users moves the task to any other column (adjacent, non-adjacent, or backward), **Then** the task immediately appears in the destination column and its updated status persists across refreshes.
4. **Given** a user submits a task without a title or with invalid status/assignee selections, **When** the action is triggered, **Then** the system rejects the request and presents a clear validation message.

---

### User Story 3 - Comment on Tasks for Team Collaboration (Priority: P2)

Team members open any task to review its chronological discussion history, post new comments attributed to the currently selected predefined user, and edit or delete only the comments they authored themselves.

**Why this priority**: Task comments enable asynchronous collaboration, clarifications, and review notes directly alongside work items, complementing core board and task management.

**Independent Test**: Can be fully tested by selecting a task on a project board, switching between two predefined users, posting a comment as each user, verifying that the active user can edit and delete their own comment, and confirming they cannot edit or delete the other user's comment.

**Acceptance Scenarios**:

1. **Given** a user opens a task detail view, **When** the task already has comments, **Then** all existing comments are displayed in chronological order showing author identity, timestamp, and comment text.
2. **Given** an active predefined user is viewing a task, **When** the user submits a non-empty comment within the allowed length, **Then** the comment is appended to the task's discussion with the active user as author and the current timestamp.
3. **Given** an active predefined user is viewing a task containing a comment they authored, **When** the user edits the comment with valid non-empty text or deletes the comment, **Then** the comment is updated or removed immediately.
4. **Given** an active predefined user is viewing a comment authored by a different predefined user, **When** viewing or interacting with that comment, **Then** edit and delete actions are unavailable and any attempt to modify or delete another user's comment is rejected.
5. **Given** a user attempts to submit or save an edited comment with empty or whitespace-only text, **When** they trigger submission, **Then** the comment is rejected and a clear validation error message is displayed.

---

### Edge Cases

- **Invalid or Oversized Inputs**: Submitting empty, whitespace-only, or excessively long project names, task titles, descriptions, or comments is rejected with clear, user-facing validation feedback and no partial or corrupted state is saved.
- **Unrecognized Status or Assignee**: Attempting to move a task to an unrecognized column status or assign it to a user outside the 5 predefined users is rejected without altering the task.
- **Unassigned Tasks**: Creating a task without selecting an assignee or clearing an existing assignee keeps the task valid in an "Unassigned" state until assigned to one of the 5 team members.
- **Active User Switching Mid-Session**: Switching the active predefined user while viewing a project board immediately updates attribution for any subsequent project creations, task creations, and comments, without altering authorship of previously created records.
- **Empty Kanban Columns**: When a project or column contains zero tasks, the column remains visible in the four-column board layout so tasks can still be created in or moved into it.
- **Unauthorized Comment Modification**: Attempting to edit or delete a comment when the active predefined user is not the comment's original author is rejected without modifying the comment.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST pre-populate exactly 5 predefined users: 1 Product Manager and 4 Engineers, each with a unique identifier, display name, and role.
- **FR-002**: System MUST operate without login or password authentication in Phase 1, providing an active-user selector that allows switching between any of the 5 predefined users at any time.
- **FR-003**: System MUST pre-populate 3 sample projects upon initial launch, containing representative tasks distributed across the Kanban columns and assigned across the predefined team members.
- **FR-004**: System MUST allow any predefined user to create a new project by providing a validated project name (required, non-empty after trimming whitespace, maximum 100 characters) and an optional description (maximum 500 characters).
- **FR-005**: System MUST display a Kanban board for every project with exactly four ordered columns: `To Do`, `In Progress`, `In Review`, and `Done`.
- **FR-006**: System MUST allow users to create tasks within a project with a validated title (required, non-empty after trimming whitespace, maximum 150 characters), an optional description (maximum 2,000 characters), a column status (defaulting to `To Do`), and an optional assignee chosen from the 5 predefined users.
- **FR-007**: System MUST allow any active predefined user to assign, reassign, or unassign any task at any time, where each task has at most one assignee (`0..1`) selected from any of the 5 predefined users (Product Manager or any of the 4 Engineers).
- **FR-008**: System MUST allow any of the 5 predefined users to move any task card freely between any of the `To Do`, `In Progress`, `In Review`, and `Done` columns in any order (forward, backward, or skipping columns), immediately persisting the updated column status.
- **FR-009**: System MUST allow any of the 5 predefined users to post validated text comments (required, non-empty after trimming whitespace, maximum 1,000 characters) on any task, recording the currently active predefined user as the author and the submission timestamp, and MUST allow only the comment's original author (when selected as the active user) to edit (with the same validation rules) or delete their own comment.
- **FR-010**: System MUST validate all user-supplied inputs (project fields, task fields, column status transitions, assignee selections, and comments) and reject invalid, malformed, or out-of-range inputs with clear, user-friendly error messages that reveal no internal system details.

### Key Entities *(include if feature involves data)*

- **User**: Represents a predefined team member with a unique identifier, full display name, and team role (`Product Manager` or `Engineer`). Exactly 5 predefined users exist in Phase 1.
- **Project**: Represents a team workspace with a unique identifier, validated name, optional description, creator reference (`User`), creation timestamp, and collection of tasks. Pre-seeded with 3 sample projects.
- **Task**: Represents a unit of work belonging to a single Project, containing a unique identifier, validated title, optional description, Kanban column status (`To Do`, `In Progress`, `In Review`, or `Done`), optional single assignee (`0..1` `User` from the 5 predefined users), creator (`User`), creation/update timestamps, and associated comments.
- **Comment**: Represents a chronological collaboration note attached to a single Task, containing a unique identifier, validated text body, author reference (`User`), and creation/update timestamps.
- **Notification**: Represents an activity event generated when projects, tasks, or comments change, containing a unique identifier, project/task references, actor/recipient references (`User`), event type, summary message, read status, and timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access all 3 sample projects and switch among all 5 predefined user profiles immediately upon opening the platform with zero login steps.
- **SC-002**: Users can create a new project or create and assign a new task in under 30 seconds on their first attempt.
- **SC-003**: Moving a task between Kanban columns updates the board state and reflects the new column placement in under 1 second, with changes preserved across page reloads.
- **SC-004**: 100% of invalid input submissions (empty/whitespace-only required fields, over-limit text lengths, unrecognized column statuses, or invalid user identifiers) are rejected with clear validation messages before data is stored.
- **SC-005**: Users can post a comment on any task and view the attributed comment in chronological order immediately upon submission.

## Assumptions

- **Phase 1 Authentication Scope**: Because Phase 1 explicitly excludes login, an active-user switcher acts as the identity mechanism for attributing project creation, task creation, and comments. Role-based access restrictions are deferred to future phases; all 5 predefined users can create projects, manage tasks, and comment equally in Phase 1.
- **Fixed Kanban Workflow**: The four columns (`To Do`, `In Progress`, `In Review`, `Done`) are fixed for all projects in Phase 1; custom or per-project column configuration is out of scope.
- **Scope of Deletions**: Projects and tasks persist across sessions (deleting projects or tasks is out of scope for Phase 1), whereas task comments may be edited or deleted exclusively by their original author.
- **Predefined Roster & Sample Data**: The 5 predefined users (1 Product Manager, 4 Engineers) and 3 sample projects are automatically seeded if not already present so the workspace is immediately usable out of the box.
