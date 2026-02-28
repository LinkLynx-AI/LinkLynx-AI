# LIN-482 Prompt

## Goal
- LIN-482 の子Issue（LIN-496, LIN-501, LIN-502）を順次実装し、Route契約・App Shell・遷移ガードUIを確立する。
- `designs/discord-unified.pen` に合わせてDesktop優先のUI骨格を整備する。

## Non-goals
- API/DB/WS の実処理実装
- 認証判定・権限判定の本実装
- Mock adapter 実装（LIN-483配下で対応）

## Done Conditions
- ルート契約が `shared/config/routes.ts` に一元化されている
- public/auth/protected の route groups が構成されている
- channels/settings App Shell が再利用可能な共通骨格として利用できる
- loading/empty/error/readonly/disabled 共通状態プレースホルダが利用できる
- 未ログイン/権限不足/not-found のガードUIが保護ルートで統一表示される
