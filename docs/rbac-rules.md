# RBAC Rules

DevConnectQL has **two independent role systems**. Confusing them is the most
common mistake when reasoning about authorization here.

## Global role (`User.role`)

`DEVELOPER` | `MAINTAINER` | `ADMIN` — set once per user, applies everywhere.

- `ADMIN` is a **site-wide superuser override**. Every permission function in the
  codebase checks `user.role === "ADMIN"` first and short-circuits to "allowed" if
  true — an admin can act on any project or issue regardless of project
  membership.
- Global `MAINTAINER` is **not** the same as a project's `MAINTAINER`. A user with
  global role `MAINTAINER` who isn't a member of a given project has no special
  power on that project's issues.
- `DEVELOPER` is the default role for everyone who registers.

## Project role (`ProjectMember.role`)

`OWNER` | `MAINTAINER` | `MEMBER` — scoped to one specific project, stored as a row
in the `ProjectMember` join table.

- A project's creator is automatically inserted as an `OWNER`-role `ProjectMember`
  at creation time.
- `addProjectMember` lets the owner (or an admin) add other users with any of the
  three roles.
- A user with no `ProjectMember` row for a given project is an **outsider** to it,
  even if they're a member of other projects.

## Permission functions and where they live

| Function                     | File                                              | Rule |
| ------------------------------ | ---------------------------------------------------- | ------ |
| `canDeleteProject`              | `src/modules/projects/projects.service.ts`           | `ADMIN` or the project's `ownerId === user.id` |
| `canAddProjectMember`           | `src/modules/projects/projects.service.ts`           | `ADMIN`, the project owner, or a `ProjectMember` with role `OWNER` |
| `canViewAllUsers`                | `src/modules/users/users.service.ts`                 | `ADMIN` only |
| `canCreateIssue`                 | `src/modules/issues/issues.service.ts`               | `ADMIN` or any `ProjectMember` role (`OWNER`/`MAINTAINER`/`MEMBER`) |
| `canUpdateIssueProgress`         | `src/modules/issues/issues.service.ts`               | `ADMIN` or `issue.assignedToId === user.id` |
| `canCloseIssue`                  | `src/modules/issues/issues.service.ts`               | `ADMIN`, the issue's creator, or a `ProjectMember` with role `MAINTAINER`/`OWNER` |
| `canAssignIssue`                 | `src/modules/issues/issues.service.ts`               | `ADMIN` or a `ProjectMember` with role `OWNER`/`MAINTAINER` |

## Allowed / denied table

| Action                                         | ADMIN | Project OWNER | Project MAINTAINER | Project MEMBER | Outsider |
| ------------------------------------------------- | :---: | :------------: | :------------------: | :--------------: | :--------: |
| Query `projects` / `issues` (public lists)         | ✅    | ✅              | ✅                    | ✅                | ✅          |
| Query `users` (full list)                          | ✅    | ❌              | ❌                    | ❌                | ❌          |
| `createIssue` in the project                        | ✅    | ✅              | ✅                    | ✅                | ❌          |
| `updateIssueStatus` (non-`CLOSED`), as the assignee | ✅    | ✅              | ✅                    | ✅                | ❌          |
| `updateIssueStatus` (non-`CLOSED`), not the assignee | ✅   | ❌              | ❌                    | ❌                | ❌          |
| `updateIssueStatus(status: CLOSED)`, as creator      | ✅    | ✅              | ✅                    | ✅ (if creator)   | ❌          |
| `updateIssueStatus(status: CLOSED)`, not creator      | ✅   | ✅              | ✅                    | ❌                | ❌          |
| `assignIssue`                                       | ✅    | ✅              | ✅                    | ❌                | ❌          |
| `assignIssue` to a user **outside** the project      | ❌ (`VALIDATION_ERROR`) | ❌ (`VALIDATION_ERROR`) | ❌ (`VALIDATION_ERROR`) | ❌ | ❌ |
| `addProjectMember`                                  | ✅    | ✅              | ❌                    | ❌                | ❌          |
| `deleteProject`                                     | ✅    | ✅              | ❌                    | ❌                | ❌          |
| `addComment` on any issue                            | ✅    | ✅              | ✅                    | ✅                | ✅ (no membership gate today — see note below) |

> **Note on comments:** unlike issues, `addComment` currently only requires
> authentication — it does not check project membership. Any logged-in user can
> comment on any issue. This is a deliberate, documented scope decision (not an
> oversight) — tightening it to require project membership would be a
> straightforward follow-up using the same `membershipByProjectAndUser` loader
> already used elsewhere.

## Subscription-level authorization

- `issueStatusChanged(projectId)` and `commentAdded(issueId)` have no extra
  authorization beyond knowing the resource id — they're scoped by topic, not by
  membership.
- `issueAssigned(userId)` enforces that the subscribing user's id matches `userId`,
  unless they're a global `ADMIN` — otherwise the subscribe call throws
  `FORBIDDEN`. This prevents one user from snooping on another user's assignment
  notifications.
