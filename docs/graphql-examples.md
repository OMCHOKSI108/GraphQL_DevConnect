# GraphQL Examples

All requests go to `http://localhost:4000/graphql` (HTTP) or
`ws://localhost:4000/graphql` (subscriptions). For any operation that requires
authentication, set this header (HTTP) or connection param (WebSocket):

```
Authorization: Bearer <token>
```

```json
// WebSocket connectionParams
{ "authorization": "Bearer <token>" }
```

## Auth

### Register

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    token
    user { id name email role }
  }
}
```

```json
{
  "input": { "name": "Alice", "email": "alice@example.com", "password": "password123", "skills": ["GraphQL"] }
}
```

### Login

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    token
    user { id name role }
  }
}
```

```json
{ "input": { "email": "alice@example.com", "password": "password123" } }
```

### Me

```graphql
query Me {
  me { id name email role skills }
}
```

## Projects

### Create a project

```graphql
mutation CreateProject($input: CreateProjectInput!) {
  createProject(input: $input) {
    id
    title
    owner { id name }
    members { role user { name } }
  }
}
```

```json
{
  "input": { "title": "DevConnectQL", "description": "Collaboration API", "techStack": ["GraphQL", "Prisma"], "ownerId": "<your-user-id>" }
}
```

> `ownerId` is required by the schema but ignored by the resolver — the owner is
> always whoever's token is on the request.

### Add a project member

```graphql
mutation AddProjectMember($projectId: ID!, $userId: ID!, $role: ProjectRole) {
  addProjectMember(projectId: $projectId, userId: $userId, role: $role) {
    role
    user { name }
  }
}
```

```json
{ "projectId": "<project-id>", "userId": "<user-id>", "role": "MEMBER" }
```

Requires: caller is the project `OWNER` or a global `ADMIN`.

### Delete a project

```graphql
mutation DeleteProject($id: ID!) {
  deleteProject(id: $id)
}
```

Requires: caller is the project `OWNER` or a global `ADMIN`.

### Paginated, filtered, sorted projects

```graphql
query Projects($first: Int, $after: String, $filter: ProjectFilterInput, $sort: ProjectSort) {
  projects(first: $first, after: $after, filter: $filter, sort: $sort) {
    edges { cursor node { id title techStack createdAt } }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
```

```json
{
  "first": 10,
  "filter": { "techStack": "GraphQL" },
  "sort": { "field": "CREATED_AT", "direction": "DESC" }
}
```

## Issues

### Create an issue

```graphql
mutation CreateIssue($input: CreateIssueInput!) {
  createIssue(input: $input) {
    id
    title
    status
    priority
  }
}
```

```json
{ "input": { "projectId": "<project-id>", "title": "Fix login bug", "description": "..." } }
```

Requires: caller is a member of the project (any `ProjectRole`), or a global
`ADMIN`.

### Assign an issue

```graphql
mutation AssignIssue($issueId: ID!, $userId: ID!) {
  assignIssue(issueId: $issueId, userId: $userId) {
    id
    assignedTo { id name }
  }
}
```

```json
{ "issueId": "<issue-id>", "userId": "<project-member-user-id>" }
```

Requires: caller is the project `OWNER`/`MAINTAINER` or a global `ADMIN`; the
assignee must already be a project member.

### Update issue status

```graphql
mutation UpdateIssueStatus($issueId: ID!, $status: IssueStatus!) {
  updateIssueStatus(issueId: $issueId, status: $status) {
    id
    status
  }
}
```

```json
{ "issueId": "<issue-id>", "status": "IN_PROGRESS" }
```

Requires: caller is the assignee (or global `ADMIN`) for any non-`CLOSED`
transition; closing requires the issue's creator, a project `MAINTAINER`/`OWNER`,
or a global `ADMIN`.

### Filtered and sorted issues

```graphql
query Issues($filter: IssueFilterInput, $sort: IssueSort) {
  issues(filter: $filter, sort: $sort) {
    edges { node { id title status priority assignedTo { name } } }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
```

```json
{
  "filter": { "assignedToMe": true },
  "sort": { "field": "PRIORITY", "direction": "DESC" }
}
```

## Comments

### Add a comment

```graphql
mutation AddComment($issueId: ID!, $message: String!) {
  addComment(issueId: $issueId, message: $message) {
    id
    message
    author { name }
  }
}
```

### Paginated comments on an issue

```graphql
query IssueComments($id: ID!, $first: Int, $after: String) {
  issue(id: $id) {
    comments(first: $first, after: $after) {
      edges { node { id message author { name } } }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
}
```

## Subscriptions

```graphql
subscription IssueStatusChanged($projectId: ID!) {
  issueStatusChanged(projectId: $projectId) {
    id
    status
    title
  }
}

subscription CommentAdded($issueId: ID!) {
  commentAdded(issueId: $issueId) {
    id
    message
    author { name }
  }
}

subscription IssueAssigned($userId: ID!) {
  issueAssigned(userId: $userId) {
    id
    title
    assignedTo { name }
  }
}
```

`issueAssigned` requires `$userId` to match the authenticated caller's own id
(unless the caller is a global `ADMIN`) — subscribing to another user's assignment
notifications returns a `FORBIDDEN` error.
