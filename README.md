# DevConnectQL

<p align="center">
  <b>Production-Style GraphQL Collaboration API</b>
</p>

<p align="center">
  A developer collaboration and project-management backend inspired by GitHub + Jira, built to demonstrate advanced GraphQL backend engineering with authentication, authorization, pagination, DataLoader optimization, subscriptions, tests, Docker, and CI.
</p>

<p align="center">
  <a href="https://github.com/OMCHOKSI108/GraphQL_DevConnect/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/OMCHOKSI108/GraphQL_DevConnect/ci.yml?branch=master&label=CI&logo=github&style=for-the-badge" alt="CI Status" />
  </a>
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/GraphQL-API-E10098?style=for-the-badge&logo=graphql&logoColor=white" alt="GraphQL" />
  <img src="https://img.shields.io/badge/Apollo_Server-GraphQL-311C87?style=for-the-badge&logo=apollographql&logoColor=white" alt="Apollo Server" />
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Vitest-Tested-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
</p>

---

## Overview

**DevConnectQL** is a production-style GraphQL backend for developer teams to manage projects, members, issues, assignments, comments, and real-time collaboration events.

It is not a basic CRUD API. The project is designed to demonstrate real backend engineering concepts such as:

* GraphQL schema design
* Modular resolver/service/repository architecture
* JWT authentication
* Project-level authorization
* Cursor pagination
* Filtering and sorting
* DataLoader-based N+1 optimization
* GraphQL subscriptions
* Structured error handling
* Docker-based local setup
* Automated tests
* GitHub Actions CI

---

## Why GraphQL?

This project is a strong GraphQL use case because the data is deeply relational.

A frontend screen may need:

* Project details
* Project members
* Member roles
* Issues
* Assignees
* Comments
* Comment authors
* Real-time issue updates

With REST, this often requires many endpoints and multiple round trips. With GraphQL, the client can request exactly the data shape it needs in one query.

```graphql
query ProjectOverview($projectId: ID!) {
  project(id: $projectId) {
    id
    title
    techStack
    members {
      role
      user {
        id
        name
      }
    }
    issues(first: 10) {
      edges {
        node {
          id
          title
          status
          priority
          assignedTo {
            name
          }
          comments(first: 3) {
            edges {
              node {
                message
                author {
                  name
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## Core Features

### Authentication

* Register
* Login
* JWT token generation
* JWT verification through GraphQL context
* Password hashing using bcrypt

### Project Management

* Create projects
* Add project members
* Project-level roles
* Delete project with permission checks
* Paginated project listing
* Filtering and sorting

### Issue Management

* Create issues
* Assign issues
* Update issue status
* Issue priority
* Filter by status, assignment, creator, project
* Sort by date, priority, and status

### Comments

* Add comments to issues
* Paginated comments
* Comment author resolution
* Real-time comment subscription

### Advanced GraphQL

* Queries
* Mutations
* Subscriptions
* Relay-style cursor pagination
* Input filters
* Sorting inputs
* Nested relation resolution
* Request-scoped DataLoader batching

### Production Engineering

* Structured errors
* RBAC
* Modular architecture
* Docker support
* Automated tests
* GitHub Actions CI
* Environment-based configuration

---

## Technology Stack

| Category          | Technology                 |
| ----------------- | --------------------------- |
| Language          | TypeScript                 |
| Runtime           | Node.js                    |
| HTTP Server       | Express                    |
| GraphQL Server    | Apollo Server              |
| GraphQL Transport | HTTP + WebSocket           |
| Real-time         | `graphql-ws`, `ws`, PubSub  |
| Database          | PostgreSQL                 |
| ORM               | Prisma                     |
| Authentication    | JWT, bcrypt                |
| Performance       | DataLoader                 |
| Testing           | Vitest                     |
| Containerization  | Docker, Docker Compose     |
| CI/CD             | GitHub Actions             |

---

## Architecture

```mermaid
flowchart TD
    Client[Client / GraphQL Sandbox / Frontend]
    
    Client -->|HTTP Queries & Mutations| Apollo[Apollo Server]
    Client -->|WebSocket Subscriptions| WS[graphql-ws Server]

    Apollo --> Context[GraphQL Context]
    WS --> Context

    Context --> Auth[JWT Auth]
    Context --> Loaders[Request-Scoped DataLoaders]

    Apollo --> Resolvers[Resolvers]
    Resolvers --> Services[Services]
    Services --> Repositories[Repositories]
    Repositories --> Prisma[Prisma Client]
    Prisma --> DB[(PostgreSQL)]

    Services --> PubSub[In-Memory PubSub]
    PubSub --> WS

    Loaders --> Prisma
