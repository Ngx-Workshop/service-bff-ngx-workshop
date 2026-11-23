# Code Maintenance audit

Inspected 2026-11-22 at HEAD `f180c32`. Initial worktree contained only untracked
workflow/context setup (`AGENTS.md`, `.github/copilot-instructions.md`,
`.github/prompts/`, `.specify/`, context docs and `specs/`). Preserve that work.
The parent entry-point paths do not exist; repository-local instructions apply.
No older feature records exist in this checkout.

## T001 baseline evidence

Local Node `v24.9.0`, npm `11.6.0`; installed Nest common `11.1.3`,
TypeScript `5.8.3`, Prettier `3.6.2`. Docker targets pinned Node 22.23.5 Alpine.

| Command                                                                                                     | Actual result                                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm test -- --runInBand`                                                                                   | PASS, 1 suite / 5 observability tests                                                                                    |
| `npm run test:e2e -- --runInBand`                                                                           | FAIL, stale `/` expects starter Hello World, actual 404                                                                  |
| `npm run build`                                                                                             | PASS                                                                                                                     |
| `npx --no-install eslint "{src,test}/**/*.ts"`                                                              | FAIL, `src/main.ts:15` unsafe cookie-parser call (missing types); existing floating bootstrap promise warning at line 22 |
| `npx --no-install prettier --check "src/**/*.ts" "test/**/*.ts"`                                            | PASS                                                                                                                     |
| `npx --no-install prettier --check package.json eslint.config.mjs .prettierrc .github/workflows/deploy.yml` | FAIL, only `eslint.config.mjs` drift                                                                                     |

No live upstream requests, deployments or Grafana checks were made. npm emits an
existing user-config warning about `scripts-prepend-node-path`.

## T002 source-backed dependency/contract inventory

- `src/app.module.ts`: composition root imports ConfigModule (global environment
  loading), ObservabilityModule and HttpModule; owns AppController/AppService.
  There are no cycles, duplicate registrations, persistence models or database
  calls. Installed mongoose/auth dependencies are not runtime registrations;
  dependency removal is outside this task.
- `src/app.controller.ts`: already thin; anonymous `GET /mfe-remotes` delegates
  to AppService. No DTO inputs, guards, credential forwarding, query/body use,
  Swagger generator or owned generated contract. Response type comes from
  `@tmdjr/ngx-mfe-orchestrator-contracts`, used as a type only.
- `src/app.service.ts`: one cohesive use case; injected HttpService calls
  `${process.env.MFE_ORCHESTRATOR_URL}/mfe-remotes` with no request config.
  RxJS maps Axios data without transformation. No explicit timeout/retries/cache;
  HttpService defaults and cancellation must remain. Environment remains read per
  invocation. No config validation is added because that would change startup.
- `src/main.ts`: JSON logger, HTTP middleware, cookie parsing, global whitelist /
  forbidNonWhitelisted validation, shutdown hooks and port binding. No runtime
  input DTO exists on the BFF endpoint.
- `src/observability/observability.module.ts`: imports TerminusModule, owns
  HealthController, exports nothing. Anonymous non-cached GET/HEAD heartbeat is
  liveness only. Middleware logs safe route templates with generated local IDs,
  but has no async context. The logger disables debug, so current domain debug
  events are not emitted in production. No safe upstream failure event exists.
- `Dockerfile`: package-only `npm ci` precedes source copy; `.dockerignore` removes
  Git. Prepare must work without installer source or devDependencies.
- `.github/workflows/deploy.yml`: deployment only, no validation gate.
- `test/app.e2e-spec.ts`: stale starter route and missing application cleanup.
  Replace with real isolated HTTP characterization before refactoring.

## Prioritized scope and compatibility

1. **P1 verification:** characterize actual success/pass-through, ignored input,
   anonymous access, absent credential forwarding, unknown routes, health and
   upstream failure mapping using an Axios adapter, not a live owner service.
2. **P1 observability:** one bounded terminal operation event, log success/error
   at enabled levels, AsyncLocalStorage request context and local operation ID
   outside HTTP. Preserve locally generated IDs; never trust inbound IDs or
   forward a new header. Axios failures otherwise reach Nest's raw exception
   logger: sanitize only their generic HTTP 500 representation at the service
   boundary, retaining existing response shape; preserve Nest HTTP exceptions.
3. **P2 boundaries:** move registration, not source/public route names, into a
   private MfeRemotesModule importing HttpModule. AppController/AppService remain
   thin/cohesive and unexported. No extra repository/client abstraction needed.
4. **P2 tooling:** pinned Husky/lint-staged, inline guarded prepare for Docker
   ordering, staged local Prettier without network fallback, explicit generated
   ignores, non-mutating gates and clean-install/partial-staging fixtures.
   Existing TS formatting is clean; add config/script checks, format only touched
   files. Do not impose a legacy documentation-wide reformat.
5. **P2 lint prerequisite:** add cookie-parser types so the new CI gate can pass;
   leave unrelated bootstrap promise warning visible.

All constitution principles apply without deviation: explicit owner API, no
storage, constructor injection, acyclic minimal modules, unchanged routes/auth /
data / timeout / transport, native safe logging, local evidence and external-owner
handoff. Internal Axios error objects may be normalized solely to avoid raw
credential-bearing Nest logs; externally they remain the same generic 500.

## T003 pre-refactor characterization

`npm run test:e2e -- --runInBand`: PASS, 8 cases against the unchanged
AppModule/AppService. Covers anonymous success, verbatim owner response, no
credential/query/correlation forwarding, Axios default timeout 0, upstream
401/404/409/503 and timeout all mapping to generic 500, ignored unknown query,
unsupported write/root routes, GET/HEAD health without upstream calls. There is
no BFF access-denial/input DTO/storage conflict policy to invent.

## T004-T008 implementation and verification

- Feature registration moved to private `src/mfe-remotes.module.ts`, importing
  HttpModule explicitly. Controller/service locations, route names and public
  response type remain unchanged; no providers are exported.
- `src/observability/observability.ts` establishes AsyncLocalStorage around
  downstream HTTP execution. Existing generated response IDs and health exclusion
  remain; inbound IDs are always ignored, including valid UUIDs. No new upstream
  header is forwarded. Non-HTTP operations have independent operation IDs.
- AppService emits one enabled-level structured outcome with fixed safe fields.
  Axios errors are sanitized to exactly `{statusCode: 500, message:
"Internal server error"}`; no raw config/error/body reaches Nest's error dump.
  JSON canaries include inbound auth/cookies/query/IDs and upstream basic auth,
  authorization, URL/query, error message and response content.
- A targeted added regression caught a real refactor edge: removing debug
  `.length` access had changed null/undefined payloads from 500 to 200. The service
  now explicitly preserves their generic 500; both regressions pass. An adapter
  rejecting a Nest ConflictException also preserves its actual Axios-adapted 409
  response (Axios adds `headers: {}`), without inventing a BFF conflict policy.
- Prettier style unchanged; only touched TS/tooling/workflows formatted. Added
  pinned Husky 9.1.7, lint-staged 15.5.2 and cookie-parser types 1.4.9; lockfile
  contains additions only, no upgrades/removals. Inline guarded prepare needs no
  source script during package-only Docker install. Errors are not masked.
- CI validation runs on PRs/manual invocation and as deployment's prerequisite.
  No GitHub workflow was triggered by this task. Setup-node action pin resolved
  from `gh api repos/actions/setup-node/git/ref/tags/v6`; Docker/CI runtime version
  remains 22.23.5.
- `npm run test:maintenance` passed twice, finally after strengthening byte-exact
  partial-staging preservation. It performs real clean installs of all five
  fixture cases; normal developer hooks enabled, CI/no-Git/production/disabled
  hooks skipped. Temporary Git commits are fixture-only and deleted afterward.
  It verifies supported staged formatting, exact partial/unstaged preservation,
  syntax-error hook rejection with unchanged HEAD/index restoration, non-mutating
  negative formatting gate and generated-file exclusions.

## T009 final evidence

Final commands on 2026-11-22:

| Command                           | Result                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| `npm test -- --runInBand`         | PASS: 1 suite, 5 tests                                          |
| `npm run test:e2e -- --runInBand` | PASS: 1 suite, 13 tests, none skipped                           |
| `npm run build`                   | PASS                                                            |
| `npm run lint:check`              | PASS: 0 errors, 1 unchanged bootstrap warning                   |
| `npm run format:check`            | PASS: source/test TS, MJS tooling, workflow YAML, named configs |
| `npm run test:maintenance`        | PASS: five clean `npm ci` cases plus hook/gate checks           |
| `git --no-pager diff --check`     | PASS                                                            |

Compatibility diff reviewed for module registration, HTTP/health behavior,
credential policy, failure mapping, scripts, lockfile scope and deployment gate.
No DTO/schema/auth/timeout changes, generated contract changes or persistence
access were introduced. No contract generation applies: the DTO remains imported
as a type from its external owner. Existing untracked workflow setup remains;
no real repository commit, push, deployment or publication was performed.

### Explicit external limits

Docker CLI is installed, but both `docker info` and `docker version` could not
reach the daemon at `/var/run/docker.sock`. A real package-only/no-Git install
passed locally, not an actual Alpine image build. All checks used Node 24.9.0;
Node 22.23.5 Linux execution is configured for CI but unrun here.
The Axios adapter is a test double; no live orchestrator availability was proven.
Local native JSON fields/levels and redaction are verified, not Alloy/Grafana
ingestion. Infrastructure credentials and collector configuration were untouched.
Owner actions are recorded in [handoff.md](handoff.md).
