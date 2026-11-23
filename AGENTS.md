# Agent entry point — service-bff-ngx-workshop

This repository owns browser-facing backend aggregation and upstream routing. Work from this checkout; sibling source is
not required.

Read [.specify/memory/constitution.md](.specify/memory/constitution.md),
[architecture](docs/architecture.md), [development](docs/development.md),
[workflow](.specify/README.md) and the [feature index](specs/README.md) before edits.

- Inspect source and git status; preserve unrelated work and historical specs.
- Keep feature spec, plan, tasks and handoff aligned; mark complete with evidence.
- Preserve public contracts and access policies. Generate contracts from source.
- Keep controllers thin, providers cohesive and module exports intentional.
- Use owner-service APIs; do not couple to another service's collections.
- Keep transport adaptation and upstream calls explicit; do not absorb domain persistence into the BFF. Preserve credential forwarding policy, upstream timeouts, error mapping and response shape.
- Reuse existing structured logging; read [observability](docs/observability.md).
- Verify changed behavior and distinguish local tests from live integration.
- Resolve routine choices; ask only for consequential missing decisions.

This is a Spec Kit-inspired Markdown setup, not an installed Spec Kit CLI.

## Selected work: Code Maintenance

The selected work is [Code Maintenance](specs/001-code-maintenance/spec.md) (local verification complete; ready for review).
Read its [plan](specs/001-code-maintenance/plan.md), [tasks](specs/001-code-maintenance/tasks.md) and
[handoff](specs/001-code-maintenance/handoff.md). Read recorded evidence; retain older unfinished
feature records without treating them as the next task. The requested work covers
NestJS module/domain boundaries, thin controllers, cohesive services, Prettier
with Husky/lint-staged, CI checks and safe domain logging through existing
observability. Maintenance is implemented with local evidence. Actual Docker-image
and live upstream/Grafana checks remain external verification; no next implementation
task has been selected.

Current deployment policy: [deployment-workflows](docs/deployment-workflows.md). Automatic main delivery verifies/deploys; npm publication is manual only. This supersedes older automatic-publishing instructions.
