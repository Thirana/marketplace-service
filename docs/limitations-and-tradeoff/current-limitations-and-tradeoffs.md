# Current Limitations and Tradeoffs

## Authentication and Identity Model

The service does not have a full user or customer identity model.

Current behavior:

1. there is no user module
2. there is no login or session model
3. there is no order ownership model
4. protected operational endpoints use a shared admin API key

Tradeoff:

1. this keeps the project focused on backend platform behavior instead of full account management
2. it also means the API cannot express customer-specific authorization rules

Practical effect:

1. notification reads are admin-only
2. there is no customer-facing order history or notification read path

## Device Token Handling

Because there is no user or device registration subsystem, `customerDeviceToken` is supplied directly in the `POST /v1/orders` body.

Tradeoff:

1. this makes the Firebase integration demonstrable in a backend-only project
2. it avoids introducing a separate device-token registration flow

Limitation:

1. the token is request-scoped rather than identity-scoped
2. there is no token registry
3. there is no token rotation, revocation, or stale-token cleanup workflow

This is a deliberate simplification, not a full production notification-target model.

## Notification Delivery Model

Notification delivery is post-commit and non-blocking.

Current behavior:

1. the order transaction persists a `PENDING` notification row
2. delivery is scheduled asynchronously with `setImmediate(...)`
3. the notification transitions to `SENT` or `FAILED`

Tradeoff:

1. order success is isolated from provider latency and provider failure
2. the database still records delivery outcome

Limitation:

1. there is no queue or worker subsystem
2. there is no retry policy with backoff
3. there is no dead-letter handling
4. failed notifications remain observable, but are not automatically redriven

This is a reasonable bounded design for a small service, but it is not a full delivery pipeline.

## Firebase Success Semantics

The system treats `SENT` as provider acceptance, not end-user confirmation.

Current behavior in `firebase-notification-gateway.service.ts` and `notifications.service.ts`:

1. Firebase returns a provider message identifier
2. the notification row is marked `SENT`

Tradeoff:

1. this is the correct server-side boundary for a backend service
2. it keeps provider interaction simple and observable

Limitation:

1. the service does not know whether the device displayed the notification
2. there is no delivery analytics, open tracking, or acknowledgement model

## Currency Model

The runtime assumes a single currency, `LKR`.

Current behavior:

1. products used for ordering must be priced in `LKR`
2. orders and order items are persisted in `LKR`
3. currency still remains explicit in the schema

Tradeoff:

1. this keeps money handling and order validation simpler
2. it avoids mixed-currency basket rules and FX conversion concerns

Limitation:

1. the service does not support mixed-currency catalogs for ordering
2. there is no conversion logic
3. the money model is intentionally narrow at runtime

## Read Model Scope

The read surface is intentionally limited.

Current behavior:

1. products have a public listing endpoint
2. notifications can be read per order through an admin-only endpoint
3. there is no general admin order list or order search endpoint
4. there is no customer order read API

Tradeoff:

1. the implemented read paths stay tightly aligned to the main functional requirements
2. the project avoids growing into a broader order-management system

Limitation:

1. operational inspection of orders is narrower than a fuller production backend
2. some workflows assume the caller already has an `orderId`
