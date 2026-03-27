# Plan

## Rules
- Stop-and-fix: 追加差分を実装する場合は、検証失敗を解消してから次へ進む。
- Scope lock: 今回は `LIN-796` の差分確認に限定し、追加要件が無い限り product code を編集しない。

## Milestones
### M1: 親 issue と既存実装の対応確認
- Acceptance criteria:
  - [x] `LIN-796` の子課題 `LIN-811` / `LIN-816` / `LIN-819` を特定する。
  - [x] invite verify / join / `/invite/[code]` の実装が現行コードに存在することを確認する。
  - [x] `origin/main...HEAD` が `0 0` であることを確認する。

### M2: 検証結果の取得
- Acceptance criteria:
  - [x] Rust invite 関連テストを実行し、既存 backend 実装の健全性を確認する。
  - [x] frontend 検証が環境要因で未実行の場合、その理由を明記する。

### M3: 作業記録の是正
- Acceptance criteria:
  - [x] `Prompt.md` / `Plan.md` / `Implement.md` / `Documentation.md` を `LIN-796` 用に更新する。
  - [x] 「追加差分なし」の判断根拠と未解決事項を残す。
