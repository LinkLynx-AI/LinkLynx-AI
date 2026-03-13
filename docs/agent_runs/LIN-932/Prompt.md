# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-932` として未接続 persistence を埋め、protocol compatibility 検証を固定する。
- additive-only snapshot test と最小受け入れ検証を追加する。

## Non-goals
- 新しい event 仕様の追加。
- v1 範囲外の transport 改修。

## Deliverables
- persistence/repository wiring 修正
- protocol snapshot / acceptance tests
- run record

## Done when
- [ ] 対象 persistence の未接続が解消される
- [ ] event / WS contract の additive-only 退行を検知できる
- [ ] 最小受け入れテスト範囲が repo に固定される

## Constraints
- Perf: 既存 message path の追加コストを最小化する
- Security: 既存 auth/authz fail-close 契約を崩さない
- Compatibility: ADR-001 additive-only を守る
