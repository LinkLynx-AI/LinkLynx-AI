# LIN-860 Implement Rules

- 実行順序は `LIN-861` から `LIN-868` の固定順とし、完了前に次Issueへ進まない。
- `1 issue = 1 PR` を厳守し、子Issue専用ブランチを使う。
- PR base は親ブランチ `codex/lin-860` を使用する（`main` 直は避ける）。
- `docs/AUTHZ.md` と `docs/adr/ADR-004-authz-fail-close-and-cache-strategy.md` を契約SSOTとして扱う。
- DB/契約変更時は `docs/DATABASE.md` と `database/contracts/*` を同時確認する。
- スコープ外変更を混在させない。
