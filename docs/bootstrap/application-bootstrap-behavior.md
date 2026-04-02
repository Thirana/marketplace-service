# Application Bootstrap Behavior

## Scope

This note summarizes the runtime bootstrap behavior implemented by:

- `src/main.ts`
- `src/app.module.ts`
- `src/app.setup.ts`
- `src/config/index.ts`
- `src/config/env.validation.ts`
- `src/database/database.module.ts`
- `src/database/typeorm.config.ts`
- `src/swagger.setup.ts`

The focus is startup behavior, initialization order, and the operational guarantees created by that startup path.

## Bootstrap Sequence

The process starts in `src/main.ts`.

`bootstrap()` performs these steps in order:

- create the Nest application with `NestFactory.create(AppModule, { bufferLogs: true })`
- pass the app through `configureApp(...)`
- resolve `appConfig`
- register Swagger
- call `app.listen(config.port)`

That means the process does not start accepting traffic until the application container, shared runtime pipeline, and infrastructure modules are already initialized.

## Application Composition

`src/app.module.ts` is the composition root.

It wires:

- `ConfigModule.forRoot(...)`
- `WinstonModule.forRootAsync(...)`
- `DatabaseModule`
- feature modules for health, products, orders, and notifications

This is important because bootstrap behavior is mostly determined by module initialization order and dependency resolution, not by ad hoc startup code scattered across the codebase.

## Configuration Loading and Validation

`ConfigModule.forRoot(...)` is global and cached.

Its startup behavior has three important parts:

1. `load: configFactories`
2. `validate: validateEnv`
3. global availability through Nest DI

`src/config/index.ts` groups configuration into typed factories for app, database, logging, Firebase, and admin settings.

`src/config/env.validation.ts` performs fail-fast validation before the application is considered bootstrapped.

Current validation behavior includes:

- defaulting `PORT` and `NODE_ENV`
- port range validation
- log level validation
- required DB and admin settings validation
- grouped Firebase credential validation
- normalization of `FIREBASE_PRIVATE_KEY` by converting escaped newlines

Operational effect:

- partial or invalid environment configuration stops startup immediately
- misconfiguration is detected before the app starts listening

## Logger Initialization

`WinstonModule.forRootAsync(...)` initializes the structured logger during bootstrap using `createWinstonOptions`.

`src/app.setup.ts` then resolves `WINSTON_MODULE_NEST_PROVIDER` and calls `app.useLogger(...)`.

This creates one logging pipeline for:

- Nest system logs
- request lifecycle logs
- exception logs
- domain event logs

Using `bufferLogs: true` in `NestFactory.create(...)` prevents early framework logs from being emitted before the structured logger is ready.

## Database Initialization

`DatabaseModule` initializes TypeORM through `TypeOrmModule.forRootAsync(...)`.

The actual connection settings come from `buildTypeOrmModuleOptions(...)` in `src/database/typeorm.config.ts`.

Important DB startup choices:

- PostgreSQL is the required runtime database
- entities and migrations are resolved explicitly
- `synchronize` is disabled
- runtime and migration configuration share the same base options
- `retryAttempts` is `1`
- `retryDelay` is `0`

Operational effect:

- DB connectivity is treated as a startup requirement
- the app does not degrade into a partially alive state without a database
- if PostgreSQL is unavailable, bootstrap fails and `app.listen(...)` is never reached

## Shared Runtime Pipeline

After Nest application creation, `configureApp(...)` applies the shared runtime pipeline.

That includes:

- `app.useLogger(...)`
- URI versioning with `VersioningType.URI`
- `requestIdMiddleware`
- global `ValidationPipe`
- `RequestLoggingInterceptor`
- `AppExceptionFilter`
- shutdown hooks

This establishes the runtime contract before the app accepts requests.

### Request ID middleware

`requestIdMiddleware` attaches or preserves `x-request-id`.

Operational effect:

- every request can be correlated across logs
- request IDs are available before controllers or services execute

### Global validation

The global `ValidationPipe` runs with:

- `whitelist: true`
- `forbidNonWhitelisted: true`
- `transform: true`

Implicit conversion is not enabled globally at the request boundary.

Operational effect:

- invalid request shapes are rejected consistently
- unknown fields are blocked
- request contracts are enforced centrally

### Request logging interceptor

`RequestLoggingInterceptor` emits one structured completion log per request with method, path, status code, duration, and request ID.

Operational effect:

- latency and outcome are observable for every completed request

### Global exception filter

`AppExceptionFilter` normalizes error responses and logs structured failure details.

Operational effect:

- client-facing error shape stays consistent
- operational logs include request context and error classification

### Shutdown hooks

`app.enableShutdownHooks()` enables graceful response to termination signals.

Operational effect:

- cleaner behavior during container shutdown, local restarts, and orchestrated stop events

## Swagger Registration

`src/swagger.setup.ts` registers the OpenAPI document after the application pipeline is configured but before the server starts listening.

This keeps runtime concerns and API discovery aligned:

- versioned routes are already registered
- API key security metadata is already attached
- the generated document reflects the actual route surface

## Fail-Fast Startup Behavior

Bootstrap failure handling is centralized in the `bootstrap().catch(...)` block in `src/main.ts`.

Current behavior:

- convert the failure into a logged startup error
- emit stack details when available
- exit the process with code `1`

This is an intentional fail-fast model.

The application does not try to continue in these cases:

- invalid environment configuration
- failed DI/module initialization
- failed database connection

## Startup Guarantees Created by This Design

Once the process begins listening on the configured port, the following assumptions hold:

- environment configuration passed validation
- structured logging is active
- the database connection initialized successfully
- request correlation is enabled
- global validation is active
- exception normalization is active
- URI versioning is active
- Swagger is registered

This gives the application a strong startup contract: traffic is only accepted after the platform layer is fully initialized.
