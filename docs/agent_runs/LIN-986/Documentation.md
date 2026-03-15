# Documentation.md (Status / audit log)

## Current status
- Now: `auth.identify` の rate-limit key を origin 共有から principal/session scoped へ切り替え、targeted tests と docs 更新まで完了。
- Next: lint / review / PR 作成と Linear の review 遷移を行う。

## Decisions
- identify rate-limit key は active ws-ticket から principal を引ける場合は principal 単位、引けない場合は session 単位へフォールバックする方針で進める。
- raw ticket や origin 文字列自体を shared bucket key に使わず、log には key source だけを残す。
- existing `identify_rate_limited -> close 1008` 契約は維持する。

## How to run / demo
- `cd rust && cargo test -p linklynx_backend identify_rate_limit_key_ -- --nocapture`
- `cd rust && cargo test -p linklynx_backend ws_identify_rate_limit_ -- --ignored --nocapture`
- 期待結果:
  - 同一 `Origin` でも別 principal の identify は別 bucket 扱いになる。
  - `Origin` なしでも別 session の identify は shared bucket に潰れない。
  - rate limited identify は close `1008` / `identify_rate_limited` を維持する。

## Validation log
- 2026-03-15: `cd rust && cargo test -p linklynx_backend identify_rate_limit_key_ -- --nocapture` pass
- 2026-03-15: `cd rust && cargo test -p linklynx_backend ws_identify_rate_limit_ -- --ignored --nocapture` pass

## Known issues / follow-ups
- handshake 前段の接続数 cap や message/frame size cap は別 issue (`LIN-992`, `LIN-993`) で対応する。
