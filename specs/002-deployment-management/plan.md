# Plan

Baseline HEAD: `e9c18a277343afc17947ae6da07f3e82c633ca3e`. Audit found jobs validate, deploy;
deploy prerequisites were `validate`.
Use the central Node CLI policy and reviewed service-specific job profile. Separate
validation from publication, make deploy need validate only, preserve transport
steps and existing contract/version semantics. Main-only guards protect mutation;
OIDC write permission belongs only to manual publish. Preserve domain/access rules;
no application/schema changes. Verify YAML parsing, event gates, source transport
comparison and CLI drift check. No live deployment verification is requested.
