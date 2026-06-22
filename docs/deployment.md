# Deployment

## Local deployment (no Docker)

```bash
cd server
npm install
cp .env.example .env   # edit DATABASE_URL / JWT_SECRET / CORS_ORIGIN
npx prisma migrate dev
npm run db:seed
npm run dev
```

Requires a reachable PostgreSQL instance — either a local install or
`docker compose up -d postgres` from the repo root.

## Docker deployment

```bash
docker compose up --build
```

This builds `server/Dockerfile` (multi-stage: deps → build → production) and
starts both `postgres` and `api`. The `api` container's entrypoint
(`docker-entrypoint.sh`) runs `npx prisma migrate deploy` before starting the
server, so the schema is always up to date on container start — no manual
migration step needed for the Docker path.

To run migrations or the seed script against the dockerized Postgres without
starting the API:

```bash
docker compose run --rm api npx prisma migrate deploy
```

Seeding is run via `npm run db:seed` (`tsx prisma/seed.ts`) — intended for local
development and demo/staging data, not normal production operation. The
production image doesn't bundle `tsx`, so to seed a remote/staging database, run
`npm run db:seed` from a local checkout with `DATABASE_URL` pointed at that
database, rather than from inside the production container.

## Render deployment (Blueprint)

The repo root includes `render.yaml`, a [Render Blueprint](https://render.com/docs/blueprint-spec)
that declares both the API service and its Postgres database in one file —
Render reads it automatically and provisions everything in one step.

```yaml
databases:
  - name: devconnectql-db        # managed Postgres
services:
  - type: web
    name: devconnectql-api
    runtime: docker
    dockerfilePath: ./server/Dockerfile
    dockerContext: ./server
    healthCheckPath: /health
```

**Steps:**

1. Push this repo to GitHub.
2. In the Render dashboard: **New → Blueprint**, select the repo. Render parses
   `render.yaml` and shows a preview of the `devconnectql-db` database and
   `devconnectql-api` web service it's about to create.
3. Click **Apply**. Render provisions the Postgres instance first, then builds
   `server/Dockerfile` using `server/` as the build context.
4. The blueprint already wires:
   - `DATABASE_URL` → the new database's **internal** connection string
     (via `fromDatabase`), so DB traffic stays on Render's private network.
   - `JWT_SECRET` → a securely random value Render generates for you
     (via `generateValue: true`) — you never have to invent or commit one.
   - `NODE_ENV=production`.
   - `CORS_ORIGIN=*` — **update this** to your real frontend origin once you
     have one; the blueprint ships `*` only so the API is immediately testable.
5. Render injects `PORT` itself at runtime; the app already reads
   `process.env.PORT` with a `4000` fallback, so no action needed.
6. On every deploy, `docker-entrypoint.sh` runs `npx prisma migrate deploy`
   before starting the server — schema changes ship automatically with each
   push, no manual migration step on Render.
7. WebSocket subscriptions work out of the box — Render's Docker web services
   support persistent WebSocket connections on the same port as HTTP.

The free Postgres plan on Render expires after 90 days unless upgraded — fine
for a demo/portfolio deployment, but plan accordingly for anything longer-lived.

To seed the deployed database with demo data, run `npm run db:seed` from a
local checkout with `DATABASE_URL` temporarily pointed at the Render
database's **external** connection string (copy it from the Render dashboard;
the internal one isn't reachable from outside Render's network).

## Railway notes

Railway also works well for this stack (Dockerfile-based web service + managed
Postgres plugin), but has no Blueprint-equivalent in this repo yet:

1. Provision a PostgreSQL plugin on Railway; it injects its own `DATABASE_URL`.
2. Create a new service from this repo, with **Root Directory** set to
   `server` (Railway needs to know the Dockerfile isn't at the repo root).
3. Set `JWT_SECRET` and `CORS_ORIGIN` manually as environment variables —
   Railway has no Render-style `generateValue`/`fromDatabase` blueprint syntax.
4. Everything else (migrations on start, `PORT` handling, WebSocket support)
   behaves the same as described for Render above.

## Production environment variables

| Variable      | Production guidance                                              |
| --------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`  | Managed Postgres connection string; prefer the internal/private network address |
| `JWT_SECRET`    | Long, random, unique per environment; rotate if ever leaked        |
| `NODE_ENV`      | `production` — disables verbose error stack traces                |
| `CORS_ORIGIN`   | Exact frontend origin(s), comma-separated; avoid `*` in production |
| `PORT`          | Usually injected by the platform; defaults to `4000` otherwise      |

## Common troubleshooting

- **`Cannot use GraphQLSchema "..." from another module or realm`** — this is a
  dual-package-hazard symptom from bundlers, not something you'll see at
  runtime in this project; it only appeared during initial Vitest setup and was
  resolved via `vitest.config.ts`'s `resolve.dedupe` + `server.deps.inline`.
  Not relevant to a normal deploy.
- **API container exits immediately after "Applying database migrations..."**
  — check `DATABASE_URL` is reachable from inside the container; if running
  Docker Compose, confirm the `postgres` service is healthy first
  (`depends_on: condition: service_healthy` should already enforce this).
- **`P3014` / shadow database permission errors** during `prisma migrate dev`
  (not `deploy`) — the database user needs `CREATEDB` privilege for the
  developer-only shadow database Prisma Migrate creates. This does not affect
  `migrate deploy`, which is what production/Docker uses.
- **WebSocket subscriptions silently never fire** — confirm the client sent
  `connectionParams: { authorization: "Bearer <token>" }` on `ConnectionInit`;
  unauthenticated WS connections behave the same as unauthenticated HTTP
  requests (`context.user` is `null`), so subscriptions requiring auth (like
  `issueAssigned`) will throw `FORBIDDEN` at subscribe time.
- **CORS errors from a browser frontend** — set `CORS_ORIGIN` to the frontend's
  exact origin (e.g. `https://app.example.com`); the default `*` only works for
  non-credentialed requests.
