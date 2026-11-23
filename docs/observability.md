# Service logging and heartbeat

This service uses native NestJS 11 `ConsoleLogger` JSON output to stdout/stderr, with `Logger` context for application events. No Angular logger or application-held Grafana credential is used. HTTP logs contain generated request ID, method, route template, status and duration; bodies, cookies, authorization headers, concrete identifiers and query strings are not logged by the middleware. Health polling is excluded from access logs. Avoid embedding secrets or personal search text in domain log messages.

## BFF domain events (2026-11-22)

`AppService` emits one `mfe_remotes_fetch` outcome per upstream subscription:
`log` for success, `error` for failure. It includes `outcome`, rounded monotonic
`durationMs`, a local UUID `operationId`, and the local `requestId` when invoked
inside HTTP. No URLs, upstream error objects/status texts, remote contents,
headers, bodies or counts derived from private content are logged. Axios failures
are converted to the pre-existing generic HTTP 500 body before Nest's exception
logger can dump Axios credentials/config. Explicit Nest HTTP exceptions keep
their response policy; missing/null owner payloads retain generic 500 behavior.
One operation event plus one access event is intentional boundary coverage, not
two dumps of the same exception. There are no per-item/start debug events.

The middleware uses AsyncLocalStorage to establish context around downstream
execution. It preserves the original locally generated `X-Request-ID` response
header. All incoming IDs, even valid UUIDs, are ignored rather than accepted,
logged or forwarded: there is no untrusted correlation input to validate. IDs are
not propagated to the owner service and do not claim distributed tracing.
Non-HTTP calls have an operation ID only. Async work deliberately started inside
HTTP inherits that context; there is no durable job context or trace collector.
Correlation IDs belong in log fields, never high-cardinality Loki labels.

Native Nest common 11.1.3 output is tested by parsing actual stdout/stderr.
Structured application fields are under `message`, not at the outer level:

```json
{
  "level": "log",
  "context": "AppService",
  "message": {
    "event": "mfe_remotes_fetch",
    "outcome": "success",
    "operationId": "00000000-0000-4000-8000-000000000001",
    "requestId": "00000000-0000-4000-8000-000000000002",
    "durationMs": 12
  }
}
```

Example omits native `pid`/`timestamp`; both remain in real output. After the
infrastructure-owned existing service selector, this LogQL pipeline extracts
the verified nested fields:

```logql
| json event="message.event", outcome="message.outcome", requestId="message.requestId", durationMs="message.durationMs"
| event="mfe_remotes_fetch"
| outcome="failure"
```

Remove the outcome filter for all operations; correlate access/domain records by
`message.requestId`. Collector service labels and live query results must be
confirmed by the infrastructure owner, not inferred from local tests.

Local verification: existing 5 observability cases plus 13 isolated BFF HTTP /
logging cases pass, including out-of-order concurrent completions, background
call context, canary credentials/content exclusion, native JSON levels/context,
failure redaction and quiet GET/HEAD health. Docker daemon and live upstream /
Grafana receipt are unavailable; no collector or ingestion credential was changed.

`GET /health` and HEAD return the anonymous operational Terminus heartbeat with `status: ok` and `heartbeat: up`, plus `Cache-Control: no-store`. This is liveness only; it does not claim MongoDB or upstream readiness. Existing business-route authentication remains enforced. The gateway's exact read-only heartbeat is the only exception to its normalized proxy-envelope requirement. The operational endpoint is excluded from business Swagger/contracts where that service generates them.

Docker probes `/health` every 30 seconds. Deployments bound each container's local JSON log files to 10 MiB × 3. Host Alloy discovers active service names and ships logs and private HTTP heartbeat probe metrics to Grafana Cloud stack `ivorytoffee195`. Collector configuration/dashboard lives in infrastructure owner `nginx-ngx-workshop.io/ops/grafana`; its ingestion token remains host-owned, scoped to logs/metrics write, and requires account authorization before activation. No production credential belongs in this repository.

Validation on 2026-11-21: the isolated observability HTTP suite passed (5 scenarios), build passed, Linux-targeted lockfile dry run passed. Guarded services additionally passed the anonymous-heartbeat/protected-business-route HTTP test. Gateway production ingress e2e passed (51 scenarios), including exact-path/method heartbeat boundaries. Gateway and publisher lint passed. Full existing unit suites passed except Backstage's unchanged Octokit ESM test-loader failure, reproduced on its pre-change HEAD. Uploader tests pass under its documented `npm test` command; its 10 optional cases remain skipped. Publisher persistence e2e cases require the isolated Mongo URI and remain skipped when unavailable. These are local checks, not evidence of Grafana ingestion or live deployment.

Live rollout correction (2026-11-21): health is explicitly public through the auth-client AuthType.None decorator where global authentication guards apply. The BFF legacy text /health handler is removed so only the Terminus JSON route owns that path. Regression HTTP tests include real authentication/role guards or the actual BFF controller.
