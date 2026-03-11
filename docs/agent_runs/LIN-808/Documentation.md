# Documentation.md (Status / audit log)

## Current status
- Now: LIN-808 implementation completed locally; TypeScript validation passed and Rust validation remains blocked by linker constraints.
- Next: Resolve Rust linker/toolchain gap in the environment, then prepare PR.

## Decisions
- `theme` value set is fixed to `dark | light`.
- Scope includes backend API and frontend API client contract only.
- `UserAppearance` save flow remains out of scope for this issue.
- Existing `/users/me/profile` contract is extended additively with `theme`; `display_name` / `status_text` / `avatar_key` semantics stay unchanged.
- no-data client maps persisted theme state through `settings-store`, coercing non-persistent `system` to the existing runtime fallback `dark`.

## How to run / demo
- 1. `GET /users/me/profile` returns `theme` alongside the existing profile fields.
- 2. `PATCH /users/me/profile` accepts `"theme":"dark"` or `"theme":"light"`.
- 3. TypeScript API client `getMyProfile` / `updateMyProfile` now read and write `theme`.
- 4. Theme-only patch example: `{"theme":"light"}`.
- 5. TypeScript verification:
  - `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/features/settings/ui/user/user-profile.test.tsx`
  - `cd typescript && npm run typecheck`

## Known issues / follow-ups
- `UserAppearance` still contains non-persistent theme candidates (`ash`, `onyx`); this issue does not connect them to the API.
- Rust validation commands are blocked in this environment because the host lacks a usable system linker / glibc link setup for cargo. `CARGO_TARGET_DIR=/tmp` removed the previous cross-device write failure, but `cargo test` / `clippy` still fail during link with `rust-lld` (`stat64` / `fstat64` unresolved).
- TypeScript test execution emits existing React `act(...)` warnings in `user-profile.test.tsx`, but the test suite passes.

## Validation results
- `cd rust && cargo fmt --all --check`: pass
- `cd typescript && npm install`: pass
- `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/features/settings/ui/user/user-profile.test.tsx`: pass (`33` tests passed; existing `act(...)` warnings only)
- `cd typescript && npm run typecheck`: pass
- `cd rust && CARGO_TARGET_DIR=/tmp/linklynx-rust-target cargo test -p linklynx_backend --locked profile::tests`: failed due linker (`cc` missing / later `rust-lld` unresolved glibc symbols)
- `cd rust && CARGO_TARGET_DIR=/tmp/linklynx-rust-target cargo test -p linklynx_backend --locked my_profile`: failed due linker (`cc` missing / later `rust-lld` unresolved glibc symbols)
- `CARGO_TARGET_DIR=/tmp/linklynx-rust-target ... make rust-lint`: failed due Rust linker environment
- `CARGO_TARGET_DIR=/tmp/linklynx-rust-target ... make validate`: failed in Python tool bootstrap (`python -m pip` missing) after TypeScript format step; Rust validation also remains blocked by linker environment

## Review gate results
- `reviewer`: pass, no blocking findings reported.
- `reviewer_ui_guard`: pass, `typescript/src/**` diff present so UI review required.
- `reviewer_ui`: pass, no blocking findings reported.

## Runtime smoke
- skipped: contract/client-only change set in the current environment, and prerequisite runtime/tooling validation is already blocked by missing compiler / frontend dependencies.
