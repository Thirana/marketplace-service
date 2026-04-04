# Marketplace Service

NestJS backend for a backend and platform engineering assessment, built with an emphasis on production style engineering decisions.

## Current Baseline

- validated environment configuration
- Docker managed local PostgreSQL
- TypeORM runtime and CLI datasource setup
- migration only schema workflow
- structured JSON logging with request IDs
- centralized API exception handling
- health endpoints for liveness and readiness
- public order creation with transactional stock reduction

## Prerequisites

- Node.js 22+
- npm
- Docker Desktop or another running Docker daemon
- Firebase project and service account credentials if you want real FCM delivery testing
- a real FCM registration token from a test client if you want to verify end to end notification delivery

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

Postman artifacts are available under `docs/postman/`.
Import `marketplace-service.postman_collection.json` and `marketplace-service.local.postman_environment.json` into Postman if you want a ready made request set for the current API surface.

## Documentation

The `docs/` directory contains the main technical notes:

- `docs/bootstrap/` summarizes application startup and shared runtime behavior
- `docs/database/` covers schema design and the main database engineering decisions
- `docs/services/` explains the behavior of the product listing, order creation, and notification services
- `docs/limitations-and-tradeoff/` captures the main current limitations and design tradeoffs
- `docs/gcp-deployment.md` and `docs/gcp/` describe the recommended GCP deployment model
- `docs/postman/` contains importable Postman collection and environment files

## Health Endpoints

- `GET /v1/health/live` returns application liveness
- `GET /v1/health/ready` checks PostgreSQL readiness

## Product Endpoints

- `GET /v1/products` returns the public product catalog using cursor pagination
- `POST /v1/products`, `PATCH /v1/products/:id`, and `DELETE /v1/products/:id` are admin only and require `x-api-key`

## Order Endpoint

- `POST /v1/orders` creates a multi item order and requires the `Idempotency-Key` header
- `POST /v1/orders` also requires `customerDeviceToken` in the request body so the service has an explicit FCM delivery target

The order write path currently:

- builds a SHA-256 request fingerprint from the canonical effective request so logically identical retries can be recognized reliably
- validates that every requested product exists and is active
- rejects duplicate products in the same basket
- requires a non-empty `customerDeviceToken`
- snapshots line-item prices plus the aggregate order total
- reduces stock for all items in the same transaction as order creation
- persists a `PENDING` notification intent in the same transaction as order creation
- schedules Firebase delivery after commit so the notification later transitions to `SENT` or `FAILED`
- replays the original successful result when the same `Idempotency-Key` is retried with the same effective request
- rejects the retry with `409` if the same `Idempotency-Key` is reused for a different basket or a different `customerDeviceToken`

## Notification Endpoint

- `GET /v1/orders/:orderId/notifications` returns persisted notifications for an order
- this endpoint is admin-only and requires `x-api-key`
- the response includes notification status and a masked preview of the target device token
- `providerMessageId`, `sentAt`, `failedAt`, and `failureReason` reflect the Firebase delivery outcome once the async attempt finishes

## Demo Data

Use the demo seed when you want an dataset for pagination walkthroughs.

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
- `ADMIN_API_KEY` is required because admin routes depend on it.
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
