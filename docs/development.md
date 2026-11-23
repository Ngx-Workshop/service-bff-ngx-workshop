# Development — service-bff-ngx-workshop

Maintenance verified locally on 2026-11-22 against baseline `f180c32`.
Use `package-lock.json` and `npm ci`. Docker and CI target Node 22.23.5;
local evidence used Node 24.9.0 / npm 11.6.0, not the container runtime.
No framework/runtime upgrade is part of this maintenance.

## Commands

| Command                           | Purpose                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| `npm ci`                          | Restore locked dependencies; prepare enables local Husky hooks             |
| `npm run build`                   | Nest TypeScript build                                                      |
| `npm test -- --runInBand`         | Existing observability regression suite                                    |
| `npm run test:e2e -- --runInBand` | Actual BFF routes with isolated Axios adapter, no live upstream            |
| `npm run lint:check`              | Non-mutating TypeScript ESLint check                                       |
| `npm run format:check`            | Non-mutating source/test/tooling/workflow formatting check                 |
| `npm run test:maintenance`        | Disposable Git/clean-install fixtures; never changes this checkout's index |
| `npm run format`                  | Mutating source/test formatting; prefer explicit touched paths             |
| `npm run lint`                    | Existing mutating ESLint fixer; not a validation command                   |
| `npm run start:dev`               | Development watch mode                                                     |
| `npm run start:prod`              | Run built application                                                      |

Existing watch, coverage and debug scripts remain available.

## Staged formatting and installation

Pinned Husky 9.1.7 and lint-staged 15.5.2 run project-local Prettier from
[pre-commit](../.husky/pre-commit). Supported staged extensions are TS/JS/MJS/CJS,
JSON, Markdown and YAML. No package download or repository-wide fixer runs on
commit. Default lint-staged stash/hide/restore behavior preserves partial staging;
formatter failure blocks the commit and restores staged/unstaged state.

Prepare is intentionally self-contained in [package.json](../package.json):
Docker copies only manifests before `npm ci`. It skips CI, `HUSKY=0`, production,
missing Husky/devDependencies and no-Git contexts, and reports actual installer
errors instead of swallowing them. Existing install scripts are not disabled.
After a developer `npm ci`, `git config --get core.hooksPath` should be `.husky/_`.

[.prettierignore](../.prettierignore) excludes locked/generated contracts,
build/coverage output and vendored assets; ESLint excludes generated/output/vendor
paths too. TS source/test formatting was already clean at baseline. CI checks all
source/test TS, maintenance MJS scripts, workflow YAML and named package/formatter/
ESLint configs. Legacy Markdown is deliberately not a repository-wide CI baseline;
staged Markdown is still formatted. No blanket unrelated formatting was applied.

[Validation](../.github/workflows/validate.yml) runs checks on PRs, on manual
invocation and as a reusable prerequisite for deployment. It does not deploy or
need deployment credentials. Deployment cannot start before validation succeeds.

`npm run test:maintenance` makes isolated fixture commits (not repository commits)
and performs real clean `npm ci` installs for developer, CI, no-Git/package-only,
production `--omit=dev` and `HUSKY=0` cases. It requires network/cache availability
for locked packages and deletes its exact temporary fixtures even on failure.

## Runtime and verification limits

`MFE_ORCHESTRATOR_URL` identifies the owner-service base URL; `PORT` defaults to 3002. Configuration loading/startup policy is unchanged. Do not print or commit
environment credentials. Read [observability](observability.md) and existing
security/deployment docs before runtime changes.

Local runtime suites, build, format check and clean-install/hook fixtures pass.
Lint passes with the unchanged bootstrap floating-promise warning in
[main.ts](../src/main.ts); missing cookie-parser types were supplied so its prior
lint error is resolved. The obsolete starter e2e was replaced with real boundaries.
Docker CLI exists but its daemon is unreachable; package-only installation is
verified, an actual pinned-image build is not. CI is configured, not remotely run.
Live upstream and Grafana ingestion require external owners; no paid calls or
production writes were used. See [handoff](../specs/001-code-maintenance/handoff.md).

Deployment and npm publication now follow [deployment-workflows](deployment-workflows.md).
