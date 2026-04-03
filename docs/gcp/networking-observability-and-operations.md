# Networking, Observability, And Operations

## Scope

This note explains how the deployed service should be exposed, observed, and operated on Google Cloud.

The focus is not infrastructure automation. It is the operational shape of the running system.

## Public Traffic Model

The recommended public entry point is an external Application Load Balancer with a serverless NEG backend pointing at Cloud Run.

This arrangement gives the deployment a clean network boundary:

1. the load balancer is the public HTTPS frontend
2. Cloud Run remains the managed application runtime
3. the serverless NEG connects the two cleanly

For a service of this size, that is enough infrastructure to look production-aware without becoming overly heavy.

## Why The Load Balancer Is Worth Including

Cloud Run can serve traffic directly, but the load balancer still improves the design.

It provides:

1. a stable public frontend
2. managed TLS termination
3. support for a custom domain
4. a future attachment point for edge protections

Just as important, it lets the architecture define one clear public path into the system rather than leaving both the load balancer and the default Cloud Run URL exposed as parallel public routes.

## Ingress Strategy

The Cloud Run service should be configured with ingress restricted to `internal-and-cloud-load-balancing`.

That keeps the public path disciplined:

1. users reach the domain through the load balancer
2. the load balancer forwards to Cloud Run
3. Cloud Run is not treated as an openly reachable alternative endpoint

This makes the security story cleaner and keeps future controls centered at the load balancer.

## TLS And Domain Handling

The load balancer should terminate HTTPS and use a Google-managed certificate for the service domain.

That is the most practical fit for an assessment-style deployment because it avoids manual certificate handling while still reflecting a proper production edge.

Operationally, the domain would point to the load balancer's public IP address, not directly to the Cloud Run URL.

## Health Endpoint Roles

This repository already exposes:

1. `/v1/health/live`
2. `/v1/health/ready`

They should not be treated as interchangeable.

`/v1/health/live` answers whether the application process is alive.

`/v1/health/ready` answers whether the service is ready to handle traffic, including database connectivity.

## Why Readiness Should Gate Deployment

The deployment health gate should be `/v1/health/ready`.

That is the right operational choice because this service is not useful without PostgreSQL. A revision that starts a process but cannot talk to the database should not be promoted as healthy.

Using readiness as the deployment gate aligns well with the application's fail-fast startup design and its database-backed behavior.

## Logging

The service already emits structured JSON logs with request IDs.

On GCP, those logs would flow into Cloud Logging naturally through the Cloud Run runtime. That gives the deployment an immediate observability benefit without changing the application's internal logging model.

This is a good fit because the application has already done the work of producing structured operational logs. The cloud platform simply becomes the collection and query layer.

## Monitoring

Cloud Monitoring is the natural place for the first operational dashboards and alerts.

A reasonable initial monitoring posture would include:

1. request error rate
2. request latency
3. container restart or failed revision signals
4. Cloud SQL availability and health
5. migration job failures

The plan does not need to prescribe full dashboards or alert policies in detail, but it should make clear where those concerns belong.

## Practical Operational Tradeoffs

This design intentionally favors low operational burden.

That gives clear advantages:

1. no server management
2. no Kubernetes control plane
3. straightforward release path
4. strong alignment with a small backend service

It also comes with tradeoffs:

1. less runtime control than VM or Kubernetes-based deployments
2. less infrastructure customization out of the box
3. some operational behaviors are shaped by managed platform constraints rather than application code alone

Those tradeoffs are reasonable for this repository.

## Current Operational Gaps

This note should be honest about what is not yet present in the repository.

At the moment:

1. there is no infrastructure-as-code checked into the repo
2. there is no committed Cloud Build configuration
3. there is no implemented Cloud Run migration job entrypoint

That does not weaken the deployment plan. It simply means the repository currently documents the target platform shape rather than implementing it.

## Future Hardening

If the service moved beyond assessment scope, these would be sensible next steps:

1. Cloud Armor in front of the load balancer
2. more explicit alerting and on-call style thresholds
3. secret rotation policy and version governance
4. stricter network controls and private connectivity refinements
5. infrastructure-as-code for repeatable environment provisioning

These are valid extensions, but they do not need to be treated as part of the first deployment plan.

## Operations Summary

The operational model should stay simple and coherent:

1. public traffic enters through the load balancer
2. Cloud Run serves the API
3. readiness is the deployment health gate
4. structured logs land in Cloud Logging
5. metrics and alerts belong in Cloud Monitoring

That is enough to describe a credible production posture without pretending the project has already grown into a more complex platform problem.

## References

1. https://cloud.google.com/load-balancing/docs/https/setting-up-https-serverless
2. https://cloud.google.com/run/docs/securing/ingress
3. https://cloud.google.com/run/docs
