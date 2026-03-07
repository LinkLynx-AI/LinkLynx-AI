# Prompt.md (Spec / Source of truth)

## Goals
- 招待参加 API を実装する。
- 重複参加を冪等に扱い、guild membership を整合させる。
- LIN-911 の public verify 契約を前提に invite code から安全に join できるようにする。

## Non-goals
- 参加後 UI 遷移の最終体験をこの issue で閉じない。
- 未認証復帰導線は LIN-913 で扱う。
- 招待管理 UI の高度化は扱わない。

## Deliverables
- 認証必須の invite join endpoint
- Postgres 1 statement による membership / invite usage の冪等処理
- Rust API tests

## Done when
- [x] 重複参加で異常終了しない。
- [x] 初回参加で membership と invite usage が整合する。
- [x] 無効/期限切れ/利用上限到達 invite を正しく reject する。
- [x] `make validate` と `make rust-lint` が通る。
- [x] child issue 用 PR を作成する。 (`https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1133`)

## Constraints
- Perf: Postgres 1 transaction で join を完了させ、余計な round trip を増やさない。
- Security: invite join は AuthN 必須、無効 invite や disabled invite で fail-close。
- Compatibility: LIN-911 の verify contract と既存 guild membership 契約を壊さない。
