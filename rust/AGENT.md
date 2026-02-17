# Rust開発規約（現行適用版）

## 目的
- 規約は理想像の提示ではなく、現行リポジトリで継続的に守れる運用を優先する。
- 厳格さは維持しつつ、運用停止を避けるために例外条件は最小限で明文化する。

## 前提
- 現在のRust実装は単一crate（`rust/Cargo.toml`）を前提とする。
- 技術スタックは`axum + sqlx`を継続する。
- すぐにworkspace多crateへ全面移行はしない。段階移行を前提にする。

## 依存ルール（許可依存マトリクス）
- `domain -> (なし)`
- `usecase -> domain`
- `interface_* -> usecase, domain(DTO変換のみ)`
- `infra_* -> usecase(Port実装), domain`
- `app_* -> 全層の配線のみ`

補足:
- 逆依存は禁止。
- `interface_*`での`domain`依存はDTO変換の責務に限定し、業務ロジックは`usecase`へ集約する。

## 構成方針（段階移行）
- 「標準crate構成」は必須ではなく目標構成とする。
- Phase 1: 単一crateのままレイヤ分割（module）を徹底する。
- Phase 2: 必要に応じてcrate分割し、workspace化する。

## 品質ゲート（fmt/clippy/test）
Rustの品質チェックは以下に統一する。

```bash
cargo fmt --all
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace
```

## エラーハンドリング
- `unwrap/expect`はテスト以外原則禁止。
- 例外として、プロセス起動時の致命的設定不備は許可する。
  - 原則: `main -> Result`で明示的にエラーを返し、理由をログに残して終了する。
  - `panic`任せの終了は避ける。
- エラー型命名は`*Error`に統一する。
- HTTPステータスコードへの対応付けは`interface_*`層でのみ行う。

## トランザクション規約
- 原則: `1ユースケース = 1トランザクション`。
- 例外条件:
  - read-onlyユースケース
  - 外部連携を含むSaga/最終的整合性の採用時

## CIルール
- PRマージ条件として`fmt/clippy/test`成功を必須化する。
- ローカルの努力ではなくCIで担保する。

## レビュー観点
- レイヤ逆依存がないこと。
- スキーマ変更PRにmigrationが同梱されていること（同梱率100%）。
- WSイベントが`event_type`と`payload`固定スキーマを満たすこと（interfaceテストで確認）。

## 例外申請テンプレート
以下をすべて記載する。

1. 例外化する規約項目
2. 必要性（なぜ通常ルールで達成できないか）
3. 影響範囲
4. 期限
5. 撤去条件（どの状態になったら例外を外すか）
6. 代替策の検討結果
