# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: WS/auth surface hardening
- Acceptance criteria:
  - [ ] Query-ticket path is disabled by default and redacted
  - [ ] Missing origin is fail-close
  - [ ] Protected/auth CORS is allowlist-based
  - [ ] Pre-auth size and connection caps exist
  - [ ] Invalid token attempts are client-scoped and rate-limited
- Validation:
  - `cd rust && cargo test -p linklynx_backend main::`
  - `make rust-lint`

### M2: AuthZ boundary alignment
- Acceptance criteria:
  - [ ] `/users/me/dms` is no longer an implicit bypass
  - [ ] protected routes no longer depend on unsupported `RestPath` write fallback
  - [ ] `docs/AUTHZ_API_MATRIX.md` matches implementation
- Validation:
  - `cd rust && cargo test -p linklynx_backend authz::`
  - `make validate`

### M3: Dependency advisories
- Acceptance criteria:
  - [ ] frontend advisories addressed or documented
  - [ ] Python advisories addressed or documented
  - [ ] Rust advisories addressed or documented
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd rust && cargo audit`
  - `python -m pip_audit ...` or repo equivalent

### M4: Documentation and evidence
- Acceptance criteria:
  - [ ] Runbooks and traceability docs updated
  - [ ] Documentation.md records validations and remaining risks
- Validation:
  - `make validate`
