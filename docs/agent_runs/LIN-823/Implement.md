# Implement

## 実行方針
- `Plan.md` の順で進め、順序変更が必要なら `Documentation.md` に理由を残す。
- 既存の `LIN-821` / `LIN-937` / `LIN-948` 契約を前提に、挙動変更ではなく live HTTP 証跡の追加を優先する。
- helper 抽出は重複削減目的に限定し、message runtime 本体の責務分割は広げない。

## 予定ステップ
1. `docs/agent_runs/LIN-823/` を作成し、issue 固有の run memory を開始する。
2. `apps/api/src/message/service.rs` の integration helper を shared utility へ切り出す。
3. `apps/api/src/main/tests.rs` に live HTTP integration test を追加する。
4. message integration / Rust / TypeScript / 全体 validate を順に実行する。
5. reviewer gate と runtime smoke の証跡を `Documentation.md` に反映する。

## 実施ログ
1. `docs/agent_runs/LIN-823/` に Prompt / Plan / Implement / Documentation を作成。
2. `rust/apps/api/src/message/test_support.rs` を追加し、Scylla/Postgres 接続・seed・count・live usecase/service 構築 helper を移設。
3. `rust/apps/api/src/message/service.rs` の integration tests を shared helper 利用へ差し替え、重複 helper を削除。
4. `rust/apps/api/src/main/tests.rs` に HTTP live integration test を 2 本追加。
5. 新規 HTTP live test の名前を `message_scylla_integration_` 接頭辞へ合わせ、`make message-scylla-integration` の filter で自動実行されるようにした。
6. `cargo fmt --all` と targeted Rust tests を実行し、追加差分のコンパイルと対象テストを確認。
7. `make rust-lint` / `npm run typecheck` / `make validate` / 強制 live integration は sandbox または依存未導入で完走できず、失敗理由を `Documentation.md` に記録。
