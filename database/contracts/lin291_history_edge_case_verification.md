# LIN-291 履歴境界ケース検証手順

## 目的

- 対象 Issue: LIN-291
- `chat.messages_by_channel` で履歴境界ケースを再現し、DB層での検証手順を固定化する。
- LIN-288（カーソル/limit規約）と LIN-289（重複試行 no-op 規約）に矛盾しないことを確認する。

## 対象ファイル

- テストデータ: `database/scylla/testdata/lin291_history_edge_cases.cql`

## 参照規約

- `database/scylla/queries/lin288_history_cursor_paging.cql`
- `database/contracts/lin288_history_cursor_contract.md`
- `database/scylla/queries/lin289_idempotent_write_strategy.cql`
- `database/contracts/lin289_idempotent_write_contract.md`

## 対象 / 非対象

対象:
- 同一 `timestamp` 境界（タイブレーク）
- `message_id` 欠番を含む履歴列
- 重複試行（`INSERT ... IF NOT EXISTS`）
- `limit + 1` 境界

非対象:
- 本番データ投入
- UI/API 実装変更

## 事前条件

1. `database/scylla/001_lin139_messages.cql` が適用済みであること。
2. 検証先は開発/検証用 Scylla であること（本番環境では実行しない）。
3. `cqlsh` から対象クラスタに接続できること。

## 実行手順

1. `cqlsh` でテストデータ CQL を実行する。

```bash
cqlsh -f database/scylla/testdata/lin291_history_edge_cases.cql
```

2. 実行ログで以下の確認ポイントを順に確認する。
- 重複試行時の `[applied] = false`
- `row_count = 7`
- 基準ページの `LIMIT 4` 取得（`limit=3` の `limit + 1` を想定）
- 同一 `timestamp` 境界での forward/backward の取得結果
- 最終ページで余剰1件がない（`nextCursor` 非発行条件）

## 期待結果（ケース別）

1. 同一 `timestamp` 境界
- cursor: `('2026-02-21T10:00:05Z', 120107)`
- forward（`<`）: `120105, 120102, 120100, 120099`
- backward（`>`）: `120108, 120110`
- 判定: 同一 `timestamp` の `120108` が forward 側に混入しないこと。

2. 欠番ケース
- 取得列: `120110, 120108, 120107, 120105, 120102, 120100, 120099`
- 判定: 欠番（`120109` など）があってもページング順序が崩れないこと。

3. 重複試行ケース
- 同一 `message_id=120107` の再実行で `[applied] = false`
- `COUNT(*)` が `7` で据え置き
- 判定: duplicate no-op が成立していること。

4. limit 境界ケース
- 初回 `LIMIT 4` で4行取得（`limit=3` を想定した余剰1件あり）
- cursor=`('2026-02-21T10:00:02Z', 120100)` では1行のみ
- 判定: 余剰1件あり/なしの両方を再現できること。

## LIN-288/289 整合チェック

LIN-288 整合:
- 比較演算が厳密不等号（`<` / `>`）であること
- `limit + 1` 取得の境界（余剰1件あり/なし）を再現していること

LIN-289 整合:
- `INSERT ... IF NOT EXISTS` の duplicate で `[applied] = false` を確認できること
- 重複試行後に行数が増えないこと

## 判定基準

- 上記4ケースがすべて再現できれば LIN-291 の完了条件を満たす。
- LIN-288/289 の規約と矛盾する結果が出た場合は、実装を進めずに確認・切り分けを行う。

## 証跡コマンド（static）

```bash
rg -n "120107|LIMIT 4|IF NOT EXISTS|ALLOW FILTERING|row_count" \
  database/scylla/testdata/lin291_history_edge_cases.cql
rg -n '同一 `timestamp`|欠番|重複試行|limit 境界|LIN-288|LIN-289' \
  database/contracts/lin291_history_edge_case_verification.md
```
