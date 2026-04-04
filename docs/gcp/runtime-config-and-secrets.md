# Runtime Configuration And Secrets

## Scope

This note maps the current configuration model of this repository onto a Google Cloud deployment.

The focus is how the existing environment contract should be represented in Cloud Run, Cloud SQL, and Secret Manager.

## Why Configuration Matters In This Repository

This application validates its environment during startup and fails fast if critical values are missing or invalid.

That is important for deployment planning because configuration is not an afterthought here. If the database settings are wrong, the service should fail to start. If only part of the Firebase credential set is provided, startup validation should reject it.

## Core Environment Variables

The service currently depends on these main variables:

1. `PORT`
2. `NODE_ENV`
3. `DB_HOST`
4. `DB_PORT`
5. `DB_USERNAME`
6. `DB_PASSWORD`
7. `DB_NAME`
8. `LOG_LEVEL`
9. `ADMIN_API_KEY`
10. `FIREBASE_PROJECT_ID`
11. `FIREBASE_CLIENT_EMAIL`
12. `FIREBASE_PRIVATE_KEY`

Not all of them should be treated the same way in production.

## What Should Live In Secret Manager

The following values should be stored in Secret Manager:

1. `DB_PASSWORD`
2. `ADMIN_API_KEY`
3. `FIREBASE_PROJECT_ID`, if the team prefers to treat the Firebase project identifier as sensitive deployment metadata
4. `FIREBASE_CLIENT_EMAIL`
5. `FIREBASE_PRIVATE_KEY`

## What Can Stay As Plain Environment Variables

The following values can remain ordinary Cloud Run environment variables:

1. `NODE_ENV=production`
2. `LOG_LEVEL=info`
3. `DB_HOST`
4. `DB_PORT`
5. `DB_USERNAME`
6. `DB_NAME`

These are still operationally important, but they are not secrets in the same sense as passwords and keys.

## Cloud SQL Mapping For This Repository

This repository expects a discrete `DB_*` model rather than a single connection URL.

That means the GCP deployment should preserve this application contract instead of rewriting the app around a different configuration shape.

For Cloud Run to Cloud SQL, the documented recommendation is to use the Cloud SQL connection integration. In practice, for PostgreSQL, the service can be configured with a Unix socket path as the host.

The mapping would look like this conceptually:

1. `DB_HOST=/cloudsql/<INSTANCE_CONNECTION_NAME>`
2. `DB_PORT=5432`
3. `DB_USERNAME=<database-user>`
4. `DB_PASSWORD=<secret-reference>`
5. `DB_NAME=<database-name>`

That keeps the current application code intact while still using the Cloud Run and Cloud SQL integration that Google documents.

## Important Naming Detail

The application expects `DB_NAME`.

That matters because many cloud examples use names like `DB_DATABASE` or `DATABASE_URL`. This repository does not.

A production deployment should respect the current app contract rather than introducing misleading variable names in the documentation.

## `PORT` Handling

`PORT` does not need to be managed manually in the normal Cloud Run case.

Cloud Run injects `PORT`, and the application already reads `process.env.PORT`. That means the service is already aligned with the runtime model Cloud Run expects.

## Firebase Configuration Rule

Firebase configuration in this repository is grouped.

The current validation behavior expects all three of these:

1. `FIREBASE_PROJECT_ID`
2. `FIREBASE_CLIENT_EMAIL`
3. `FIREBASE_PRIVATE_KEY`

If any one of them is provided without the others, startup validation should fail.

This is worth documenting because it is easy to partially configure Firebase by mistake in a cloud environment.

## Secret Injection Style

For this application, environment based secret injection is the most natural fit because the code already reads runtime config through the Nest configuration layer.

Cloud Run supports both:

1. mounting secrets as files
2. exposing secrets as environment variables

For this repository, environment variables are the simpler documented choice. They align with the existing app behavior and reduce unnecessary translation between the platform and the codebase.

## Service Account Responsibilities

The Cloud Run service account should be narrowly scoped to what the application actually needs.

At a high level, it should be able to:

1. read required secrets from Secret Manager
2. connect to Cloud SQL
3. emit logs and metrics through normal Google Cloud service integration

It should not be granted broad project wide permissions without a clear reason.

The same principle applies to the migration job service account. It needs enough permission to run migrations against Cloud SQL and read the same required configuration, but it does not need broad administrative rights.

## References

1. https://cloud.google.com/sql/docs/postgres/connect-run
2. https://cloud.google.com/run/docs/configuring/services/secrets
3. https://cloud.google.com/run/docs
