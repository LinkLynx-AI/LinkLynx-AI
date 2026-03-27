# Prompt.md (Spec / Source of truth)

## Goals
- `GET /v1/invites/{invite_code}` の共有匿名 rate-limit bucket を廃止し、trusted proxy/edge が提示した client scope 単位で分離する。
- spoof 可能な `X-Forwarded-For` などを source of truth にせず、明示的に trust したヘッダだけを rate-limit key に使う。
- public invite verify / join の reject log に `request_id`、`invite_code`、`client_scope` を残し、ADR-005 の high-risk fail-close を維持する。

## Non-goals
- invite verify / join の AuthN/AuthZ 契約自体は変えない。
- Dragonfly provider や rate-limit アルゴリズムの刷新はしない。
- edge/ingress の実インフラ設定変更までは行わない。

## Deliverables
- public invite client-scope resolver と runtime config
- invite verify/join の rate-limit / audit log 更新
- regression tests と docs/run memory 更新

## Done when
- [ ] 異なる trusted client scope で public invite verify の bucket が分離される
- [ ] trusted proxy 未設定または不正 secret 時に spoof が rate-limit key へ反映されない
- [ ] Dragonfly degraded 時の fail-close が invite verify/join で維持される
- [ ] docs と PR evidence に source of truth / fallback / log fields が残る

## Constraints
- Perf: 既存 invite access 上限 (`10/min`) と `Retry-After` 契約は維持する
- Security: `public:anonymous:*` の単一共有 bucket に戻さず、未信頼ヘッダを直接信じない
- Compatibility: 既存 public invite endpoint の path / response shape は変更しない
