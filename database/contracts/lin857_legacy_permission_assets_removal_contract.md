# LIN-857 旧権限テーブル/カラム削除 契約

## Purpose

- target issue: LIN-857
- SpiceDB移行後のPost-cutoverフェーズで、v0権限資産をDBから削除してスキーマを単一モデルへ収束させる。

## Scope

In scope:
- drop targets:
  - `guild_roles`
  - `guild_member_roles`
  - `channel_permission_overrides`
  - `guild_roles_v2.source_level`
  - `role_level` enum
- seed/ドキュメントのv2整合更新

Out of scope:
- SpiceDBクライアント実装
- AuthZ判定ロジック本体
- メッセージ/添付等の非権限スキーマ変更

## 1. Pre-conditions

This migration must be applied only after:

1. 読み取り経路が `*_v2` 系とSpiceDB写像前提で運用されている。
2. v0権限テーブルへの書き込み経路が停止している。
3. rollback方針が「旧データ復元ではなく再投入手順で対応」で合意されている。

## 2. Schema delta

### 2.1 Removed assets

- `guild_roles`
- `guild_member_roles`
- `channel_permission_overrides`
- `role_level`
- `guild_roles_v2.source_level`

### 2.2 Preserved assets

- `guild_roles_v2`
- `guild_member_roles_v2`
- `channel_role_permission_overrides_v2`
- `channel_user_permission_overrides_v2`
- `channel_permission_overrides_subject_v2`

## 3. Down migration policy

- down migration では旧テーブル/enumを空状態で再作成する（過去データは復元しない）。
- `guild_roles_v2.source_level` は nullable で再追加する。

## 4. Validation

```bash
make db-migrate
make db-schema
make db-schema-check
make db-seed
make validate
```

Code/reference check:

```bash
rg -n "guild_roles\b|guild_member_roles\b|channel_permission_overrides\b|role_level\b" rust typescript python elixir
```
