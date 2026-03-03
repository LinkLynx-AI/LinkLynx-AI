# PR #985 SpiceDB移行検証レポート

検証日: 2026-03-03  
対象PR: [#985 LIN-632: 任意ロール権限モデルへの移行基盤を追加](https://github.com/LinkLynx-AI/LinkLynx-AI/pull/985)  
ブランチ: `codex/LIN-632-spicedb-role-model-migration`

---

## 結論

**PR #985 は「移行基盤（foundation-only）」のみの変更である。SpiceDB への実際の認可移行は完了していない。**

---

## 検証項目と根拠

### 1. SpiceDB の統合・設定

**判定: 未統合 / 未設定**

- Rust コードに SpiceDB クライアント実装は存在しない。
- `rust/apps/api/src/authz/runtime.rs:62-74` において、`AUTHZ_PROVIDER=spicedb` が設定された場合でも実装が存在せず、**noop allow-all にフォールバック**する：

  ```rust
  // rust/apps/api/src/authz/runtime.rs:62-74
  "spicedb" => {
      warn!(
          provider = "spicedb",
          fallback = "noop",
          // ...
          "AUTHZ_PROVIDER=spicedb is not implemented yet; fallback to noop allow-all"
      );
      Arc::new(NoopAllowAllAuthorizer::new(
          allow_all_until,
          NoopAuthorizerMode::Allow,
      ))
  }
  ```

- SpiceDB 接続設定（ホスト、ポート、トークン等）は `Cargo.toml` / `.env.example` / `docker-compose.yml` に追加されていない。
- SpiceDB の依存クレート（例: `authzed`, `spicedb-client`）は `Cargo.toml` に追加されていない。

---

### 2. SpiceDB スキーマ / リレーション / パーミッション定義

**判定: 定義されていない（Postgres 側の写像表のみ文書化）**

- SpiceDB 用のスキーマファイル（`.zed` / `.authzed`）は PR に含まれない。
- `database/contracts/lin632_spicedb_role_model_migration_contract.md:48-82` に Postgres → SpiceDB タプル写像表が**文書として**定義されているが、SpiceDB 上のスキーマとして書き込まれていない：

  | Postgres ソース | 条件 | SpiceDB タプル |
  |---|---|---|
  | `guild_member_roles_v2` | row exists | `role:{guild_id}/{role_key}#member@user:{user_id}` |
  | `guild_roles_v2` | allow_manage = true | `guild:{guild_id}#manager@role:{guild_id}/{role_key}` |
  | ... | ... | ... |

- Scope 外として明示：

  > Out of scope: SpiceDB クライアント実装、Authorizer判定ロジック全面切替
  > （`database/contracts/lin632_spicedb_role_model_migration_contract.md:25-28`）

---

### 3. ランタイム認可チェックの SpiceDB への切り替え

**判定: 切り替えなし / noop allow-all のまま**

- 現行の認可実装は `rust/apps/api/src/authz/service.rs` の `NoopAllowAllAuthorizer` であり、全リクエストを許可する。
- `rust/apps/api/src/authz/service.rs:81` に移植先コメントが存在するのみ：

  ```rust
  // TODO(LIN-629): Replace noop allow-all with SpiceDB-backed authorization checks.
  ```

- PR #985 の差分に Rust ソースファイル（`.rs`）の変更は一切含まれない。
  - 変更対象ファイル（28件）はすべて `database/` および `docs/` 配下である。

---

### 4. データ移行 / ブートストラップの有無

**判定: Postgres v0 → v2 テーブルへのバックフィルは実装済み（SpiceDB へのタプル投入はなし）**

- `database/postgres/migrations/0008_lin632_arbitrary_roles_spicedb_prep.up.sql` に v0 → v2 テーブルへの初期データ移行 SQL が含まれる：

  ```sql
  -- guild_roles (v0) → guild_roles_v2 (v2)
  INSERT INTO guild_roles_v2 (guild_id, role_key, name, priority, ...)
  SELECT guild_id, level::text AS role_key, name, ...
  FROM guild_roles;

  -- guild_member_roles (v0) → guild_member_roles_v2 (v2)
  INSERT INTO guild_member_roles_v2 (guild_id, user_id, role_key)
  SELECT guild_id, user_id, level::text AS role_key
  FROM guild_member_roles;

  -- channel_permission_overrides (v0) → channel_role_permission_overrides_v2 (v2)
  INSERT INTO channel_role_permission_overrides_v2 (channel_id, guild_id, role_key, ...)
  SELECT cpo.channel_id, c.guild_id, cpo.level::text AS role_key, ...
  FROM channel_permission_overrides cpo JOIN channels c ON ...
  WHERE c.guild_id IS NOT NULL;
  ```

- ただし、この移行は **Postgres 内の v0→v2 テーブル間コピー**であり、SpiceDB へのタプル投入（write relationship）は含まれない。
- ロールバック用の `down.sql` も実装済み（v2 テーブルの DROP）。

---

### 5. 変更ファイル一覧と分類

| ファイル | 分類 |
|---|---|
| `database/contracts/lin632_spicedb_role_model_migration_contract.md` | 新規：移行契約文書 |
| `database/postgres/migrations/0008_lin632_arbitrary_roles_spicedb_prep.up.sql` | 新規：Postgres マイグレーション (v2テーブル作成 + v0→v2バックフィル) |
| `database/postgres/migrations/0008_lin632_arbitrary_roles_spicedb_prep.down.sql` | 新規：Postgres ロールバック |
| `database/postgres/schema.sql` | 更新：スキーマスナップショット再生成 |
| `database/postgres/generated/*` | 更新：tbls 自動生成ドキュメント・ER図 |
| `docs/DATABASE.md` | 更新：新テーブル・契約リファレンス追記 |
| `docs/AUTHZ.md` | 更新：LIN-632 移行注記追記（セクション 7） |
| `docs/agent_runs/LIN-632/*` | 新規：エージェント実行ログ |

**Rust / TypeScript / Python のソースコード変更: 0件**

---

## 移行フェーズの現在地

```
[✅ Phase 0: Postgres v2テーブル作成 + v0→v2バックフィル]  ← PR #985 の範囲
[ ] Phase 1: dual-write (v0 + v2 両方更新)
[ ] Phase 2: SpiceDB スキーマ定義 + クライアント実装       ← 未着手 (LIN-629以降)
[ ] Phase 3: runtime auth を SpiceDB に切り替え (cutover)
[ ] Phase 4: v0 テーブル削除 (後続 LIN-857)
```

---

## 参照ファイル

- `database/contracts/lin632_spicedb_role_model_migration_contract.md`
- `database/postgres/migrations/0008_lin632_arbitrary_roles_spicedb_prep.up.sql`
- `rust/apps/api/src/authz/runtime.rs`
- `rust/apps/api/src/authz/service.rs`
- `docs/AUTHZ.md` (Section 4.4, 5, 7)
