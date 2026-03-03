# LIN-634 チャンネル階層（カテゴリ/スレッド）DB契約

## Purpose

- target issue: LIN-634
- カテゴリ配下チャンネルとスレッドチャンネルを既存 `channels` 互換を維持したまま表現する。
- 並び順とアーカイブ状態を保持する最小運用属性を定義する。

## Scope

In scope:
- `channel_hierarchy_kind`
- `channel_hierarchies_v2`
- カテゴリ配下 / スレッド識別の制約
- 同一guild・guild_text限定の整合性契約

Out of scope:
- スレッド参加者管理
- UI表示順ロジックの実装詳細
- ScyllaメッセージSoRの構造変更

## 1. Data model

### 1.1 `channel_hierarchy_kind`

- `category_child`
- `thread`

### 1.2 `channel_hierarchies_v2`

- PK: `child_channel_id`
- FK:
  - `child_channel_id -> channels(id)`
  - `parent_channel_id -> channels(id)`
  - `guild_id -> guilds(id)`
- operational fields:
  - `position`（同一親配下の並び順）
  - `archived_at`（アーカイブ状態）
- `hierarchy_kind` contract:
  - `category_child`: `parent_message_id` は `NULL`
  - `thread`: `parent_message_id` は `NOT NULL`
- `thread` uniqueness:
  - `(guild_id, parent_channel_id, parent_message_id)` 一意

## 2. Scope validation contract

Trigger `enforce_channel_hierarchies_v2_scope` must guarantee:

1. `child_channel_id` は `channels.type='guild_text'` かつ `guild_id IS NOT NULL`
2. `parent_channel_id` は `channels.type='guild_text'` かつ `guild_id IS NOT NULL`
3. `child_channel.guild_id == parent_channel.guild_id == channel_hierarchies_v2.guild_id`

This keeps DM channel data out of hierarchy and prevents cross-guild references.

## 3. Compatibility policy

- 既存 `channels` の `channel_type`（`guild_text`/`dm`）は変更しない。
- 既存 guild_text / dm データは無変更で継続利用できる。
- 階層情報は `channel_hierarchies_v2` の additive 導入で表現する。

## 4. Message reference note

- `parent_message_id` は Scylla SoR 上の message identifier 参照であり、Postgres FKは張らない。
- 理由: メッセージ本文SoRは `database/scylla/*.cql` 側に存在するため。

## 5. Validation

```bash
make db-migrate
make db-schema
make db-schema-check
make validate
```

Optional SQL example:

```sql
-- category child
INSERT INTO channel_hierarchies_v2(
  child_channel_id, guild_id, parent_channel_id, hierarchy_kind, position
) VALUES (101, 10, 100, 'category_child', 1);

-- thread
INSERT INTO channel_hierarchies_v2(
  child_channel_id, guild_id, parent_channel_id, hierarchy_kind, parent_message_id, position
) VALUES (102, 10, 101, 'thread', 9001, 0);
```
