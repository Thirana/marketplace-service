# Order and Notification DB Engineering

## High-Level Goals

The order and notification write path optimizes for:

- transactional consistency
- concurrency safe stock handling
- DB backed idempotent replay
- durable notification intent
- non blocking side effects with observable final state

These are database design concerns as much as service layer concerns.

## Normalized Order Aggregate

The order model is normalized into:

- `orders`
- `order_items`

This avoids two weak alternatives:

- one-product-per-order modeling
- storing the basket in a JSON column

Operational effect:

- line items remain queryable
- price snapshots are explicit
- totals and item-level history remain stable even if product data changes later

The schema treats `orders` as the aggregate root and `order_items` as dependent records.

## Database Constraints Protect Order Correctness

Important constraints on the order schema include:

- `total_price_amount >= 0`
- `quantity > 0`
- `unit_price_amount >= 0`
- `line_total_amount >= 0`
- `line_total_amount = unit_price_amount * quantity`
- `currency = 'LKR'` on both `orders` and `order_items`

These constraints are significant because they move correctness closer to the stored data.

Operational effect:

- invalid order rows cannot be persisted even if application logic regresses
- line total consistency is enforced by the database itself

## Transaction Boundary Around the Core Order Write Path

The service performs the core write path inside one database transaction.

That transaction covers:

- idempotency reservation
- product row loading and locking
- stock validation
- stock deduction
- `orders` insert
- `order_items` inserts
- notification intent insert
- idempotency completion

Operational effect:

- the write path is atomic
- partial checkout state does not survive rollback
- notification intent exists only for committed orders

This is one of the main database integrity guarantees in the system.

## Deterministic Pessimistic Locking for Inventory Safety

Before stock is validated and deducted, the service loads the participating product rows with `pessimistic_write` locking.

The lock acquisition order is deterministic:

- product IDs are sorted before the query is issued

Operational effect:

- stock validation happens against locked state, not stale reads
- oversell risk is reduced under concurrent order creation
- deterministic lock order reduces deadlock risk when overlapping baskets are processed concurrently

This is a database level concurrency strategy, not just an application side convention.

## DB Backed Idempotency Table

`order_idempotency_keys` is the core replay control table.

Important schema properties:

- unique key on `idempotency_key`
- unique key on `order_id`
- stored `request_fingerprint`
- explicit `status`
- stored `response_status_code`

The unique key on `idempotency_key` is the main protection against duplicate order creation.

Operational effect:

- the first request reserves the key durably
- later requests with the same key are resolved from persisted state
- duplicate prevention does not depend on in-memory state or process locality

This is materially stronger than in-process duplicate suppression because it still works across restarts and multiple app instances.

## Canonical Request Fingerprinting

The idempotency record stores a SHA-256 fingerprint of the effective order request.

The fingerprint is built from a canonical payload containing:

- `customerDeviceToken`
- fixed runtime currency `LKR`
- normalized basket items

The items are sorted by `productId` before hashing.

Operational effect:

- same basket in different item order produces the same fingerprint
- same key with a changed basket conflicts
- same key with a different notification target also conflicts

This makes replay semantics precise instead of treating `Idempotency-Key` as blindly sufficient.

## Notification Table as a Durable Side Effect Ledger

`notifications` stores one row per persisted notification intent.

Key columns:

- `order_id`
- `type`
- `status`
- `target_device_token`
- `provider_message_id`
- `failure_reason`
- `sent_at`
- `failed_at`

Important schema choices:

- foreign key to `orders` with `ON DELETE CASCADE`
- constrained `type`
- constrained `status`
- ordered read index on `(order_id, created_at)`

Operational effect:

- notification behavior is persisted and queryable
- side effects are modeled as durable state, not only logs
- notification reads can be scoped efficiently to one order

## Notification Intent Is Created Inside the Order Transaction

The `notifications` row is created before the order transaction commits.

That matters because:

- rollback removes the notification row automatically
- committed orders always have matching committed notification intent
- the database never shows notification intent for an order that failed to commit

This keeps the side effect ledger aligned with the actual business transaction.

## Post Commit Delivery State Transitions

Phase 08 introduces asynchronous updates to the same `notifications` row after commit.

State model:

- `PENDING`
- `SENT`
- `FAILED`

Write pattern:

- create row as `PENDING` inside the order transaction
- after commit, attempt Firebase delivery
- update the same row to `SENT` or `FAILED`

Operational effect:

- order success is decoupled from provider success
- final delivery outcome is still persisted
- observers can inspect both intent and outcome from the database

The database is therefore acting as the durable system of record for notification state, while Firebase is only the external transport.

## Referential Integrity and Delete Behavior

The foreign-key behavior is deliberate:

- `order_items.order_id -> orders.id` uses `ON DELETE CASCADE`
- `order_idempotency_keys.order_id -> orders.id` uses `ON DELETE CASCADE`
- `notifications.order_id -> orders.id` uses `ON DELETE CASCADE`
- `order_items.product_id -> products.id` uses `ON DELETE RESTRICT`

Operational effect:

- dependent order records are removed with the parent order
- historical order lines cannot silently lose product references because of catalog deletion

This strikes a useful balance between aggregate cleanup and historical integrity.

## Operational Guarantees Created by This Design

- duplicate order retries are resolved from durable DB state
- conflicting reuse of an idempotency key is detectable
- stock deduction and order persistence are atomic
- notification intent exists only for committed orders
- notification delivery outcome is observable after commit
- historical order pricing remains stable
- dependent order records respect explicit referential rules

In practice, this means the order flow is not just "transactional" at the service level. The core guarantees are encoded directly in schema constraints, foreign keys, uniqueness rules, and persisted state transitions.
