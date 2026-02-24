# Rust コーディングルール（大規模バックエンド向け）

このドキュメントは、実装時の判断を揃えるための「コード規約」に限定します。  
CI運用、レビュー体制、依存更新フローなどの運用ルールは別ドキュメントで管理します。

## 1. レイヤー境界と依存方向

依存方向は一方向に固定します。

```text
api -> domain <- infra
        ^
      shared
```

規約:
- `domain` は外部FW・I/O実装（`axum`, `sqlx`, HTTP client）に依存しない
- I/O 境界はトレイトで抽象化し、`infra` が実装する
- ユースケースは `domain` に置き、`api` は入出力変換のみに集中する

```rust
use async_trait::async_trait;

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_id(&self, id: UserId) -> Result<Option<User>, DomainError>;
    async fn save(&self, user: &User) -> Result<(), DomainError>;
}
```

## 2. モジュール構成

規約:
- `mod.rs` は使わず、`foo.rs` + `foo/` 構成を採用する
- 1ファイルは 300〜500 行を超える前に分割する
- クレート外公開APIは `lib.rs` の `pub use` 経由で公開する
- `prelude` は「頻出かつ安定した型」のみを再エクスポートする

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

## 3. 命名と可視性

規約:
- 型名は `PascalCase`、関数・モジュールは `snake_case`
- bool を返す関数は `is_` / `has_` / `can_` で始める
- 省略語を避け、ドメイン語彙を優先する（例: `usr` ではなく `user`）
- デフォルトは非公開（`pub` を最小化）し、公開理由があるものだけ公開する

## 4. 型設計

規約:
- ID・境界値・単位は NewType で表現する
- 文字列ベースの状態値は `enum` で閉じる
- 入力バリデーション済み値は専用型で保持する（生 `String` を流さない）

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UserId(pub Uuid);

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct OrderId(pub Uuid);
```

## 5. エラーハンドリング

規約:
- ドメイン層の失敗は列挙型エラーで表現する
- `thiserror` で型付きエラーを定義する
- `anyhow` はアプリ境界（handler, main）に限定する
- `unwrap()` / `expect()` はテストコードのみ許可する
- エラーメッセージは「何が・なぜ失敗したか」を短く書く

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

## 6. 非同期・並行処理

規約:
- 共有状態は `Arc<T>` とし、可変共有は最小限にする
- `Mutex` より先に「所有権分離でロック不要にできないか」を検討する
- 非同期関数はキャンセル安全を意識し、途中失敗時の整合性を保つ
- 長時間ブロッキング処理は `spawn_blocking` へ逃がす

## 7. テスト実装

規約:
- ユニットテストは対象モジュールと同じファイル末尾に置く
- 振る舞い名ベースでテスト名を付ける（`create_user_success` など）
- 1テスト1責務に分割し、失敗原因を特定しやすくする
- テストデータ生成はヘルパー関数化して重複を避ける

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

## 8. フォーマットとLint

規約:
- フォーマットは `rustfmt` に完全準拠する（手動整形しない）
- Clippy 警告は原則解消し、必要な場合のみ理由付きで `allow` する
- `allow` はアイテム単位に限定し、モジュール全体への広域適用を避ける

推奨設定例:

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

## 9. ドキュメントコメント

規約:
- 公開 API には `///` を付与する
- トレイト・主要型には `# Examples` を最低1つ書く
- 不変条件（invariant）と前提条件（precondition）をコメントで明示する
- 関数には「この関数が何をするか」を説明するコメントを書く
- 関数コメントは JSDoc 記法を使い、`@param` `@returns` `@throws` を明示する

関数コメント例:

```rust
/// ユーザーIDでユーザー情報を取得する。
/// @param user_id 取得対象のユーザーID
/// @returns ユーザーが存在する場合は `Some(User)`、存在しない場合は `None`
/// @throws AppError DB接続失敗やクエリエラー時
pub async fn find_user(user_id: UserId) -> Result<Option<User>, AppError> {
    // ...
}
```
