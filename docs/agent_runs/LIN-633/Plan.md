# LIN-633 Plan

## Milestones
1. LIN-632で導入した role override モデルを確認する。
2. user override 用テーブルを additive migration で追加する。
3. role/user を一体で扱う参照ビューを追加する。
4. tuple変換規約と評価優先順を契約文書に追加する。
5. `docs/DATABASE.md` / `docs/AUTHZ.md` を更新する。
6. スキーマ生成と検証コマンドを実行して結果を記録する。

## Validation commands
- `make db-migrate`
- `make db-schema`
- `make db-schema-check`
- `make validate`

## Acceptance checks
- `(channel_id, user_id)` 単位で tri-state override を保存可能。
- role-only の場合は既存 role override 経路が引き続き利用可能。
- user/role 両系統の tuple 変換規約と優先順が文書化されている。
