# CI/CD And Release Flow

## Scope

This note explains how code should move from GitHub to production on Google Cloud.

The focus is the release path, not the runtime architecture itself.

## Recommended Delivery Model

The recommended CI/CD flow uses:

1. GitHub as the source repository
2. Cloud Build trigger on the production branch
3. Google Cloud Buildpacks as the default image build approach
4. Artifact Registry as the image destination
5. Cloud Run Job for migrations
6. Cloud Run for the application deployment

This design keeps the release path close to Google Cloud's native workflow and avoids maintaining a separate deployment toolchain for a relatively small service.

## Why Cloud Build Is The Right CI/CD Choice Here

Cloud Build is a strong fit for this service because it keeps the release path close to the runtime platform.

The application is designed as a small containerized HTTP service with a managed PostgreSQL dependency, explicit health checks, and a straightforward build pipeline. Cloud Build works well with that shape because it can validate the code, produce the release image, publish it to Artifact Registry, and deploy it to Cloud Run without introducing a second CI/CD stack that has to be maintained separately from the target platform.

It also fits the current repository state. The codebase already follows standard Node and NestJS build conventions, but it does not yet include a custom container build setup or dedicated deployment automation. Cloud Build provides a clean path from source to runtime while still leaving room for a more customized pipeline later if operational needs grow.

## Why Buildpacks Are The Recommended Default

Buildpacks are the right documented default because this codebase already matches the shape they expect:

1. standard `package.json` scripts
2. NestJS build output in `dist/`
3. no native build tooling
4. no existing container file that must be preserved

That keeps the initial plan simple. If stricter runtime control is needed later, a Dockerfile can be introduced as a deliberate hardening step.

## Recommended Pipeline Stages

The release pipeline should perform these stages in order:

1. pull the repository source from GitHub
2. install dependencies
3. run `npm run lint`
4. run `npm run build`
5. run the relevant automated tests
6. build the release image
7. push the image to Artifact Registry
8. execute the migration Cloud Run Job using the release image
9. deploy the new image to the Cloud Run service

That order is important. It keeps validation, artifact creation, schema change, and runtime deployment clearly separated.

## Why Migrations Should Run In A Cloud Run Job

This application depends on migration managed schema changes and treats database correctness seriously.

Running migrations in a dedicated Cloud Run Job is the cleaner production model because:

1. API startup stays focused on serving requests
2. schema changes remain explicit and operationally visible
3. failed migrations stop the release before the new API revision is promoted
4. migration logs become easier to isolate and inspect

## Important Repo Specific Points

The current repository only contains local migration scripts aimed at development workflows.

That means a real implementation need to add one of these before production rollout:

1. a compiled migration entrypoint that can run from the release image
2. a small dedicated migration command designed for Cloud Run Job execution

This note intentionally treats that as future planned release engineering work, not as something that already exists in the repository.

## Release Behavior

The intended release behavior should look like this:

1. a commit lands on the production branch
2. Cloud Build trigger starts automatically
3. the pipeline validates the code
4. the pipeline produces a versioned release image
5. the migration job runs against Cloud SQL
6. if the migration job succeeds, Cloud Run deploys a new revision
7. Cloud Run health checks determine whether that revision becomes the serving revision

That gives the deployment path a sensible safety boundary. Database changes happen before the new API revision is asked to handle traffic.

## Rollback Strategy

For the application layer, rollback is straightforward:

1. redeploy the previous image or previous Cloud Run revision

For the database layer, rollback requires more care:

1. not every schema change is trivially reversible
2. some migration failures will require manual judgment

That is a realistic tradeoff for a migration-based service.

## Branch And Trigger Model

For a small production setup, the deployment branch can remain simple.

Recommended model:

1. feature work happens on feature branches
2. pull requests are reviewed before merge
3. merge to `main` triggers the production pipeline

If a staging environment is introduced later, the same basic model can be extended. It does not need to be part of the initial assignment plan.

## References

1. https://cloud.google.com/run/docs/continuous-deployment-with-cloud-build
2. https://cloud.google.com/run/docs/quickstarts/deploy-continuously
3. https://cloud.google.com/build/docs/automating-builds/create-manage-triggers
4. https://cloud.google.com/artifact-registry/docs/integrate-cloud-run
5. https://cloud.google.com/run/docs/create-jobs
6. https://cloud.google.com/run/docs/execute/jobs
