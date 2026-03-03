# LIN-632 Plan

## Milestones
1. 既存 role_level ベースの制約を確認する。
2. 任意ロール用のV2テーブルを forward-only migration で追加する。
3. 既存データをV2へ backfill する初期移行SQLを定義する。
4. SpiceDB写像と移行フェーズ契約を `database/contracts` に追加する。
5. `docs/DATABASE.md` と `docs/AUTHZ.md` に参照導線を追加する。
6. 検証コマンドを実行し結果を記録する。

## Validation commands
- `make db-migrate`
- `make db-schema`
- `make db-schema-check`
- `make validate`

## Acceptance checks
- 1 guild 内で任意 `role_key` を追加できる。
- 1 member に複数 role を割り当て可能な主キー/外部キー設計になっている。
- role override データから tuple 変換規約が文書化されている。
