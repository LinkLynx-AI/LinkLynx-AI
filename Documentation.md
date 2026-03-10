# Documentation

## Current status
- Now: `LIN-829` の frontend message timeline/composer 実接続と review fix まで反映済み。
- Next: 依存導入済み環境で typecheck / Vitest を再実行して最終確認する。

## Decisions
- 対象 issue は `LIN-829`。
- guild text channel のみ対象。DM 実装は今回含めない。
- backend 契約拡張は行わない。
- message REST/WS の `i64` ID は frontend 境界で string として保持する。
- reconnect 後の取りこぼし補償は active channel history の再取得で行う。
- own-message 判定は `principal_id` ベースで行う。

## Validation plan
- `make validate`
- `cd typescript && npm run typecheck`
- 必要に応じて関連 Vitest を個別実行

## Notes
- `typescript/node_modules` が存在しないためローカル typecheck / Vitest は未実行。
- local 開発では `make dev` が `scylla-bootstrap` を先行実行するように変更した。
- `scylla-bootstrap` は `.env` を読み込んだうえで `scylla-wait` を通すため、Scylla 起動直後の race で Rust API が不健康な session を掴む確率を下げている。
