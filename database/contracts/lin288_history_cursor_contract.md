# LIN-288 履歴カーソル走査契約（cursor / limit / nextCursor）

## 目的

- 対象 Issue: LIN-288
- 対象クエリ資産: `database/scylla/queries/lin288_history_cursor_paging.cql`
- 参照先: LIN-279（履歴取得API）

本契約で定義するもの:

- `cursor` 比較キー
- `limit + 1` 取得規約
- `nextCursor` 発行規約
- 順序と重複排除規約

## 1. カーソル比較キー

履歴ページングの比較キーは次の複合キーで統一する。

- `cursor_key = (timestamp, message_id)`
- `timestamp` は `created_at` を指す。
- 同一 `timestamp` の場合は `message_id` でタイブレークする。

比較規則（厳密不等号）:

- cursor には引き続き `(created_at, message_id)` を保持する
- bucket 解決には `created_at` を使う
- 同一 bucket 内の Scylla range filter は clustering key 制約に合わせて `message_id` を使う
- older 側へ進む（forward）: `message_id < cursor_message_id`
- newer 側へ戻る（backward）: `message_id > cursor_message_id`

## 2. limit + 1 規約

呼び出し側は常に `limit + 1` 件を要求する。

- リクエスト入力: `limit`
- DBクエリ入力: `limit_plus_one = limit + 1`

返却件数:

- 取得結果が `limit_plus_one` 件の場合は先頭 `limit` 件を返却し、余剰1件を `nextCursor` 判定にのみ使用する。
- 取得結果が `limit` 件以下の場合はそのまま返却する。

## 3. nextCursor 規約

`nextCursor` は「同方向に続きが存在する」場合のみ返す。

- 判定条件: 取得件数が `limit_plus_one` 件
- 発行値: クライアントへ返却する末尾要素（`limit` 件目）の `(created_at, message_id)`
- 非発行条件: 取得件数が `limit` 件以下

補足:

- `forward` では「より古い履歴」が残っている場合に `nextCursor` を返す。
- `backward` では「より新しい履歴」が残っている場合に `nextCursor` を返す。

## 4. 順序規約

返却順序は方向ごとに次を満たす。

- `forward`（older 取得）: 新しい -> 古い（降順）
- `backward`（newer 取得）: 古い -> 新しい（昇順）

実装上、`backward` クエリ結果が降順で返る場合は、返却前に昇順へ反転して契約順序を満たす。

## 5. 重複排除規約

ページ境界での重複は次の規約で禁止する。

- 比較演算は必ず厳密不等号（`<` / `>`）を使用し、カーソル行自身を再取得しない。
- Scylla query では clustering key の `message_id` のみを range filter に使い、bucket は `created_at` から解決する。
- アプリケーション側の重複キーは `(message_id)` を正とする。
- 同一ページ内・ページ跨ぎ双方で、`message_id` が重複した要素は返却集合から除外する。

## 6. LIN-279 での再利用ポイント

LIN-279（履歴取得API）は以下を本契約のまま利用する。

- カーソルのシリアライズ対象を `(created_at, message_id)` とする。
- DB呼び出し時は必ず `limit + 1` を使用する。
- `nextCursor` 発行有無を「余剰1件の有無」で判定する。
- 方向ごとの返却順序を固定し、境界重複を排除する。

## 7. 実施確認（証跡コマンド）

```bash
rg -n "forward|backward|LIMIT :limit_plus_one" database/scylla/queries/lin288_history_cursor_paging.cql
rg -n "nextCursor|limit \+ 1|重複排除|timestamp" database/contracts/lin288_history_cursor_contract.md
```
