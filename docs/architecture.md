# Architecture — service-bff-ngx-workshop

Baseline inspected: `f180c32`; maintenance verified locally on 2026-11-22.

## Ownership

Browser-facing backend aggregation and upstream routing. Keep transport adaptation and upstream calls explicit; do not absorb domain persistence into the BFF. Preserve credential forwarding policy, upstream timeouts, error mapping and response shape.

## Verified dependency map

```text
AppModule
  -> ConfigModule.forRoot (global environment loading)
  -> ObservabilityModule -> TerminusModule -> HealthController
  -> MfeRemotesModule -> HttpModule
       AppController -> AppService -> HttpService -> owner-service HTTP API
```

[AppModule](../src/app.module.ts) is only the composition root.
[MfeRemotesModule](../src/mfe-remotes.module.ts) owns the browser-facing remote
discovery route and private providers, exports nothing, and imports its HTTP
dependency explicitly. Existing class/file names remain for compatibility.
[AppController](../src/app.controller.ts) is a thin transport delegate;
[AppService](../src/app.service.ts) performs the single RxJS use case.
[ObservabilityModule](../src/observability/observability.module.ts) owns heartbeat,
exports nothing, and does not become a global module.
There are no cycles, duplicate providers or registered persistence models.
Installed mongoose/auth packages do not imply active storage/auth providers.

## External boundaries

Anonymous `GET /mfe-remotes` calls
`${MFE_ORCHESTRATOR_URL}/mfe-remotes` and passes owner data through. Browser
credentials, queries and correlation headers are not forwarded. There are no
input DTOs or new access restrictions. The external contracts package is a type
dependency; no owned OpenAPI generator or public contract definition changed.
No database collection is accessed.

Environment is still read per invocation. Axios default timeout (0), cancellation,
no retries/cache and RxJS transport remain unchanged. Axios HTTP failures and
timeouts retain the generic 500 body; internal exceptions are sanitized so Nest
cannot print credential-bearing Axios config. Missing/null owner payloads still
fail with the same generic 500 rather than succeeding after removal of debug
logging. Other response data and explicit Nest HTTP exceptions remain pass-through.
No broader startup validation or dependency cleanup is included.

[Observability](observability.md) describes native JSON logging and local async
context. The anonymous GET/HEAD heartbeat remains dependency-free liveness.
[Audit](../specs/001-code-maintenance/audit.md) and
[handoff](../specs/001-code-maintenance/handoff.md) contain baseline findings and
local-versus-live verification limits; this is not a full security certification.

Generated deployment orchestration is centrally managed by the Node CLI; see [deployment-workflows](deployment-workflows.md).
