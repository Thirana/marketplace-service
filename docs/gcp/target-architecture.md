# Target Architecture

## Scope

This note explains the recommended production architecture for this repository on Google Cloud.

The focus is the service layout, the role of each managed component, and the reasoning behind the design.

## Recommended Platform Shape

The recommended deployment model uses the following managed services:

1. GitHub as the source repository
2. Cloud Build for build and release automation
3. Artifact Registry for container image storage
4. Cloud Run for the API runtime
5. Cloud Run Job for schema migrations
6. Cloud SQL for PostgreSQL
7. Secret Manager for sensitive values
8. External Application Load Balancer for public ingress
9. serverless NEG to connect the load balancer to Cloud Run

This is a production-style design, but it stays intentionally lightweight. The service is small enough that GKE, managed VMs, and more elaborate deployment stacks would add more operational work than value.

## Why Cloud Run Is The Right Runtime

Cloud Run is a strong fit for this backend because the application is already stateless at the HTTP tier.

The API:

1. reads its runtime configuration from environment variables
2. exposes clear health endpoints
3. depends on PostgreSQL rather than local disk
4. does not require long-running background workers inside the web process

That makes it well suited to a managed container runtime that scales revisions cleanly and keeps the deployment model simple.

## Why Cloud SQL Is The Right Database Choice

This repository is built around PostgreSQL and expects a normal relational database with transaction support, row locking, and migration-managed schema changes.

Cloud SQL is the natural choice because it keeps the database operational model aligned with the codebase:

1. PostgreSQL remains the database engine
2. TypeORM migrations remain the schema control mechanism
3. the service still uses standard connection settings through `DB_*` variables

This avoids the overhead of running PostgreSQL ourselves while preserving the transactional behavior the application depends on.

## Why Artifact Registry Is Included

Artifact Registry stores the built application image that Cloud Run executes.

It belongs in the architecture for two reasons:

1. it gives Cloud Build a clear destination for versioned images
2. it separates build output from runtime deployment

That separation matters because it gives the deployment flow a stable artifact boundary. The image that passed CI is the image that gets deployed.

## Why Secret Manager Is Included

This application already treats secrets seriously. It validates configuration early and avoids hardcoded sensitive values.

Secret Manager is therefore the right production counterpart for:

1. `ADMIN_API_KEY`
2. `DB_PASSWORD`
3. Firebase credentials

Using Secret Manager keeps sensitive values out of source control and out of plain environment files shared manually between people.

## Why The Load Balancer Is Included

Cloud Run can expose a public URL by itself, but the load balancer still makes sense here.

It gives the deployment plan:

1. a clean public HTTPS entry point
2. support for a custom domain and managed TLS
3. a place to attach edge controls later
4. a way to keep Cloud Run ingress restricted so traffic does not bypass the intended frontend path

For an assessment project, this is a good middle ground. It shows production awareness without pushing the design toward heavy infrastructure.

## Why Cloud Run Ingress Should Be Restricted

The recommended setting is `internal-and-cloud-load-balancing`.

That matters because once a load balancer is introduced, the public architecture should be consistent. If Cloud Run remains directly reachable from the public internet, external requests can bypass the load balancer path and any controls attached there.

Restricting ingress makes the network story cleaner:

1. public traffic enters through the load balancer
2. the load balancer forwards to Cloud Run through the serverless backend
3. the Cloud Run service is not treated as a second public entry point

## Request Path

The public request path should work like this:

1. a client sends an HTTPS request to the application domain
2. the domain points to the external Application Load Balancer
3. the load balancer terminates TLS
4. the serverless NEG routes traffic to the Cloud Run service
5. Cloud Run handles the request
6. Cloud Run talks to Cloud SQL when database access is needed
7. Cloud Run reads secrets through environment and secret bindings configured at deployment time
8. if notification delivery is enabled, the application talks to Firebase after the order transaction commits

This is straightforward to explain and straightforward to operate.

## Component Interaction

At a high level, the production system would look like this:

1. GitHub stores the source code
2. Cloud Build reacts to new commits on the production branch
3. Artifact Registry stores the release image
4. Cloud Run serves the API from that image
5. Cloud Run Job runs schema migrations from the same release image
6. Cloud SQL provides PostgreSQL
7. Secret Manager provides sensitive runtime values
8. the external load balancer fronts the service for public traffic
9. Firebase remains an external downstream dependency for push notification delivery

## Region Strategy

For a first production deployment, one primary region is enough.

The right region should be chosen based on expected users and operational constraints. The important part is consistency:

1. Cloud Run service and migration job should live in the same region
2. Cloud SQL should be provisioned in a compatible nearby region
3. Artifact Registry and build settings should align with that deployment region where practical

Multi-region traffic routing can be treated as future work rather than part of the initial deployment plan.

## Architecture Summary

The recommended GCP shape is intentionally managed, direct, and easy to justify:

1. Cloud Run for compute
2. Cloud SQL for PostgreSQL
3. Artifact Registry for images
4. Secret Manager for secrets
5. Cloud Build for releases
6. Application Load Balancer for public ingress

It fits the current application well and keeps the deployment story strong without pretending the project needs more infrastructure than it actually does.

## References

1. https://cloud.google.com/run/docs
2. https://cloud.google.com/artifact-registry/docs/integrate-cloud-run
3. https://cloud.google.com/sql/docs/postgres/connect-run
4. https://cloud.google.com/load-balancing/docs/https/setting-up-https-serverless
5. https://cloud.google.com/run/docs/securing/ingress
