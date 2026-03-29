# Marketplace Service

NestJS backend for a backend and platform engineering assessment. The project is being built phase by phase with an emphasis on production-style engineering decisions rather than starter-level scaffolding.

## Current Baseline

- validated environment configuration
- Docker-managed local PostgreSQL
- TypeORM runtime and CLI datasource setup
- migration-only schema workflow
- structured JSON logging with request IDs
- centralized API exception handling
- health endpoints for liveness and readiness

## Prerequisites

- Node.js 22+
- npm
- Docker Desktop or another running Docker daemon

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Create a local environment file.

```bash
cp .env.example .env
```

3. Start PostgreSQL.

```bash
npm run db:up
```

4. Run migrations.

```bash
npm run migration:run
```

5. Seed the demo catalog with 80 deterministic products.

```bash
npm run seed:demo
```

6. Start the API.

```bash
npm run start:dev
```

The default local database values in `.env.example` match `compose.yaml`.

Swagger is available at `/docs` once the application is running.

## Health Endpoints

- `GET /health/live` returns application liveness
- `GET /health/ready` checks PostgreSQL readiness

## Product Endpoints

- `GET /products` returns the public product catalog using cursor pagination
- `POST /products`, `PATCH /products/:id`, and `DELETE /products/:id` are admin-only and require `x-api-key`

Both endpoints are intended to support local verification now and platform-style probes in later deployment work.

## Demo Data

Use the demo seed when you want an interview-friendly dataset for pagination walkthroughs.

```bash
npm run seed:demo
```

What it does:

- upserts 80 deterministic active products
- uses fixed UUIDs so seeded rows are stable across reruns
- uses staggered timestamps, with repeated timestamp pairs, so cursor pagination and the `created_at DESC, id DESC` tie-breaker are easy to explain
- does not touch non-demo products created manually through the API

Suggested pagination demo flow:

1. `npm run db:up`
2. `npm run migration:run`
3. `npm run seed:demo`
4. `npm run start:dev`
5. Open Swagger at `http://localhost:3000/docs`
6. Call `GET /products?limit=20`
7. Copy the returned `pageInfo.nextCursor` into the next `GET /products` request

## Environment Notes

- `DB_*` values are required and should point to the local Docker Postgres instance during development.
- `ADMIN_API_KEY` is required now because later admin routes will depend on it.
- Firebase configuration is optional as a group until the notifications phase.
- Application code should read config through Nest config injection, not directly from `process.env`.

## Commands

- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- `npm run test:e2e -- --runInBand`
- `npm run db:up`
- `npm run db:down`
- `npm run db:reset`
- `npm run seed:demo`
- `npm run migration:create --name=<migration-name>`
- `npm run migration:generate --name=<migration-name>`
- `npm run migration:run`
- `npm run migration:revert`

## Operational Notes

- The service uses structured JSON logs through Winston.
- Each request gets an `x-request-id` header for log correlation.
- API errors are normalized through a global exception filter.
- TypeORM `synchronize` is disabled. Schema changes must go through migrations.

## Troubleshooting

- If `npm run db:up` fails, start Docker Desktop and retry.
- If `npm run test:e2e -- --runInBand` fails with database connection errors, make sure the Postgres container is healthy and listening on `localhost:5432`.
