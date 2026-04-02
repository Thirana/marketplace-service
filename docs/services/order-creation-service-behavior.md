# Order Creation Service Behavior

## Scope

This note summarizes the order creation behavior implemented mainly by:

1. `src/modules/orders/services/orders.service.ts`
2. `src/modules/orders/order-fingerprint.ts`
3. `src/modules/orders/dto/create-order.dto.ts`
4. `src/modules/orders/dto/order-response.dto.ts`
5. `src/modules/notifications/services/notifications.service.ts`

The focus is the `OrdersService.create(...)` write path behind `POST /v1/orders`.

## Service Responsibility

`OrdersService.create(...)` is responsible for:

1. building the request fingerprint
2. executing the order write path inside one transaction
3. reserving DB-backed idempotency state
4. validating the basket against locked product rows
5. deducting stock
6. persisting the order aggregate
7. creating notification intent
8. resolving replay or conflict when the same idempotency key is reused

The controller remains thin. The service owns the business and persistence rules.

## Input Model

The service receives:

1. a validated `Idempotency-Key`
2. `CreateOrderDto`

`CreateOrderDto` contains:

1. `customerDeviceToken`
2. `items[]`

Each item contains:

1. `productId`
2. `quantity`

The service assumes DTO validation has already run, but it still performs business validation before persistence.

## Request Fingerprint

The service creates a SHA-256 fingerprint before starting the transaction.

The canonical payload includes:

1. `customerDeviceToken`
2. fixed runtime currency `LKR`
3. normalized basket items

Items are sorted by `productId` before hashing.

Operational meaning:

1. the same basket in different item order produces the same fingerprint
2. the same idempotency key with a different basket conflicts
3. the same idempotency key with a different device token also conflicts

## Transaction Boundary

The core order write path runs inside one database transaction.

That transaction covers:

1. idempotency reservation
2. duplicate product check
3. product row loading and locking
4. product availability validation
5. stock deduction
6. `orders` insert
7. `order_items` inserts
8. `notifications` insert
9. idempotency completion

Operational meaning:

1. the write path is atomic
2. partial order state does not survive rollback
3. notification intent exists only for committed orders

## Inventory Handling

The service loads products in sorted ID order and applies `pessimistic_write` locking.

After the rows are locked, it validates:

1. product exists
2. product is active
3. product currency is `LKR`
4. stock is sufficient

Only then does it decrement stock in memory and persist the updated product rows.

This is a concurrency-aware inventory path, not a best-effort read-then-write flow.

## Order Aggregate Persistence

After validation succeeds, the service:

1. computes line totals
2. computes the order total
3. creates the `orders` row
4. persists updated product stock sequentially
5. creates `order_items` rows

The final response is built from the persisted order aggregate and mapped through `toOrderResponseDto(...)`.

This keeps response data aligned with committed state rather than temporary in-memory calculations.

## DB-Backed Idempotency Behavior

The service first attempts to insert an `order_idempotency_keys` row with:

1. `idempotency_key`
2. `request_fingerprint`
3. `IN_PROGRESS`

If that insert succeeds, the order creation path continues.

If the unique constraint on `idempotency_key` is hit, the service moves into replay resolution.

Replay resolution does this:

1. load the existing idempotency row
2. compare the stored fingerprint to the new fingerprint
3. if they match, load and return the original order
4. if they do not match, return `IDEMPOTENCY_REQUEST_CONFLICT`

Operational meaning:

1. safe retries reuse durable DB state
2. duplicate writes are prevented by schema guarantees, not process memory

## Notification Integration

Inside the same order transaction, the service calls `NotificationsService.createPendingOrderCreatedNotification(...)`.

After commit, the service:

1. logs `order.created`
2. logs `notification.created`
3. calls `notificationsService.scheduleDelivery(notification.id)`

This is important because order success and notification delivery are intentionally decoupled.

The order response is returned immediately after the committed write path finishes. Notification delivery is handled later.

## Error Behavior

The service can reject the request with domain-specific errors such as:

1. `DUPLICATE_ORDER_PRODUCT`
2. `PRODUCT_NOT_FOUND`
3. `PRODUCT_NOT_AVAILABLE`
4. `UNSUPPORTED_PRODUCT_CURRENCY`
5. `INSUFFICIENT_PRODUCT_STOCK`
6. `IDEMPOTENCY_REQUEST_CONFLICT`

Failures before commit roll back the full transaction.

Failures after commit in the notification delivery path do not invalidate the committed order.

## Operational Guarantees

The current service behavior provides these guarantees:

1. order creation is atomic
2. stock validation happens against locked rows
3. duplicate retries are replay-safe
4. conflicting reuse of an idempotency key is detectable
5. order pricing is snapshotted at write time
6. notification intent is persisted with the order
7. notification delivery does not block order success

In practice, `OrdersService` is the core transactional boundary of the application. It coordinates inventory, order persistence, idempotency, and notification intent as one controlled write path.
