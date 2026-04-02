# Database Schema Overview

## Schema Inventory

The application currently uses these main tables:

- `products`
- `orders`
- `order_items`
- `order_idempotency_keys`
- `notifications`

TypeORM also maintains:

- `typeorm_migrations`

The business tables are intentionally small in number and explicit in purpose. The design favors correctness and reviewable migration history over broad ORM-driven convenience.

## Relationship Model

The current relationship model is:

- one `order` to many `order_items`
- one `order` to many `notifications`
- one `order` to at most one `order_idempotency_keys` row
- many `order_items` to one `product`

Operationally, `orders` is the aggregate root for checkout data. `order_items` and `notifications` are dependent records. `order_idempotency_keys` stores replay state tied back to the created order.

## Products Table

The `products` table is the catalog and inventory source.

Main columns:

- `id`
- `name`
- `description`
- `price_amount`
- `currency`
- `stock_quantity`
- `is_active`
- `created_at`
- `updated_at`
- `deleted_at`

Important constraints:

- primary key on `id`
- `price_amount >= 0`
- `stock_quantity >= 0`

Important index:

- `IDX_products_public_listing`
- `(created_at DESC, id DESC)`
- partial predicate: `deleted_at IS NULL AND is_active = true`

Operational meaning:

- the table supports admin writes, public listing, and inventory checks
- soft delete is represented explicitly with `deleted_at`
- the public read path is intentionally optimized without indexing inactive or deleted rows

## Orders Table

The `orders` table stores order-level state.

Main columns:

- `id`
- `idempotency_key`
- `total_price_amount`
- `currency`
- `created_at`
- `updated_at`

Important constraints:

- primary key on `id`
- `total_price_amount >= 0`
- `currency = 'LKR'`

Operational meaning:

- `orders` is the parent record for a successful checkout
- order totals are persisted as write-time snapshots
- the schema enforces the single-currency runtime assumption at the database layer

## Order Items Table

The `order_items` table stores normalized line items.

Main columns:

- `id`
- `order_id`
- `product_id`
- `quantity`
- `unit_price_amount`
- `line_total_amount`
- `currency`
- `created_at`
- `updated_at`

Important constraints:

- foreign key `order_id -> orders.id` with `ON DELETE CASCADE`
- foreign key `product_id -> products.id` with `ON DELETE RESTRICT`
- `quantity > 0`
- `unit_price_amount >= 0`
- `line_total_amount >= 0`
- `line_total_amount = unit_price_amount * quantity`
- `currency = 'LKR'`

Important index:

- `IDX_order_items_order_id`

Operational meaning:

- orders are modeled as a parent aggregate plus explicit lines
- line totals are stored and validated, not recomputed from mutable product state
- `ON DELETE RESTRICT` on `product_id` protects historical order references from catalog deletion

## Order Idempotency Keys Table

The `order_idempotency_keys` table stores replay and conflict-resolution state for `POST /v1/orders`.

Main columns:

- `id`
- `idempotency_key`
- `request_fingerprint`
- `status`
- `response_status_code`
- `order_id`
- `created_at`
- `updated_at`

Important constraints:

- primary key on `id`
- unique key on `idempotency_key`
- unique key on `order_id`
- `status IN ('IN_PROGRESS', 'COMPLETED')`
- `response_status_code > 0`
- foreign key `order_id -> orders.id` with `ON DELETE CASCADE`

Operational meaning:

- the unique key on `idempotency_key` is the core duplicate-prevention guarantee
- the stored fingerprint lets the service distinguish safe replay from conflicting reuse
- the unique key on `order_id` keeps the relationship one-to-one from the idempotency table side

## Notifications Table

The `notifications` table stores durable notification intent and delivery state.

Main columns:

- `id`
- `order_id`
- `type`
- `status`
- `target_device_token`
- `title`
- `body`
- `provider_message_id`
- `failure_reason`
- `sent_at`
- `failed_at`
- `created_at`
- `updated_at`

Important constraints:

- primary key on `id`
- foreign key `order_id -> orders.id` with `ON DELETE CASCADE`
- `type IN ('ORDER_CREATED')`
- `status IN ('PENDING', 'SENT', 'FAILED')`

Important index:

- `IDX_notifications_order_id_created_at`

Operational meaning:

- notification behavior is queryable, not log-only
- the table is a delivery-state ledger, not just a transient queue
- the index supports ordered notification reads scoped to one order

## Schema-Wide Conventions

The schema uses a consistent set of conventions:

- UUID primary keys generated in PostgreSQL
- `created_at` and `updated_at` on business tables
- integer money storage, never floating-point
- explicit `currency` columns
- database check constraints for core invariants
- foreign keys used for referential integrity instead of app-only trust
- migrations as the only schema-evolution mechanism

These conventions matter because they make the data model predictable under both normal application traffic and future operational changes.

## Operational Guarantees Created by This Schema

The current schema provides these guarantees:

- catalog money and stock values cannot go negative
- public listing can target active, non-deleted rows efficiently
- order totals and line totals remain historically stable
- duplicate order retries can be resolved from durable DB state
- notification lifecycle is persisted and queryable
- parent-child delete behavior is explicit and intentional

The result is a schema designed for correctness first, with targeted indexing and constraints where the application behavior depends on them.
