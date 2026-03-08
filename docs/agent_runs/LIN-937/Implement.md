# Implement

- `Plan.md` の順序を実装の基準にする。順序変更時は `Documentation.md` に理由を残す。
- message slice の追加は 1 issue 範囲に閉じ、既存 auth/authz/rate-limit の挙動は変えない。
- `bucket` は UTC 日次 `YYYYMMDD` として扱い、実装とテストをこの前提で揃える。
- runtime 側は fail-close を優先し、Scylla / Postgres どちらかが使えない時点で unavailable service を返す。
- validation, review, runtime smoke の結果は都度 `Documentation.md` に追記する。

## Implemented
- `rust/crates/domains/message` を追加し、append/list 用 usecase と Scylla/Postgres port を切り出した。
- `rust/crates/platform/scylla/message` を追加し、UTC 日次 bucket・idempotent append・history paging を実装した。
- `rust/crates/platform/postgres/message` を追加し、`channels` / `channel_last_message` 由来の channel context 読み取りと monotonic upsert を実装した。
- `rust/apps/api/src/message.rs` を追加し、runtime service・error mapping・request_id 単位の create 冪等キャッシュを実装した。
- guild message の list/create handler を fixture 直返しから `message_service` 呼び出しへ差し替えた。
- Scylla runtime の接続初期化 helper を `scylla_health` から再利用できる形に寄せた。
- request_id identity の生成は monotonic な `message_id` allocator に揃え、同一 timestamp でも衝突しないようにした。
- Scylla list は `last_message_at` が欠けている channel でも current UTC day を上限 bucket に使って読み出せるようにした。

## Notes
- request_id 冪等キャッシュは同一プロセス内 retry の吸収に限定される。複数 API instance 間での durable な duplicate no-op は、この issue では未対応。
