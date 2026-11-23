# Handoff: Code Maintenance

Status: Ready for review; local work complete, live verification pending.
Updated: 2026-11-22. Baseline HEAD: `f180c32`.
[Spec](spec.md) · [Plan](plan.md) · [Tasks](tasks.md) · [Audit evidence](audit.md)

## Delivered

- Private MfeRemotesModule owns the existing thin AppController/cohesive AppService
  and HttpModule dependency. Root module composes features; no cycles/exports,
  persistence, DTO/route/auth or generated-contract changes.
- One native structured `mfe_remotes_fetch` success/failure event per operation,
  request AsyncLocalStorage, independent operation UUID and safe bounded fields.
  Incoming IDs ignored; no credentials or new IDs forwarded to upstream.
- Credential-bearing Axios exceptions normalized internally to the unchanged
  generic HTTP 500 body. Null/missing owner payloads retain previous failure
  behavior; explicit Nest HTTP exceptions and other data remain pass-through.
- Pinned Husky/lint-staged, lockfile additions, manifest-contained guarded prepare,
  staged-only Prettier, generated/output/vendor exclusions, non-mutating lint /
  format commands and reusable CI validation required before deployment.
- Actual public-route, failure/redaction/concurrency regressions replace stale
  starter e2e; persistent disposable-install/hook regression script added.
- Updated architecture, development, observability, plan, task and entry-point docs.

## Acceptance evidence

| Acceptance | Actual local evidence                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-001     | Source-backed audit; 8 characterization cases before refactor, 13 final BFF HTTP/logging cases; identical routes/data/credential/timeout/error/health policy                        |
| AC-002     | Real fixture commits format staged source, preserve exact partial/unstaged changes, block syntax-error commits with rollback; formatting violation rejected without mutation        |
| AC-003     | Real clean developer, CI, package-only/no-Git, production `--omit=dev`, and `HUSKY=0` installs pass; hooks enabled only for developer fixture                                       |
| AC-004     | Native stdout/stderr JSON parsed; enabled levels/context/nested `message` fields, redaction canaries, out-of-order concurrent isolation, non-HTTP IDs, quiet GET/HEAD health tested |
| AC-005     | 5 unit + 13 BFF e2e tests pass, no skipped cases; build, lint:check, format:check, maintenance fixtures, diff whitespace check pass                                                 |

Exact commands/results are in [audit.md](audit.md). Local Node was 24.9.0 /
npm 11.6.0. Lint has zero errors and the pre-existing bootstrap floating-promise
warning. The baseline missing cookie-parser type error is resolved; obsolete root
e2e failure is replaced, not hidden. No blanket old-source/docs formatting occurred.
Legacy Markdown is staged-formatted but is not a new whole-repository CI baseline.

## External-owner handoffs and remaining risks

1. **Maintainer/CI owner:** review and run the configured validation workflow on
   supported Node 22.23.5 Linux. It was not remotely triggered here. Branch
   protection configuration, if desired, remains owner-managed.
2. **Container owner:** when a Docker daemon is available, run `docker build -t
ngx-workshop-bff:maintenance-check .` in this checkout, then an isolated runtime
   heartbeat check. CLI could not connect to the local daemon. Package-only/no-Git
   lifecycle was actually installed/tested, but is not an Alpine build claim.
3. **MFE orchestrator owner:** exercise the existing read-only owner API through
   the BFF in an authorized disposable integration environment; confirm response
   compatibility and failure behavior. Tests used an Axios adapter, not live
   routing/readiness. No new producer/consumer contract or release is required.
4. **Infrastructure owner (`nginx-ngx-workshop.io/ops/grafana`):** after an authorized
   rollout, verify Alloy receives BFF JSON and Grafana can extract `message.event`,
   `message.outcome` and `message.requestId` using the existing service selector.
   Check one successful/failed remote-fetch operation, correlation to its HTTP
   record and absence of repetitive health access logs. Follow the pipeline in
   [observability](../../docs/observability.md). Live receipt/collector labels were
   not verified locally; ingestion tokens remain host-owned. No collector/token
   changes or direct Grafana SDK were introduced.

Constitution rechecked: owner HTTP boundary, no domain storage, explicit private
module/DI, public access/data/failure compatibility, native safe operations,
meaningful local verification and repository-local evidence all retained.
There is no framework/runtime migration. Async context is local, not distributed
tracing; unexpected non-Axios errors retain existing Nest handling.

## Next action

Review the working-tree changes and perform the external checks above. No next
implementation feature is selected. Changes are persistent and uncommitted;
original untracked workflow/context setup was preserved. Only disposable test
fixtures were committed, and they were removed. Nothing was pushed, published
or deployed from this checkout.
