# Product Listing Service Behavior

## Scope

This note summarizes the public product listing behavior implemented mainly by:

1. `src/modules/products/services/products.service.ts`
2. `src/modules/products/products.cursor.ts`
3. `src/modules/products/dto/list-products.query.dto.ts`
4. `src/modules/products/dto/list-products-response.dto.ts`

The focus is the `ProductsService.list(...)` read path behind `GET /v1/products`.

## Service Responsibility

`ProductsService.list(...)` is responsible for:

1. resolving the effective page size
2. decoding the incoming cursor when present
3. building the public listing query
4. enforcing the active and non-deleted visibility rules
5. computing `hasNextPage` and `nextCursor`
6. mapping entities into the response DTO shape

The controller remains thin. The query behavior and pagination semantics live in the service.

## Input Model

The service receives `ListProductsQueryDto`.

Important input rules:

1. `limit` is optional
2. `limit` is bounded
3. `cursor` is optional
4. `cursor` must decode into `createdAt` and `id`

If `limit` is absent, the service falls back to `DEFAULT_PRODUCTS_PAGE_SIZE`.

## Query Behavior

The service constructs a query over `products` with these rules:

1. `deleted_at IS NULL`
2. `is_active = true`
3. sort by `created_at DESC`
4. tie-break by `id DESC`
5. fetch `limit + 1`

If a cursor exists, the service applies the continuation predicate:

```sql
created_at < :cursorCreatedAt
OR (created_at = :cursorCreatedAt AND id < :cursorId)
```

This keeps the query aligned with the cursor contents and the chosen sort order.

## Cursor Handling

The service does not treat the cursor as a raw database value.

The flow is:

1. decode the opaque cursor
2. validate the decoded structure
3. use the decoded values in the continuation predicate
4. build a new cursor from the last returned item when another page exists

The cursor payload is based on:

1. `createdAt`
2. `id`

This is necessary because `created_at` alone is not deterministic enough for stable continuation.

## Page Boundary Logic

The service uses the `limit + 1` pattern.

That means:

1. query one extra row
2. use the extra row only to detect another page
3. return at most `limit` rows in `items`

From that result set, the service computes:

1. `hasNextPage`
2. `nextCursor`

This avoids a separate count query for simple forward pagination.

## Visibility Rules

The service intentionally exposes only the public subset of the catalog.

Rows are excluded when:

1. `deleted_at` is not null
2. `is_active` is false

This means the listing behavior is shaped by business visibility rules, not by raw table contents.

## Output Model

The service returns `ListProductsResponseDto`.

That response contains:

1. `items`
2. `pageInfo`

`items` are mapped through `toProductResponseDto(...)`.

`pageInfo` contains:

1. `limit`
2. `hasNextPage`
3. `nextCursor`

## Operational Guarantees

The current service behavior provides these guarantees:

1. forward pagination is deterministic
2. page size stays bounded
3. continuation is based on a stable sort position
4. inactive and deleted products stay out of the public result set
5. the response contract hides internal pagination mechanics behind an opaque cursor

In practical terms, the service is not just loading rows. It is enforcing a specific public catalog read contract with stable pagination semantics.
