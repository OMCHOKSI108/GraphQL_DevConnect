# Architecture

## Request lifecycle (HTTP)

1. A client sends a GraphQL request (`POST /graphql`) with an optional
   `Authorization: Bearer <jwt>` header.
2. Express receives the request and hands it to Apollo Server's
   `expressMiddleware`.
3. `createContext({ req })` (`src/graphql/context.ts`) runs once per request:
   - Extracts and verifies the JWT (if present) via `verifyToken`.
   - Loads the corresponding `User` row (minimal fields) into `context.user` as an
     `AuthUser`, or `null` if there's no valid token.
   - Calls `createLoaders(prisma)` to build a **fresh** set of DataLoader instances
     for this request only — loaders are never shared across requests, since their
     in-memory cache must not leak between users.
4. Apollo Server validates the query against the schema, then executes it against
   the merged `resolvers` object.
5. Each resolver is a **thin binding** — it extracts arguments and calls into the
   matching domain's `service.ts` function. Resolvers never talk to Prisma directly
   or contain business rules.
6. Each service function:
   - Calls `requireAuth(context)` if the operation needs an authenticated user.
   - Runs any authorization checks (`canCreateIssue`, `canCloseIssue`, etc.) before
     mutating data.
   - Delegates the actual Prisma query to a `repository.ts` function.
   - For mutations that other clients care about in real time, publishes an event
     to the shared `pubsub` singleton after a successful write.
7. `formatError` (configured on `ApolloServer`) ensures every error reaching the
   client carries a structured `extensions.code` and `extensions.http.status`,
   without leaking internal stack traces.

## Request lifecycle (WebSocket / subscriptions)

1. A client opens a WebSocket connection to `ws://.../graphql` and sends a
   `ConnectionInit` message with `connectionParams: { authorization: "Bearer <jwt>" }`.
2. `graphql-ws`'s `useServer` calls `createWsContext` (`src/graphql/context.ts`),
   which resolves the same `AuthUser`/loaders shape as the HTTP path, just reading
   the token from `connectionParams` instead of an HTTP header.
3. When the client sends a `subscribe` message for e.g. `issueStatusChanged`, the
   matching `Subscription.issueStatusChanged.subscribe` resolver runs once, returning
   an `AsyncIterableIterator` backed by the in-memory PubSub's topic for that
   project.
4. Later, when any client successfully calls `updateIssueStatus`, the service layer
   publishes to that same topic. `graphql-ws` then pushes the new value down every
   open WebSocket subscribed to it.

## Service / repository separation

Each domain under `src/modules/<domain>/` follows the same three-file shape:

- **`<domain>.repository.ts`** — raw Prisma calls only. No authorization, no
  business logic. Functions take a `PrismaClient` (or the request's
  `context.prisma`) plus plain arguments, and return Prisma results directly.
- **`<domain>.service.ts`** — business rules and authorization. Calls
  `requireAuth`/permission-check functions, validates inputs, and orchestrates one
  or more repository calls. This is where `pubsub.publish` calls live.
- **`<domain>.resolver.ts`** — the GraphQL binding layer. Maps `(parent, args,
  context)` to a service function call. Field resolvers (e.g. `Issue.createdBy`)
  also live here, reading from `context.loaders` instead of calling Prisma
  directly.

`src/graphql/resolvers.ts` is a pure aggregator: it imports each domain's resolver
object and merges their `Query`/`Mutation`/`Subscription`/type-field maps with a
plain object spread — no logic of its own.

## DataLoader usage

Nested GraphQL fields (`Project.owner`, `Issue.createdBy`, `Issue.assignedTo`,
`Comment.author`, `Project.members`, `Project.issues`, `User.projects`,
`User.assignedIssues`) are exactly the shape that causes the N+1 problem: resolving
10 projects' owners naively means 10 separate `findUnique` calls.

`src/loaders/index.ts` exports `createLoaders(prisma)`, which builds one
`DataLoader` per access pattern (e.g. `userById`, `issuesByProjectId`,
`projectMembersByProjectId`). Each loader's batch function receives all keys
requested within the same event-loop tick and issues a **single** `findMany({
where: { id: { in: [...] } } })` query, then maps results back to the original key
order. Field resolvers call `context.loaders.<name>.load(id)` instead of querying
Prisma directly.

One loader, `membershipByProjectAndUser`, exists purely to support authorization —
it lets `canCreateIssue`, `canCloseIssue`, `canAssignIssue`, and
`canAddProjectMember` look up "is this user a member of this project, and with what
role?" without a fresh query each time the same pair is checked twice in one
request.

`Issue.comments` is the one nested list that's also paginated (`first`/`after`
args), so it intentionally bypasses DataLoader and calls `paginate()` directly —
DataLoader batch functions only take keys, not per-call pagination arguments, so
the two patterns don't compose for this field.

## Subscription flow

- `src/graphql/pubsub.ts` exports a single in-memory `PubSub` instance
  (`graphql-subscriptions`) and a `TOPICS` helper that builds per-resource topic
  strings, e.g. `ISSUE_STATUS_CHANGED:<projectId>`.
- Topics are **scoped to the specific resource**, not broadcast — a client
  subscribed to `issueStatusChanged(projectId: "A")` never receives events for
  project `"B"`.
- `issueAssigned` additionally enforces a privacy check at subscribe time: a user
  can only subscribe to their own `userId`'s topic unless they're a global `ADMIN`.
- The in-memory PubSub is process-local. If this API is ever horizontally scaled
  to multiple Node processes, a shared backend (e.g.
  `graphql-redis-subscriptions`) would be required so publishes from one process
  reach subscribers connected to another.
