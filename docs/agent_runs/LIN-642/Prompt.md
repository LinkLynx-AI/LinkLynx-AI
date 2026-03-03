# LIN-642 Prompt

## Goal
- `authenticatedFetch` を実装し、Firebase IDトークンをBearerとして付与する共通REST境界を追加する。
- `/protected/ping` との疎通を保護ルート実ガードへ接続し、未認証は `/login` へ誘導する。
- 401/403/503 の分岐を契約どおり画面へ反映する。

## Non-goals
- 認証外APIの拡張。
- SSR認証ガードの追加。
- AuthZ仕様変更。

## Deliverables
- `entities/auth/api/authenticated-fetch.ts` とテスト。
- `features/route-guard` の実認証ガード化（401/403/503分岐）。
- `returnTo` 付き `/login` 誘導とログイン成功後の復帰。
- route判定テーブル（public/auth/protected）と `invite` 非保護の回帰テスト。

## Done when
- [x] 認証済みユーザーが `/protected/ping` で 200 を受け取り、保護ルートを表示できる。
- [x] 未認証ユーザーは保護ルートで `/login` 誘導される。
- [x] 401/403/503 の分類表示が契約どおり動作する。
- [x] `cd typescript && npm run test` / `cd typescript && npm run typecheck` が通る。

## Constraints
- Perf: 保護ルートガードのAPI呼び出しは重複最小化。
- Security: `returnTo` は内部保護ルートのみ許可し open redirect を防止。
- Compatibility: 既存preview query (`guard`, `state`) を維持。
