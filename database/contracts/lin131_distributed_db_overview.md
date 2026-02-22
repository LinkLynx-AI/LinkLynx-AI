# LIN-131 Distributed DB Overview

`SaaS dev all` 全体像ページへ転記できる要約図。

## Storage Responsibility

```mermaid
flowchart LR
  A["API / WS (Rust)"] --> P["PostgreSQL<br/>users, guilds, roles, invites,<br/>channel_reads, channel_last_message, outbox_events"]
  A --> S["ScyllaDB<br/>messages_by_channel, messages_by_id"]
  A --> R["Redis (L2)<br/>rl2:gcra:user:*<br/>rl2:gcra:ip:*"]
  A --> Q["Pub/Sub + DLQ<br/>MessageCreated/Updated/Deleted"]
  Q --> I["Search Indexer<br/>version guard + tombstone"]
  Q --> L["LastMessage Worker<br/>recalculate on delete"]
```

## ER (PostgreSQL core)

```mermaid
erDiagram
  users ||--o{ guilds : owner
  users ||--o{ guild_members : member
  guilds ||--o{ guild_members : has

  guilds ||--o{ channels : has
  users ||--o{ channels : creates

  channels ||--o{ channel_reads : read_state
  users ||--o{ channel_reads : has

  channels ||--|| channel_last_message : summary

  users ||--o{ invites : creates
  guilds ||--o{ invites : has
  invites ||--o{ invite_uses : used
  users ||--o{ invite_uses : by

  channels ||--o{ dm_participants : contains
  users ||--o{ dm_participants : joins
  users ||--o{ dm_pairs : pair_low_high
```

## Runtime Contracts

- `channel_reads` は単調増加upsert（逆行禁止）
- outbox は `PENDING/FAILED` を再取得し再送
- Search は `version` 原子ガードで順不同イベントを処理
- `MessageDeleted` は `is_deleted=true` tombstone 更新
- `channel_last_message` は削除時のみ再計算
- RateLimit は L1主経路 + Redis L2フォールバック
