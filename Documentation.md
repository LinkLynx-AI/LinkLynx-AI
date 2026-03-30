# Documentation

## Current status
- `LIN-796` の親要件に相当する invite verify / join / FE 導線は現行 `main` に存在する。
- このワークツリー `codex/lin-796` は `origin/main` と差分が無く、追加の product code 実装差分は確認できなかった。

## Decisions
- 今回の実装は root memory files の是正に限定する。
- `LIN-796` の追加差分は、具体的な欠落要件または再現不具合が提示された場合にのみ着手する。
- invite join の `AuthN required / AuthZ excluded` 契約は ADR-004 を維持する。
- invite access の high-risk fail-close policy は ADR-005 を維持する。

## Validation
- Pass:
  - `cargo test -p linklynx_backend invite::tests:: -- --nocapture`
- Blocked by environment:
  - `cd typescript && npm run test -- --run src/app/invite/[code]/page.test.tsx src/app/invite/[code]/invite-page-client.test.tsx src/features/invite-flow/api/join-invite.test.ts`
  - `cd typescript && npm run typecheck`
  - `make validate`

## Notes
- frontend 検証失敗の主因はコードではなく依存未導入。
  - `vitest: not found`
  - `prettier: not found`
- 現時点で invite 関連の repo-tracked code 変更は加えていない。
