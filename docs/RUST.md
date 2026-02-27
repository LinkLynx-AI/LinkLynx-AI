# Rust Coding Rules (Large-Scale Backend)

This document defines implementation-level coding rules only.
Operational rules (CI process, review process, dependency update workflow) are managed in separate documents.

## 1. Layer Boundaries and Dependency Direction

Dependency flow must be unidirectional:

```text
api -> domain <- infra
        ^
      shared
```

Rules:
- `domain` must not depend on external frameworks or I/O implementations (`axum`, `sqlx`, HTTP clients, etc.).
- I/O boundaries must be abstracted via traits, implemented in `infra`.
- Use cases belong in `domain`; `api` should focus on input/output mapping only.

```rust
use async_trait::async_trait;

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_id(&self, id: UserId) -> Result<Option<User>, DomainError>;
    async fn save(&self, user: &User) -> Result<(), DomainError>;
}
```

## 2. Module Structure

Rules:
- Do not use `mod.rs`; use `foo.rs` + `foo/` structure.
- Split files before they exceed roughly 300-500 lines.
- Expose crate public API through `pub use` in `lib.rs`.
- Keep `prelude` limited to frequent and stable exports.

```text
crates/domain/src/
├── lib.rs
├── prelude.rs
├── user.rs
├── user/
│   ├── model.rs
│   ├── repository.rs
│   └── service.rs
└── error.rs
```

## 3. Naming and Visibility

Rules:
- Type names use `PascalCase`; functions and modules use `snake_case`.
- Boolean-returning functions should start with `is_`, `has_`, or `can_`.
- Avoid unclear abbreviations; prioritize domain vocabulary.
- Keep visibility private by default; use `pub` only when justified.

## 4. Type Design

Rules:
- Represent IDs, boundary values, and units with NewType.
- Represent string-based states as closed `enum`s.
- Keep validated input in dedicated types (do not pass raw `String` through core logic).

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UserId(pub Uuid);

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct OrderId(pub Uuid);
```

## 5. Error Handling

Rules:
- Represent domain failures with typed enum errors.
- Define typed errors using `thiserror`.
- Restrict `anyhow` to application boundaries (handler/main).
- Allow `unwrap()` and `expect()` only in tests.
- Error messages should be concise and explain what failed and why.

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("not found: {resource}")]
    NotFound { resource: String },

    #[error("database error")]
    Database(#[from] sqlx::Error),

    #[error("internal error")]
    Internal(#[from] anyhow::Error),
}
```

## 6. Async and Concurrency

Rules:
- Use `Arc<T>` for shared state, and minimize mutable shared state.
- Before introducing `Mutex`, first check whether ownership separation can remove the lock.
- Keep async functions cancellation-safe and preserve consistency on partial failure.
- Move long blocking work to `spawn_blocking`.

## 7. Test Implementation

Rules:
- Place unit tests at the end of the target module file.
- Use behavior-driven test names (`create_user_success`, etc.).
- Keep one responsibility per test for easier failure diagnosis.
- Extract test data setup into helpers to reduce duplication.
- Verify coverage before review by running `make coverage-check` and ensure line coverage is at least `COVERAGE_MIN_LINES` (default: `80`).
- Use `make coverage` when you need a coverage summary without threshold enforcement.
- If `cargo llvm-cov` is unavailable, install it with `cargo install cargo-llvm-cov --locked`.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn create_user_success() {
        // ...
    }
}
```

## 8. Formatting and Lint

Rules:
- Follow `rustfmt` fully (no manual formatting).
- Resolve Clippy warnings by default; use `allow` only with explicit reason.
- Scope `allow` narrowly to items; avoid wide module-level allowances.

Recommended settings:

```toml
# rustfmt.toml
edition = "2021"
max_width = 100
imports_granularity = "Crate"
group_imports = "StdExternalCrate"
```

```toml
# Cargo.toml (workspace)
[workspace.lints.clippy]
unwrap_used = "warn"
expect_used = "warn"
panic = "warn"
todo = "warn"
pedantic = "warn"
```

## 9. Documentation Comments

Rules:
- Add `///` comments for public APIs.
- Include at least one `# Examples` section for traits and core types.
- Document invariants and preconditions explicitly.
- Every function should include a comment that explains its purpose.
- Function comments must use JSDoc-style tags and include `@param`, `@returns`, and `@throws`.
- The first summary line of each function doc comment must be written in Japanese.

Function comment example:

```rust
/// ユーザーIDでユーザー情報を取得する。
/// @param user_id 取得対象のユーザーID
/// @returns ユーザーが存在する場合は `Some(User)`、存在しない場合は `None`
/// @throws AppError DB接続失敗やクエリエラー時
pub async fn find_user(user_id: UserId) -> Result<Option<User>, AppError> {
    // ...
}
```

## 10. LIN-143 Directory Structure Standard

Based on the LIN-143 revised proposal, the Rust workspace standard structure is:

```text
rust/
├─ Cargo.toml
├─ Cargo.lock
├─ apps/
│  ├─ api/
│  │  ├─ Cargo.toml
│  │  └─ src/
│  │     ├─ main.rs
│  │     ├─ bootstrap.rs
│  │     ├─ http/
│  │     └─ ws/
│  └─ worker/
│     ├─ Cargo.toml
│     └─ src/
│        ├─ main.rs
│        └─ jobs/
│           ├─ indexer.rs
│           ├─ last_message.rs
│           ├─ audit.rs
│           └─ notify.rs
├─ crates/
│  ├─ contracts/
│  │  ├─ ids/
│  │  ├─ protocol-ws/
│  │  ├─ protocol-events/
│  │  └─ message-api/
│  ├─ shared/
│  │  ├─ config/
│  │  ├─ telemetry/
│  │  └─ errors/
│  ├─ gateway/
│  │  └─ src/
│  │     ├─ domain/
│  │     ├─ usecase/
│  │     └─ ports/
│  ├─ domains/
│  │  ├─ auth/src/{domain,usecase,ports}
│  │  ├─ guild/src/{domain,usecase,ports}
│  │  ├─ invite/src/{domain,usecase,ports}
│  │  ├─ message/src/{domain,usecase,ports}
│  │  ├─ moderation/src/{domain,usecase,ports}
│  │  ├─ permissions/src/{domain,usecase,ports}
│  │  ├─ profile/src/{domain,usecase,ports}
│  │  ├─ ratelimit/src/{domain,usecase,ports}
│  │  └─ spam/src/{domain,usecase,ports}
│  └─ platform/
│     ├─ postgres/{auth,guild,invite,message,moderation,profile}
│     ├─ scylla/message/
│     ├─ redis/{presence,ratelimit}
│     ├─ pubsub/{producer,consumer}
│     ├─ search/indexer/
│     └─ email/auth/
└─ tests/
   ├─ contract/
   └─ integration/
```
