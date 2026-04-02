# Product Listing DB Engineering

## High-Level Goals

The product listing design optimizes for:

- stable forward pagination
- predictable continuation between pages
- efficient access to the public subset of products
- bounded query cost

The endpoint is intentionally closer to a production catalog read path than a basic CRUD list endpoint.

## Migration-Driven Query Design

The listing behavior is backed by explicit schema and index migrations rather than runtime ORM synchronization.

Important implications:

- the table definition and the listing index are reviewed as code
- the runtime query shape and the index shape can be aligned deliberately
- the schema does not drift because of `synchronize: true`

This matters because query performance work is only reliable when the schema and access path are treated as first-class artifacts.

## Correctness-Oriented Product Modeling

The listing path benefits from schema choices in the `products` table:

- `price_amount` stored as integer minor units
- `stock_quantity` stored as integer
- `deleted_at` used for soft delete
- `is_active` used as an explicit availability flag

These are not only data-modeling choices. They directly influence the listing predicate and index strategy.

For example:

- soft delete requires an explicit `deleted_at IS NULL` filter
- public visibility requires an explicit `is_active = true` filter

The listing query is therefore built around business visibility rules, not just row existence.

## Cursor Pagination Instead of Offset Pagination

The endpoint uses cursor pagination rather than offset pagination.

The practical reason is simple:

- large offsets become increasingly expensive
- offset pagination is unstable under concurrent inserts
- cursor pagination can continue from a known sort position

In this implementation, the cursor is built from:

- `createdAt`
- `id`

That payload is encoded as an opaque token and returned to the client as `nextCursor`.

Operational effect:

- clients page through a moving dataset with fewer duplicate/missing-row risks
- the server can continue from a deterministic position instead of counting past earlier rows

## Deterministic Ordering

The listing query sorts by:

- `created_at DESC`
- `id DESC`

The second key is necessary because `created_at` alone is not deterministic when multiple rows share the same timestamp.

This matters for cursor pagination because the continuation predicate must match the sort exactly. Without a deterministic tie-breaker, page boundaries become unreliable.

## Continuation Predicate

When a cursor is present, the query continues with the logical predicate:

```sql
created_at < :cursorCreatedAt
OR (created_at = :cursorCreatedAt AND id < :cursorId)
```

This is the correct continuation rule for the chosen descending sort order.

Operational effect:

- the next page starts strictly after the last row seen in the previous page
- the predicate matches the cursor payload and the sort order
- the index remains useful because the filter and ordering align

## Limit Plus One Pattern

The query fetches `limit + 1` rows rather than exactly `limit`.

Purpose:

- determine whether another page exists
- avoid a separate count query for simple forward pagination

Returned behavior:

- only `limit` rows are returned in `items`
- the extra row is used to compute `hasNextPage` and `nextCursor`

This is a standard low-cost pagination pattern for forward-only cursor reads.

## Partial Composite Index Aligned to the Public Query

The key index is:

```sql
CREATE INDEX "IDX_products_public_listing"
ON "products" ("created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL AND "is_active" = true
```

This index is important for two reasons.

First, it is composite:

- it indexes both `created_at` and `id`
- this matches the actual sort used by the listing query

Second, it is partial:

- it only indexes rows where `deleted_at IS NULL` and `is_active = true`
- this matches the public visibility rules

Operational effect:

- the index is smaller than a full-table equivalent
- inactive and soft-deleted rows do not bloat the public read index
- the database can serve the listing path using an index tailored to the real filter and order pattern

## Intentional Filtering of the Public Subset

The public listing does not return all products.

It returns only rows that are:

- not soft-deleted
- active

This is an intentional query-design choice, not just a controller-level filter. It is reflected consistently in:

- the SQL predicate
- the index predicate
- the API contract

That consistency is important because partial indexing only pays off when the application query shape stays aligned with the indexed subset.

## Bounded Query Cost

`ListProductsQueryDto` bounds the requested page size.

Operational effect:

- clients cannot request arbitrarily large pages
- the endpoint avoids accidental heavy scans and oversized payloads
- the query cost remains more predictable under load

This is a small but meaningful protection for a public read path.

## Operational Guarantees Created by This Design

The current product listing design provides these practical guarantees:

- public listing is stable under normal pagination behavior
- page continuation is deterministic
- inactive and soft-deleted rows stay out of the public result set
- the main public query path is aligned with a targeted partial composite index
- page size is bounded at the API boundary
