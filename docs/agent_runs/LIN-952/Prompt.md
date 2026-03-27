# Prompt

## Goals
- `LIN-952` として、server/channel 系の主要操作を `AUTHZ_PROVIDER=spicedb` の shared `Authorizer` 経路へ寄せる。
- role settings、member role assignment、channel permission editor、channel create/edit/delete、permission snapshot の request-time 判定を contract どおりに揃える。

## Non-goals
- frontend settings UI 接続
- 新しい AuthZ provider / policy system 導入
- end-to-end 回帰整理全体

## Deliverables
- `rest_auth_middleware` の action/resource 写像更新
- direct DB の manage 判定に依存する server/channel backend path の整理
- permission snapshot と実操作の整合テスト
- `docs/agent_runs/LIN-952/*`

## Done when
- [x] 対象 endpoint が `AUTHZ_PROVIDER=spicedb` で allow/deny/unavailable を shared `Authorizer` 経由で返す
- [x] role/member/channel permission 系 GET/PUT/PATCH/DELETE が contract どおり `Manage` 保護になる
- [x] channel create/edit/delete と permission snapshot の可否が shared authz boundary と整合する
- [x] fail-close regression と request-time mapping をテストで固定する

## Constraints
- Security: `ADR-004` に従い fail-close を崩さない
- Compatibility: `LIN-950` / `LIN-951` 契約と existing `AuthzResource` / `AuthzAction` の写像を壊さない
- Scope: invite / DM / moderation の既存境界は必要最小限の再整合に留める
