# GCP Deployment Plan

## Scope

This document set describes a recommended production deployment model for this repository on Google Cloud.

It is a deployment plan only. Nothing in this note implies that the platform setup, CI/CD pipeline, or infrastructure is already implemented in this repository.

The recommendation uses:

1. GitHub as the source repository
2. Cloud Build as the CI/CD system
3. Artifact Registry for container images
4. Cloud Run for the API service
5. Cloud Run Job for database migrations
6. Cloud SQL for PostgreSQL
7. Secret Manager for sensitive configuration
8. External Application Load Balancer in front of Cloud Run

## Why This Shape Fits This Service

This repository is a small NestJS backend with a clean HTTP surface, strict environment validation, a PostgreSQL dependency, migration-based schema management, and health endpoints that already separate liveness from readiness.

That makes Cloud Run a strong fit. The service does not need VM management, Kubernetes orchestration, or a large platform control plane. It needs a predictable runtime, a managed database, a clean deployment path, and a reasonable story for networking, secrets, and release safety.

The surrounding GCP services fill those needs without turning the assignment into infrastructure work for its own sake.

## Document Index

The detailed plan is split into four focused notes:

1. `docs/gcp/target-architecture.md`
   Explains the deployed system shape and why each GCP service is part of it.

2. `docs/gcp/ci-cd-and-release-flow.md`
   Explains how code moves from GitHub to production using Cloud Build.

3. `docs/gcp/runtime-config-and-secrets.md`
   Maps this repository's current configuration model onto Cloud Run, Cloud SQL, and Secret Manager.

4. `docs/gcp/networking-observability-and-operations.md`
   Explains how traffic, health checks, logging, monitoring, and operational tradeoffs are handled.

## Recommended Outcome

The intended end state is simple:

1. developers push to GitHub
2. Cloud Build validates, builds, and publishes the application image
3. a migration job applies schema changes before the new application revision is promoted
4. Cloud Run serves the API
5. Cloud SQL provides the managed PostgreSQL backend
6. public traffic reaches Cloud Run through an external HTTPS load balancer

This gives the application a modern managed deployment target without introducing unnecessary platform complexity.

## References

Official Google Cloud documentation reviewed for this plan:

1. https://cloud.google.com/run/docs
2. https://cloud.google.com/run/docs/continuous-deployment-with-cloud-build
3. https://cloud.google.com/run/docs/quickstarts/deploy-continuously
4. https://cloud.google.com/artifact-registry/docs/integrate-cloud-run
5. https://cloud.google.com/sql/docs/postgres/connect-run
6. https://cloud.google.com/run/docs/configuring/services/secrets
7. https://cloud.google.com/run/docs/create-jobs
8. https://cloud.google.com/run/docs/execute/jobs
9. https://cloud.google.com/load-balancing/docs/https/setting-up-https-serverless
10. https://cloud.google.com/run/docs/securing/ingress
