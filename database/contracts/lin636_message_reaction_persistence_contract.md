# LIN-636 メッセージリアクション永続化契約

## Purpose

- target issue: LIN-636
- メッセージリアクション（絵文字, user_id, created_at）の永続化スキーマを定義する。
- add/remove を冪等に扱える制約を定義する。
- `message_id` 基準の集計（count）取得を支える索引方針を固定する。

## Scope

In scope:
- `message_reactions_v2`
- 同一ユーザーの同一絵文字重複付与防止
- message単位集計の索引方針

Out of scope:
- カスタム絵文字配布/管理機能
- UIリアクションパネル
- メッセージ本文SoR（Scylla）構造変更

## 1. Data model

### 1.1 `message_reactions_v2`

- PK: `(message_id, emoji, user_id)`
- FK:
  - `channel_id -> channels(id) ON DELETE CASCADE`
  - `user_id -> users(id) ON DELETE CASCADE`
- columns:
  - `message_id`（Scylla SoR上のメッセージID）
  - `emoji`（Unicode絵文字または拡張識別子文字列）
  - `user_id`
  - `created_at`
- checks:
  - `emoji` は空文字禁止
  - `emoji` は最大128文字

### 1.2 Duplicate prevention contract

- 同一キー `(message_id, emoji, user_id)` はPKにより1件のみ許容される。
- add operation は `INSERT ... ON CONFLICT DO NOTHING` を使うことで冪等に扱える。
- remove operation は `DELETE ... WHERE message_id=? AND emoji=? AND user_id=?` を使い、対象なし時も no-op 成功として扱える。

## 2. Aggregation index policy

### 2.1 Message-based count query

Target query:

```sql
SELECT emoji, COUNT(*) AS reaction_count
FROM message_reactions_v2
WHERE message_id = $1
GROUP BY emoji;
```

Policy:

- PK先頭が `message_id` のため、message単位集計はPK索引を利用できる。
- 追加索引 `idx_msg_reactions_v2_msg_emoji_created (message_id, emoji, created_at DESC)` は、message+emoji 単位の列挙/集計時の局所性と時系列順取得を補助する。

## 3. Compatibility policy

- LIN-288（履歴カーソル）/ LIN-289（冪等保存）契約を変更しない。
- `message_references_v2` / `channel_pins_v2`（LIN-635）との互換を維持する additive 変更とする。
- `message_id` は Scylla SoR identifier のため、Postgres側に message FK は導入しない。

## 4. Validation

```bash
make db-migrate
make db-schema
make db-schema-check
make validate
```

Optional SQL example:

```sql
-- add idempotent
INSERT INTO message_reactions_v2(message_id, channel_id, emoji, user_id)
VALUES (92001, 3001, '👍', 1001)
ON CONFLICT DO NOTHING;

-- remove idempotent
DELETE FROM message_reactions_v2
WHERE message_id = 92001
  AND emoji = '👍'
  AND user_id = 1001;
```
