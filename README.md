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
- public order creation with transactional stock reduction
- explicit money modeling with a single-currency runtime assumption of `LKR`

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

- `GET /v1/health/live` returns application liveness
- `GET /v1/health/ready` checks PostgreSQL readiness

## Product Endpoints

- `GET /v1/products` returns the public product catalog using cursor pagination
- `POST /v1/products`, `PATCH /v1/products/:id`, and `DELETE /v1/products/:id` are admin-only and require `x-api-key`

## Order Endpoint

- `POST /v1/orders` creates a multi-item order and requires the `Idempotency-Key` header
- `POST /v1/orders` also requires `customerDeviceToken` in the request body so later notification phases have an explicit FCM delivery target

The order write path currently:

- validates that every requested product exists and is active
- rejects duplicate products in the same basket
- rejects products that are not priced in `LKR`
- requires a non-empty `customerDeviceToken`
- snapshots line-item prices plus the aggregate order total
- reduces stock for all items in the same transaction as order creation
- persists a `PENDING` notification intent in the same transaction as order creation
- schedules Firebase delivery after commit so the notification later transitions to `SENT` or `FAILED`
- replays the original successful result when the same `Idempotency-Key` is retried with the same effective request
- rejects the retry with `409` if the same `Idempotency-Key` is reused for a different basket or a different `customerDeviceToken`

For this assignment, the runtime business assumption is a single-currency catalog in `LKR`. The `currency` field is still retained in the schema and API so monetary data remains explicit and future extension does not require a schema redesign.

## Notification Endpoint

- `GET /v1/orders/:id/notifications` returns persisted notifications for an order
- this endpoint is admin-only and requires `x-api-key`
- the response includes notification status and a masked preview of the target device token
- `providerMessageId`, `sentAt`, `failedAt`, and `failureReason` reflect the Firebase delivery outcome once the async attempt finishes

## Demo Data

Use the demo seed when you want an interview-friendly dataset for pagination walkthroughs.

```bash
npm run seed:demo
```

What it does:

- upserts 80 deterministic active products
- seeds all demo products in `LKR`
- uses fixed UUIDs so seeded rows are stable across reruns
- uses staggered timestamps, with repeated timestamp pairs, so cursor pagination and the `created_at DESC, id DESC` tie-breaker are easy to explain
- does not touch non-demo products created manually through the API

Suggested pagination demo flow:

1. `npm run db:up`
2. `npm run migration:run`
3. `npm run seed:demo`
4. `npm run start:dev`
5. Open Swagger at `http://localhost:3000/docs`
6. Call `GET /v1/products?limit=20`
7. Copy the returned `pageInfo.nextCursor` into the next `GET /v1/products` request

Suggested order demo flow:

1. `npm run db:up`
2. `npm run migration:run`
3. `npm run seed:demo`
4. `npm run start:dev`
5. Open Swagger at `http://localhost:3000/docs`
6. Pick a seeded product ID from `GET /v1/products`
7. Call `POST /v1/orders` with:
   - header: `Idempotency-Key: demo-order-1`
   - body:

```json
{
  "customerDeviceToken": "<fcm-registration-token-from-test-client>",
  "items": [
    { "productId": "<first-seeded-product-id>", "quantity": 1 },
    { "productId": "<second-seeded-product-id>", "quantity": 2 }
  ]
}
```

8. Repeat the same `POST /v1/orders` request with the same `Idempotency-Key` to verify replay behavior.
9. Call `GET /v1/orders/<created-order-id>/notifications` with `x-api-key` to inspect the persisted notification record and final delivery status.

## Environment Notes

- `DB_*` values are required and should point to the local Docker Postgres instance during development.
- `ADMIN_API_KEY` is required now because later admin routes will depend on it.
- Firebase configuration is optional as a group for local startup, but notification delivery will move records to `FAILED` until real credentials are provided.
- Application code should read config through Nest config injection, not directly from `process.env`.
- The current business assumption is a single-currency system using `LKR`, even though currency stays explicit in the schema and response DTOs.
- For this backend-only assignment, the order request carries `customerDeviceToken` because there is no separate user/profile device registration flow.

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
