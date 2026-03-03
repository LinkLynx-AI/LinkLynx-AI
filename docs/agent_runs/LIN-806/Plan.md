# LIN-806 Plan

## Milestones
1. guild/channel APIのサービス層とPostgres実装を追加。
2. HTTPルーティングへ4エンドポイントを追加。
3. レスポンス/エラー契約（`VALIDATION_ERROR`, `GUILD_NOT_FOUND`, `AUTHZ_DENIED`, `AUTHZ_UNAVAILABLE`）を固定。
4. ルートテストを追加し、主要成功系/異常系を網羅。
5. 品質ゲートとランタイムスモークを実施し記録。

## Acceptance focus
- メンバーのみ参照/作成可能。
- 非メンバー参照が拒否される。
- 後続FEが使えるAPI契約が固定される。

## Validation commands
- `make validate`
- `make rust-lint`
- `cd typescript && npm run typecheck`