```

### Request Lifecycle

```txt
Client Request
   ↓
Apollo Server / graphql-ws
   ↓
GraphQL Context
   ↓
JWT Authentication
   ↓
Request-scoped DataLoaders
   ↓
Resolver
   ↓
Service Layer
   ↓
RBAC + Business Rules
   ↓
Repository Layer
   ↓
Prisma
   ↓
PostgreSQL
```

---

## Database Design

The schema is defined in:

```txt
server/prisma/schema.prisma
```

### Main Models

| Model           | Purpose                                                          |
| --------------- | ------------------------------------------------------------------ |
| `User`          | Account, global role, skills, authentication data                |
| `Project`       | Developer project or workspace                                   |
| `ProjectMember` | Join table between users and projects with project-specific role |
| `Issue`         | Project issue/task with status, priority, creator, assignee      |
| `Comment`       | Discussion message attached to an issue                          |

### Role Systems

DevConnectQL uses two role systems.

#### Global User Role

```txt
DEVELOPER
MAINTAINER
ADMIN
```

#### Project Role

```txt
OWNER
MAINTAINER
MEMBER
```

This separation is important because a user can be a normal global `DEVELOPER`, but still be the `OWNER` of one specific project.

---

## RBAC Rules

| Action                         | Admin | Project Owner | Project Maintainer | Project Member | Outsider |
| ------------------------------- | :---: | :------------: | :------------------: | :--------------: | :--------: |
| View public projects           |  Yes  |      Yes      |         Yes        |       Yes      |    Yes   |
| Create project                 |  Yes  |      Yes      |         Yes        |       Yes      |    Yes   |
| Add project member             |  Yes  |      Yes      |         No         |       No       |    No    |
| Delete project                 |  Yes  |      Yes      |         No         |       No       |    No    |
| Create issue in project        |  Yes  |      Yes      |         Yes        |       Yes      |    No    |
| Assign issue                   |  Yes  |      Yes      |         Yes        |       No       |    No    |
| Update assigned issue progress |  Yes  |  If assigned  |     If assigned    |   If assigned  |    No    |
| Close issue                    |  Yes  |      Yes      |         Yes        |   If creator   |    No    |
| Add comment                    |  Yes  |      Yes      |         Yes        |       Yes      |    Yes   |
| View all users                 |  Yes  |       No      |         No         |       No       |    No    |

> `Add comment` has no project-membership gate today — any authenticated user
> can comment on any issue. This is a deliberate, documented scope decision
> (see [`docs/rbac-rules.md`](docs/rbac-rules.md)), not an oversight.

---

## DataLoader Optimization

GraphQL nested queries can easily create the N+1 problem.

Example:

```txt
Fetch 20 issues
For each issue, fetch createdBy user
For each issue, fetch assignedTo user
For each issue, fetch project
```

Without optimization, this can generate many repeated database queries.

DevConnectQL uses request-scoped DataLoaders to batch and cache nested lookups within a single GraphQL request.

```txt
Without DataLoader:
20 issues → 20 user queries + 20 project queries

