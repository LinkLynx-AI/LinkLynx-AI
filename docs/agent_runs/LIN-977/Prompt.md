# Prompt

## Goals
- `AUTHZ_PROVIDER` 未設定時に `noop allow-all` が既定で有効になる fail-open を廃止する。
- `AUTHZ_PROVIDER=spicedb` の設定不備や初期化失敗時に暗黙 fallback せず fail-close を維持する。
- 一時例外の `noop` は明示指定時のみ有効化し、期限管理を runtime で強制する。

## Non-goals
- moderation endpoint や rate limit の実装変更。
- SpiceDB model / tuple sync / metrics shape の拡張。
- AuthZ deny / unavailable の transport contract 変更。

## Deliverables
- AuthZ runtime の provider 選択ロジック修正。
- provider 未設定 / 空文字 / unknown / noop expiry を固定する Rust テスト。
- `docs/AUTHZ.md` と handoff runbook の契約更新。
- LIN-977 run memory と検証ログ。

## Done when
- [ ] `AUTHZ_PROVIDER` 未設定または空文字で fail-close になる
- [ ] `AUTHZ_PROVIDER=spicedb` の設定不備時に fail-close になる
- [ ] `AUTHZ_PROVIDER=noop` は有効期限内のみ allow-all になる
- [ ] 対象 Rust tests と品質ゲート結果が記録されている

## Constraints
- Perf: provider 判定に高コスト処理を入れない。
- Security: ADR-004 fail-close baseline を破らない。
- Compatibility: `403/503`, `AUTHZ_DENIED`, `AUTHZ_UNAVAILABLE`, WS close code は維持する。
