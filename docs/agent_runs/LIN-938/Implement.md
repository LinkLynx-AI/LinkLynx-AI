# Implement

- `Plan.md` の順序を実装の基準にする。順序変更時は `Documentation.md` に理由を残す。
- 差分は Rust backend / CI / docs に閉じ、out-of-scope な改善は混ぜない。
- live integration は self-seeded fixture で完結させ、shared seed への依存を増やさない。
- read-before-retry の完全自動化は行わず、LIN-289 / LIN-291 資産で手動再現できる状態を docs に固定する。
- validation, review, runtime smoke の結果は都度 `Documentation.md` に追記する。