With DataLoader:
20 issues → 1 batched user query + 1 batched project query
```

This makes the API more scalable and shows production-level GraphQL performance understanding.

---

## Screenshots


### Authenticated session with saved operations

Multiple saved operation tabs (Login, CreateProject, Projects, Issues,
Comments) with a `Bearer` token set under Headers, used to drive the
authenticated parts of the API end to end.

![Apollo Sandbox with multiple saved operations](docs/apollo_test.png)

### createProject mutation

A full `createProject` call — variables in (`title`, `description`,
`techStack`, `ownerId`), the created project's `id`, `title`, `description`,
and resolved `owner` out.

![createProject mutation response](docs/createproject_apollo_server.png)

### Prisma Studio — browsing seeded data

Prisma Studio open on the `User` table, showing seeded rows
(`maintainer@example.com`, `om@example.com`) with their roles and skills,
queried directly against PostgreSQL.

![Prisma Studio User table](docs/prismastudio.png)

### Schema visualizer

Prisma's schema visualizer rendering the `User` / `Project` /
`ProjectMember` / `Issue` / `Comment` relationships exactly as declared in
`schema.prisma`.

![Prisma schema visualizer](docs/prisma_visulize.png)

---

## GraphQL Examples

### Register

```graphql
mutation Register {
  register(
    input: {
      name: "Om Choksi"
      email: "om@example.com"
      password: "password123"
      skills: ["GraphQL", "Node.js", "TypeScript"]
    }
  ) {
    token
    user {
      id
      name
      email
      role
    }
  }
}
```

### Login

```graphql
mutation Login {
  login(
    input: {
      email: "om@example.com"
      password: "password123"
    }
  ) {
    token
    user {
      id
      name
      role
    }
  }
}
```

Use the token in headers:

```json
{
  "Authorization": "Bearer YOUR_TOKEN_HERE"
}
```

### Me Query

```graphql
query Me {
  me {
    id
    name
    email
    role
    skills
  }
}
```

### Create Project

```graphql
mutation CreateProject {
  createProject(
    input: {
      title: "DevConnectQL"
      description: "Production-style GraphQL collaboration API"
      techStack: ["GraphQL", "Apollo Server", "PostgreSQL", "Prisma"]
      ownerId: "YOUR_USER_ID"
    }
  ) {
    id
    title
    owner {
      name
    }
  }
}
```

> `ownerId` is required by the schema but ignored by the resolver — the
> project owner is always whoever's token is on the request.

### Create Issue

```graphql
mutation CreateIssue {
  createIssue(
    input: {
      projectId: "PROJECT_ID"
      title: "Add subscription support"
      description: "Add real-time issue status updates"
    }
  ) {
    id
    title
    status
    priority
  }
}
```

`priority` defaults to `MEDIUM` and can't be set at creation today — it's
changed later, the same way `status` is, if that's added as a follow-up.

### Assign Issue

```graphql
mutation AssignIssue {
  assignIssue(issueId: "ISSUE_ID", userId: "USER_ID") {
    id
    title
    assignedTo {
      id
      name
    }
  }
}
```

### Update Issue Status

```graphql
mutation UpdateIssueStatus {
  updateIssueStatus(issueId: "ISSUE_ID", status: IN_PROGRESS) {
    id
    title
    status
  }
}
```

### Add Comment

```graphql
mutation AddComment {
  addComment(issueId: "ISSUE_ID", message: "I will work on this.") {
    id
    message
    author {
      name
    }
  }
}
```

### Paginated Projects

```graphql
query PaginatedProjects {
  projects(first: 10, after: null) {
    edges {
      cursor
      node {
        id
        title
        techStack
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

### Filtered Issues

```graphql
query FilteredIssues {
  issues(
    filter: {
      status: OPEN
      assignedToMe: true
    }
    sort: {
      field: PRIORITY
      direction: DESC
    }
  ) {
    edges {
      node {
        id
        title
        status
        priority
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

### Subscription

```graphql
subscription IssueStatusChanged {
  issueStatusChanged(projectId: "PROJECT_ID") {
    id
    title
    status
  }
}
```

---

## Local Setup

### 1. Clone Repository

```bash
git clone https://github.com/OMCHOKSI108/GraphQL_DevConnect.git
cd GraphQL_DevConnect/server
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Update `.env`:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://devconnectql_user:devconnectql_pass@localhost:5432/devconnectql_db?schema=public"
JWT_SECRET="replace_this_with_a_secure_secret"
CORS_ORIGIN="http://localhost:3000"
```

### 4. Start PostgreSQL

From project root:

```bash
docker compose up -d postgres
```

### 5. Run Prisma Migration

```bash
cd server
npx prisma migrate dev
npx prisma generate
```

### 6. Seed Database

```bash
npm run db:seed
```

### 7. Start Development Server

```bash
npm run dev
```

Open:

```txt
http://localhost:4000/graphql
```

---

## Docker Setup

Run the complete API stack using Docker:

```bash
docker compose up --build
```

Available URLs:

| URL                             | Purpose               |
| -------------------------------- | ----------------------- |
| `http://localhost:4000`         | API welcome route     |
| `http://localhost:4000/health`  | Health check          |
| `http://localhost:4000/graphql` | GraphQL endpoint      |
| `ws://localhost:4000/graphql`   | GraphQL subscriptions |

### Deploying to Render

The repo root includes `render.yaml` — a [Render Blueprint](https://render.com/docs/blueprint-spec)
that provisions the API (built from `server/Dockerfile`) and a managed
PostgreSQL database together. Push to GitHub, then in Render: **New →
Blueprint**, pick the repo, and click **Apply**. `JWT_SECRET` is generated
automatically and `DATABASE_URL` is wired to the new database. See
[`docs/deployment.md`](docs/deployment.md) for the full walkthrough.

---

## Testing

```bash
cd server
npm test
```

Watch mode:

```bash
npm run test:watch
```

Coverage:

```bash
npm run test:coverage
```

Build check:

```bash
npm run build
```

---

## Available Scripts

| Script                  | Purpose                             |
| ------------------------ | -------------------------------------- |
| `npm run dev`           | Start development server            |
| `npm run build`         | Compile TypeScript                  |
| `npm start`             | Run compiled production build       |
| `npm test`              | Run test suite                      |
| `npm run test:watch`    | Run tests in watch mode             |
| `npm run test:coverage` | Generate test coverage              |
| `npm run db:generate`   | Generate Prisma Client              |
| `npm run db:migrate`    | Run Prisma migration in development |
| `npm run db:deploy`     | Apply migrations in production      |
| `npm run db:seed`       | Seed database                       |
| `npm run db:studio`     | Open Prisma Studio                  |
| `npm run db:reset`      | Reset database and reseed           |

---

## Environment Variables

| Variable       | Example                 | Description                  |
| --------------- | ------------------------- | -------------------------------- |
| `PORT`         | `4000`                  | API server port              |
| `NODE_ENV`     | `development`           | Runtime environment          |
| `DATABASE_URL` | `postgresql://...`      | PostgreSQL connection string |
| `JWT_SECRET`   | `replace_this`          | JWT signing secret           |
| `CORS_ORIGIN`  | `http://localhost:3000` | Allowed frontend origin      |

Never commit `.env`.

---

## Project Structure

```txt
GraphQL_DevConnect/
├── docker-compose.yml
├── render.yaml
├── docs/
│   ├── architecture.md
│   ├── database-schema.md
│   ├── deployment.md
│   ├── graphql-examples.md
│   └── rbac-rules.md
├── .github/
│   └── workflows/
│       └── ci.yml
└── server/
    ├── Dockerfile
    ├── docker-entrypoint.sh
    ├── package.json
    ├── prisma/
    │   ├── schema.prisma
    │   ├── seed.ts
    │   └── migrations/
    ├── src/
    │   ├── app.ts
    │   ├── server.ts
    │   ├── config/
    │   ├── graphql/
    │   ├── loaders/
    │   ├── modules/
    │   │   ├── auth/
    │   │   ├── users/
    │   │   ├── projects/
    │   │   ├── issues/
    │   │   └── comments/
    │   └── utils/
    └── tests/
```

---

## Documentation

| Document                                               | Description                                |
| -------------------------------------------------------- | --------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)         | System architecture and request lifecycle  |
| [`docs/database-schema.md`](docs/database-schema.md)   | Prisma models and relationships            |
| [`docs/graphql-examples.md`](docs/graphql-examples.md) | Query, mutation, and subscription examples |
| [`docs/rbac-rules.md`](docs/rbac-rules.md)             | Role-based authorization rules             |
| [`docs/deployment.md`](docs/deployment.md)             | Deployment notes and troubleshooting       |

---

## CI Pipeline

GitHub Actions validates the project on every push and pull request.

CI checks:

```txt
npm ci
Prisma generate
Prisma schema validation
TypeScript build
Automated tests
```

---

## Error Handling

The API uses structured application errors.

| Error Code                | Meaning                               |
| --------------------------- | ----------------------------------------- |
| `AUTHENTICATION_REQUIRED` | User must be logged in                |
| `FORBIDDEN`               | User is not allowed to perform action |
| `NOT_FOUND`               | Resource does not exist               |
| `VALIDATION_ERROR`        | Invalid input                         |
| `CONFLICT`                | Duplicate or conflicting resource     |
| `INTERNAL_SERVER_ERROR`   | Unexpected server error               |

---

## Learning Outcomes

This project demonstrates:

* GraphQL schema design
* Advanced resolver patterns
* Query, mutation, and subscription design
* JWT authentication
* Global and project-scoped RBAC
* Prisma relational modeling
* Cursor pagination
* Filtering and sorting
* DataLoader optimization
* Structured error handling
* Modular backend architecture
* Dockerized development
* Automated testing
* CI workflow setup

---

## Author

**Om Choksi**

GitHub: [OMCHOKSI108](https://github.com/OMCHOKSI108)
