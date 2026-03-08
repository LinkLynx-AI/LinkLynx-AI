# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-911` として招待コード検証 API を public 導線で成立させる。
- `GET /v1/invites/{invite_code}` を追加し、招待コードの `valid / invalid / expired` 判定を返せるようにする。
- Next.js の `/invite/[code]` で検証結果ごとの表示を切り替えられるようにする。

## Non-goals
- 招待参加 API の実装。
- 未認証復帰導線や参加後遷移の完成。
- 招待管理 UI の拡張や分析機能。

## Deliverables
- Rust invite verify service / public endpoint / tests。
- TypeScript invite gateway API adapter / page / tests。
- 実装判断と検証結果を記録した `Plan.md`, `Implement.md`, `Documentation.md`。

## Done when
- [ ] `GET /v1/invites/{invite_code}` が public で疎通し、状態判定を返す。
- [ ] `/invite/[code]` が状態ごとに表示を切り替える。
- [ ] `make validate`, `make rust-lint`, `cd typescript && npm run typecheck` が通る。

## Constraints
- Perf: invite verify は単一 invite lookup の最小 read に留める。
- Security: 既存 protected invite endpoint は維持し、新規 public endpoint を additive に追加する。
- Compatibility: `LIN-911` では状態 enum を `valid | invalid | expired` の 3 値に固定し、disabled/maxed-out は `invalid` に畳み込む。
