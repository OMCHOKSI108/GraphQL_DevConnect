# Database Schema

Source of truth: `server/prisma/schema.prisma`. PostgreSQL, accessed through
Prisma's driver-adapter client (`@prisma/adapter-pg` + `pg`) — no native query
engine binary is generated or required.

## Enums

| Enum            | Values                                  | Used by              |
| ----------------- | ------------------------------------------ | ----------------------- |
| `Role`             | `DEVELOPER`, `MAINTAINER`, `ADMIN`        | `User.role` (global)   |
| `IssueStatus`       | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` | `Issue.status`        |
| `IssuePriority`     | `LOW`, `MEDIUM`, `HIGH`, `URGENT`          | `Issue.priority`       |
| `ProjectRole`       | `OWNER`, `MAINTAINER`, `MEMBER`            | `ProjectMember.role`   |

## Models

### `User`

| Field           | Type        | Notes                                  |
| ----------------- | ------------- | ----------------------------------------- |
| `id`               | `String` (uuid) | primary key                            |
| `name`             | `String`      |                                          |
| `email`            | `String`      | `@unique`                                |
| `passwordHash`     | `String`      | bcrypt hash, default `""` (pre-migration safety) |
| `role`             | `Role`        | default `DEVELOPER`                      |
| `skills`           | `String[]`    |                                          |
| `ownedProjects`     | `Project[]`   | inverse of `Project.owner`               |
| `projectMembers`    | `ProjectMember[]` | inverse of `ProjectMember.user`     |
| `createdIssues`     | `Issue[]`     | inverse of `Issue.createdBy`             |
| `assignedIssues`    | `Issue[]`     | inverse of `Issue.assignedTo`            |
| `comments`          | `Comment[]`   | inverse of `Comment.author`              |

### `Project`

| Field           | Type        | Notes                                  |
| ----------------- | ------------- | ----------------------------------------- |
| `id`               | `String` (uuid) | primary key                            |
| `title`            | `String`      |                                          |
| `description`      | `String`      |                                          |
| `techStack`        | `String[]`    |                                          |
| `ownerId` / `owner` | `String` / `User` | `onDelete: Cascade` — deleting the owner deletes the project |
| `members`           | `ProjectMember[]` | explicit join model, see below       |
| `issues`            | `Issue[]`     |                                          |
| `@@index([createdAt, id])` |       | supports cursor pagination's `ORDER BY` |

### `ProjectMember`

The explicit join table between `Project` and `User`, carrying a project-scoped
role. This replaced an earlier implicit many-to-many `members: User[]` field —
the implicit version couldn't carry a `role`, which is required for project-level
RBAC (distinguishing a project's `OWNER`/`MAINTAINER` from a plain `MEMBER`).

| Field           | Type          | Notes                                  |
| ----------------- | --------------- | ----------------------------------------- |
| `id`               | `String` (uuid)  | primary key                            |
| `projectId` / `project` | `String` / `Project` | `onDelete: Cascade`               |
| `userId` / `user`   | `String` / `User`    | `onDelete: Cascade`               |
| `role`              | `ProjectRole`        | default `MEMBER`                  |
| `createdAt`          | `DateTime`           |                                  |
| `@@unique([projectId, userId])` |       | one membership row per user per project |
| `@@index([userId])`  |                       | supports "which projects is this user in" lookups |

### `Issue`

| Field           | Type            | Notes                                  |
| ----------------- | ----------------- | ----------------------------------------- |
| `id`               | `String` (uuid)    | primary key                            |
| `title` / `description` | `String`     |                                          |
| `status`            | `IssueStatus`       | default `OPEN`                         |
| `priority`           | `IssuePriority`     | default `MEDIUM`                       |
| `projectId` / `project` | `String` / `Project` | `onDelete: Cascade`                |
| `createdById` / `createdBy` | `String` / `User` | `onDelete: Cascade`             |
| `assignedToId` / `assignedTo` | `String?` / `User?` | optional; default `SetNull` on delete |
| `comments`           | `Comment[]`         |                                          |
| `@@index([projectId, createdAt, id])` |  | supports `Project.issues` + cursor pagination |
| `@@index([status])`, `@@index([assignedToId])`, `@@index([createdById])` | | support filtering |

### `Comment`

| Field           | Type        | Notes                                  |
| ----------------- | ------------- | ----------------------------------------- |
| `id`               | `String` (uuid) | primary key                            |
| `message`          | `String`      |                                          |
| `issueId` / `issue` | `String` / `Issue` | `onDelete: Cascade`                  |
| `authorId` / `author` | `String` / `User` | `onDelete: Cascade`                |
| `@@index([issueId, createdAt, id])` |  | supports paginated `Issue.comments`     |

## Pagination-related design

Cursor pagination (see `src/utils/pagination.ts`) encodes a cursor as
base64-JSON of `{ id, createdAt }`. Queries sort by `ORDER BY createdAt <dir>, id
<dir>` (a compound `orderBy` with `id` as a tiebreaker, since `createdAt` alone
isn't unique), and use Prisma's `cursor: { id }, skip: 1` pattern relative to that
ordering. Every model that's paginated (`Project`, `Issue`, `Comment`) has a
compound index covering `(parentId,) createdAt, id` so these queries hit an index
rather than a sequential scan.

`first + 1` rows are fetched per page so `hasNextPage` can be computed without a
second `COUNT` query — the extra row is sliced off before mapping to edges.
`totalCount` is a separate `count({ where })` run in parallel via `Promise.all`.

## Cascade behavior summary

Deleting a `User` cascades to: their owned `Project`s, their `ProjectMember`
rows, `Issue`s they created, and `Comment`s they authored. `Issue.assignedTo` is
the one optional relation without an explicit `onDelete`, so Prisma's default for
optional relations (`SetNull`) applies — deleting an assigned user just clears
`assignedToId` rather than deleting the issue.
