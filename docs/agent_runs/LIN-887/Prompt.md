# Prompt.md (Spec / Source of truth)

## Goals
- LIN-887 として `POST /guilds` の server create を現行 v2 権限スキーマで正常動作させる。
- guild create bootstrap が `guild_roles_v2` / `guild_member_roles_v2` のみを参照するように修正する。
- 旧権限テーブル/型参照が再混入しない回帰テストを追加する。

## Non-goals
- 権限モデル仕様の変更。
- migration や API 契約の変更。
- server/channel create 以外の guild/channel 機能改修。

## Deliverables
- Backend: `rust/apps/api/src/guild_channel/postgres.rs` の guild create bootstrap 修正。
- Backend tests: guild create SQL/挙動の回帰テスト追加。
- Run evidence: validation / review / PR の記録。

## Done when
- [x] `POST /guilds` が現行 schema 前提で成功する。
- [x] guild create 実装が `guild_roles_v2` / `guild_member_roles_v2` のみを参照する。
- [x] 回帰テストが追加され、targeted test と validate が通る。
- [ ] PR が作成される。

## Constraints
- Perf: guild create の DB ラウンドトリップは増やさない。
- Security: 既存 fail-close 契約と権限仕様を変えない。
- Compatibility: LIN-857 後のスキーマ契約に揃えるだけに留める。
