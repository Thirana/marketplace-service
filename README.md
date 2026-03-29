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

5. Start the API.

```bash
npm run start:dev
```

The default local database values in `.env.example` match `compose.yaml`.

Swagger is available at `/docs` once the application is running.

## Health Endpoints

- `GET /health/live` returns application liveness
- `GET /health/ready` checks PostgreSQL readiness

Both endpoints are intended to support local verification now and platform-style probes in later deployment work.

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
