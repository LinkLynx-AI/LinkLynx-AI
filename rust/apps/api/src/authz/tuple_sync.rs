use std::{
    collections::BTreeSet,
    env,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};

use async_trait::async_trait;
use serde::{de::DeserializeOwned, Deserialize, Deserializer, Serialize};
use serde_json::Value;
use tokio::sync::RwLock;
use tokio_postgres::Client;

const DEFAULT_TUPLE_SYNC_OUTBOX_CLAIM_LIMIT: u32 = 100;
const DEFAULT_TUPLE_SYNC_OUTBOX_LEASE_SECONDS: u32 = 30;
const DEFAULT_TUPLE_SYNC_OUTBOX_RETRY_SECONDS: u32 = 15;

const GUILD_MANAGER_RELATION: &str = "manager";
const GUILD_VIEWER_RELATION: &str = "viewer";
const GUILD_POSTER_RELATION: &str = "poster";

const ROLE_MEMBER_RELATION: &str = "member";

const CHANNEL_VIEWER_ROLE_RELATION: &str = "viewer_role";
const CHANNEL_VIEW_DENY_ROLE_RELATION: &str = "view_deny_role";
const CHANNEL_POSTER_ROLE_RELATION: &str = "poster_role";
const CHANNEL_POST_DENY_ROLE_RELATION: &str = "post_deny_role";
const CHANNEL_GUILD_RELATION: &str = "guild";

const CHANNEL_VIEWER_USER_RELATION: &str = "viewer_user";
const CHANNEL_VIEW_DENY_USER_RELATION: &str = "view_deny_user";
const CHANNEL_POSTER_USER_RELATION: &str = "poster_user";
const CHANNEL_POST_DENY_USER_RELATION: &str = "post_deny_user";

pub const AUTHZ_TUPLE_EVENT_GUILD_ROLE: &str = "authz.tuple.guild_role.v1";
pub const AUTHZ_TUPLE_EVENT_GUILD_MEMBER_ROLE: &str = "authz.tuple.guild_member_role.v1";
pub const AUTHZ_TUPLE_EVENT_CHANNEL_ROLE_OVERRIDE: &str = "authz.tuple.channel_role_override.v1";
pub const AUTHZ_TUPLE_EVENT_CHANNEL_USER_OVERRIDE: &str = "authz.tuple.channel_user_override.v1";
pub const AUTHZ_TUPLE_EVENT_FULL_RESYNC: &str = "authz.tuple.full_resync.v1";

/// SpiceDB tuple同期の実行時設定を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpiceDbTupleSyncRuntimeConfig {
    pub outbox_claim_limit: u32,
    pub outbox_lease_seconds: u32,
    pub outbox_retry_seconds: u32,
}

impl Default for SpiceDbTupleSyncRuntimeConfig {
    fn default() -> Self {
        Self {
            outbox_claim_limit: DEFAULT_TUPLE_SYNC_OUTBOX_CLAIM_LIMIT,
            outbox_lease_seconds: DEFAULT_TUPLE_SYNC_OUTBOX_LEASE_SECONDS,
            outbox_retry_seconds: DEFAULT_TUPLE_SYNC_OUTBOX_RETRY_SECONDS,
        }
    }
}

/// 実行時環境変数からtuple同期設定を構築する。
/// @param なし
/// @returns tuple同期設定
/// @throws String 設定値が不正な場合
pub fn build_spicedb_tuple_sync_runtime_config_from_env(
) -> Result<SpiceDbTupleSyncRuntimeConfig, String> {
    Ok(SpiceDbTupleSyncRuntimeConfig {
        outbox_claim_limit: parse_optional_u32_env(
            "SPICEDB_TUPLE_SYNC_OUTBOX_CLAIM_LIMIT",
            DEFAULT_TUPLE_SYNC_OUTBOX_CLAIM_LIMIT,
        )?,
        outbox_lease_seconds: parse_optional_u32_env(
            "SPICEDB_TUPLE_SYNC_OUTBOX_LEASE_SECONDS",
            DEFAULT_TUPLE_SYNC_OUTBOX_LEASE_SECONDS,
        )?,
        outbox_retry_seconds: parse_optional_u32_env(
            "SPICEDB_TUPLE_SYNC_OUTBOX_RETRY_SECONDS",
            DEFAULT_TUPLE_SYNC_OUTBOX_RETRY_SECONDS,
        )?,
    })
}

/// SpiceDBのobject#relation@subjectを表現する。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct SpiceDbTuple {
    pub object: String,
    pub relation: String,
    pub subject: String,
}

impl SpiceDbTuple {
    /// tupleを生成する。
    /// @param object リソースオブジェクト
    /// @param relation リレーション名
    /// @param subject サブジェクト
    /// @returns tuple
    /// @throws なし
    pub fn new(
        object: impl Into<String>,
        relation: impl Into<String>,
        subject: impl Into<String>,
    ) -> Self {
        Self {
            object: object.into(),
            relation: relation.into(),
            subject: subject.into(),
        }
    }

    /// tupleを compact 表記へ変換する。
    /// @param なし
    /// @returns `object#relation@subject` 形式文字列
    /// @throws なし
    pub fn compact(&self) -> String {
        format!("{}#{}@{}", self.object, self.relation, self.subject)
    }
}

/// guild_roles_v2 由来の権限行を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuildRolePermissionRow {
    pub guild_id: i64,
    pub role_key: String,
    pub allow_view: bool,
    pub allow_post: bool,
    pub allow_manage: bool,
}

/// guild_member_roles_v2 由来の割当行を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuildMemberRoleRow {
    pub guild_id: i64,
    pub user_id: i64,
    pub role_key: String,
}

/// channel_role_permission_overrides_v2 由来の行を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChannelRoleOverrideRow {
    pub channel_id: i64,
    pub guild_id: i64,
    pub role_key: String,
    pub can_view: Option<bool>,
    pub can_post: Option<bool>,
}

/// channel_user_permission_overrides_v2 由来の行を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChannelUserOverrideRow {
    pub channel_id: i64,
    pub guild_id: i64,
    pub user_id: i64,
    pub can_view: Option<bool>,
    pub can_post: Option<bool>,
}

/// backfillに必要なソースデータ集合を表現する。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TupleBackfillInput {
    pub guild_roles: Vec<GuildRolePermissionRow>,
    pub guild_member_roles: Vec<GuildMemberRoleRow>,
    pub channel_role_overrides: Vec<ChannelRoleOverrideRow>,
    pub channel_user_overrides: Vec<ChannelUserOverrideRow>,
}

/// backfill実行結果を表現する。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct TupleBackfillReport {
    pub guild_role_rows: u64,
    pub guild_member_role_rows: u64,
    pub channel_role_override_rows: u64,
    pub channel_user_override_rows: u64,
    pub generated_tuple_count: u64,
    pub applied_mutation_count: u64,
}

/// tuple差分レポートを表現する。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct TupleDriftReport {
    pub missing_tuples: Vec<SpiceDbTuple>,
    pub unexpected_tuples: Vec<SpiceDbTuple>,
}

impl TupleDriftReport {
    /// 差分が存在するかを判定する。
    /// @param なし
    /// @returns 差分有無
    /// @throws なし
    pub fn has_drift(&self) -> bool {
        !self.missing_tuples.is_empty() || !self.unexpected_tuples.is_empty()
    }
}

/// tuple同期の更新操作を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpiceDbTupleMutation {
    Upsert(SpiceDbTuple),
    Delete(SpiceDbTuple),
}

/// outboxイベントを表現する。
#[derive(Debug, Clone, PartialEq)]
pub struct TupleSyncOutboxEvent {
    pub id: i64,
    pub event_type: String,
    pub aggregate_id: String,
    pub payload: Value,
}

/// outboxイベントから解釈した同期コマンドを表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TupleSyncCommand {
    Mutations(Vec<SpiceDbTupleMutation>),
    FullResync { reason: Option<String> },
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct TupleSyncRunReport {
    pub claimed_events: u64,
    pub succeeded_events: u64,
    pub failed_events: u64,
    pub applied_mutations: u64,
    pub full_resync_events: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum TupleSyncOperation {
    Upsert,
    Delete,
}

#[derive(Debug, Deserialize)]
struct GuildRoleOutboxPayload {
    op: TupleSyncOperation,
    guild_id: i64,
    role_key: String,
    allow_view: Option<bool>,
    allow_post: Option<bool>,
    allow_manage: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct GuildMemberRoleOutboxPayload {
    op: TupleSyncOperation,
    guild_id: i64,
    user_id: i64,
    role_key: String,
}

#[derive(Debug, Deserialize)]
struct ChannelRoleOverrideOutboxPayload {
    op: TupleSyncOperation,
    channel_id: i64,
    guild_id: i64,
    role_key: String,
    #[serde(default, deserialize_with = "deserialize_payload_bool_field")]
    can_view: PayloadBoolField,
    #[serde(default, deserialize_with = "deserialize_payload_bool_field")]
    can_post: PayloadBoolField,
}

#[derive(Debug, Deserialize)]
struct ChannelUserOverrideOutboxPayload {
    op: TupleSyncOperation,
    channel_id: i64,
    guild_id: i64,
    user_id: i64,
    #[serde(default, deserialize_with = "deserialize_payload_bool_field")]
    can_view: PayloadBoolField,
    #[serde(default, deserialize_with = "deserialize_payload_bool_field")]
    can_post: PayloadBoolField,
}

#[derive(Debug, Deserialize, Default)]
struct FullResyncOutboxPayload {
    reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
enum PayloadBoolField {
    #[default]
    Missing,
    Null,
    Value(bool),
}

/// guild_member_roles_v2 の1行を tuple へ写像する。
/// @param row guild member role 行
/// @returns `role:{guild}/{role_key}#member@user:{user}` tuple
/// @throws なし
pub fn map_guild_member_role_to_tuple(row: &GuildMemberRoleRow) -> SpiceDbTuple {
    SpiceDbTuple::new(
        role_object(row.guild_id, &row.role_key),
        ROLE_MEMBER_RELATION,
        user_subject(row.user_id),
    )
}

/// guild_roles_v2 の1行を tuple 群へ写像する。
/// @param row guild role 行
/// @returns guild role baseline tuple 群
/// @throws なし
pub fn map_guild_role_permissions_to_tuples(row: &GuildRolePermissionRow) -> Vec<SpiceDbTuple> {
    let object = guild_object(row.guild_id);
    let role_subject = role_member_subject(row.guild_id, &row.role_key);
    let mut tuples = Vec::new();

    if row.allow_manage {
        tuples.push(SpiceDbTuple::new(
            object.clone(),
            GUILD_MANAGER_RELATION,
            role_subject.clone(),
        ));
    }
    if row.allow_view {
        tuples.push(SpiceDbTuple::new(
            object.clone(),
            GUILD_VIEWER_RELATION,
            role_subject.clone(),
        ));
    }
    if row.allow_post {
        tuples.push(SpiceDbTuple::new(
            object,
            GUILD_POSTER_RELATION,
            role_subject,
        ));
    }

    tuples
}

/// channel_role_permission_overrides_v2 の1行を tuple 群へ写像する。
/// @param row channel role override 行
/// @returns channel role override tuple 群
/// @throws なし
pub fn map_channel_role_override_to_tuples(row: &ChannelRoleOverrideRow) -> Vec<SpiceDbTuple> {
    let object = channel_object(row.channel_id);
    let role_subject = role_member_subject(row.guild_id, &row.role_key);
    let mut tuples = vec![map_channel_guild_tuple(row.channel_id, row.guild_id)];

    match row.can_view {
        Some(true) => tuples.push(SpiceDbTuple::new(
            object.clone(),
            CHANNEL_VIEWER_ROLE_RELATION,
            role_subject.clone(),
        )),
        Some(false) => tuples.push(SpiceDbTuple::new(
            object.clone(),
            CHANNEL_VIEW_DENY_ROLE_RELATION,
            role_subject.clone(),
        )),
        None => {}
    }

    match row.can_post {
        Some(true) => tuples.push(SpiceDbTuple::new(
            object,
            CHANNEL_POSTER_ROLE_RELATION,
            role_subject,
        )),
        Some(false) => tuples.push(SpiceDbTuple::new(
            channel_object(row.channel_id),
            CHANNEL_POST_DENY_ROLE_RELATION,
            role_member_subject(row.guild_id, &row.role_key),
        )),
        None => {}
    }

    tuples
}

/// channel_user_permission_overrides_v2 の1行を tuple 群へ写像する。
/// @param row channel user override 行
/// @returns channel user override tuple 群
/// @throws なし
pub fn map_channel_user_override_to_tuples(row: &ChannelUserOverrideRow) -> Vec<SpiceDbTuple> {
    let object = channel_object(row.channel_id);
    let subject = user_subject(row.user_id);
    let mut tuples = vec![map_channel_guild_tuple(row.channel_id, row.guild_id)];

    match row.can_view {
        Some(true) => tuples.push(SpiceDbTuple::new(
            object.clone(),
            CHANNEL_VIEWER_USER_RELATION,
            subject.clone(),
        )),
        Some(false) => tuples.push(SpiceDbTuple::new(
            object.clone(),
            CHANNEL_VIEW_DENY_USER_RELATION,
            subject.clone(),
        )),
        None => {}
    }

    match row.can_post {
        Some(true) => tuples.push(SpiceDbTuple::new(
            object,
            CHANNEL_POSTER_USER_RELATION,
            subject,
        )),
        Some(false) => tuples.push(SpiceDbTuple::new(
            channel_object(row.channel_id),
            CHANNEL_POST_DENY_USER_RELATION,
            user_subject(row.user_id),
        )),
        None => {}
    }

    tuples
}

/// backfill入力から最終tuple集合を生成する。
/// @param input backfill入力
/// @returns 重複除去済みtuple一覧
/// @throws なし
pub fn build_backfill_tuples(input: &TupleBackfillInput) -> Vec<SpiceDbTuple> {
    let mut tuples = BTreeSet::new();

    for row in &input.guild_member_roles {
        tuples.insert(map_guild_member_role_to_tuple(row));
    }

    for row in &input.guild_roles {
        tuples.extend(map_guild_role_permissions_to_tuples(row));
    }

    for row in &input.channel_role_overrides {
        tuples.extend(map_channel_role_override_to_tuples(row));
    }

    for row in &input.channel_user_overrides {
        tuples.extend(map_channel_user_override_to_tuples(row));
    }

    tuples.into_iter().collect()
}

/// 期待tuple集合と観測tuple集合の差分を検知する。
/// @param expected 期待tuple集合
/// @param observed 観測tuple集合
/// @returns 差分レポート
/// @throws なし
pub fn detect_tuple_drift(
    expected: &[SpiceDbTuple],
    observed: &[SpiceDbTuple],
) -> TupleDriftReport {
    let expected_set: BTreeSet<SpiceDbTuple> = expected.iter().cloned().collect();
    let observed_set: BTreeSet<SpiceDbTuple> = observed.iter().cloned().collect();

    let missing_tuples = expected_set.difference(&observed_set).cloned().collect();
    let unexpected_tuples = observed_set.difference(&expected_set).cloned().collect();

    TupleDriftReport {
        missing_tuples,
        unexpected_tuples,
    }
}

/// 差分レポートから再同期用 mutation を生成する。
/// @param report 差分レポート
/// @returns 再同期mutation一覧
/// @throws なし
pub fn build_resync_mutations(report: &TupleDriftReport) -> Vec<SpiceDbTupleMutation> {
    let mut mutations = Vec::new();

    for tuple in &report.unexpected_tuples {
        mutations.push(SpiceDbTupleMutation::Delete(tuple.clone()));
    }

    for tuple in &report.missing_tuples {
        mutations.push(SpiceDbTupleMutation::Upsert(tuple.clone()));
    }

    mutations
}

/// outboxイベントから tuple 同期コマンドへ変換する。
/// @param event outboxイベント
/// @returns 同期コマンド
/// @throws String 不正event type/payload時
pub fn build_tuple_sync_command(event: &TupleSyncOutboxEvent) -> Result<TupleSyncCommand, String> {
    match event.event_type.as_str() {
        AUTHZ_TUPLE_EVENT_GUILD_ROLE => {
            let payload: GuildRoleOutboxPayload = parse_json_payload(event)?;
            Ok(TupleSyncCommand::Mutations(build_guild_role_mutations(
                payload,
            )?))
        }
        AUTHZ_TUPLE_EVENT_GUILD_MEMBER_ROLE => {
            let payload: GuildMemberRoleOutboxPayload = parse_json_payload(event)?;
            Ok(TupleSyncCommand::Mutations(
                build_guild_member_role_mutations(payload),
            ))
        }
        AUTHZ_TUPLE_EVENT_CHANNEL_ROLE_OVERRIDE => {
            let payload: ChannelRoleOverrideOutboxPayload = parse_json_payload(event)?;
            Ok(TupleSyncCommand::Mutations(
                build_channel_role_override_mutations(payload)?,
            ))
        }
        AUTHZ_TUPLE_EVENT_CHANNEL_USER_OVERRIDE => {
            let payload: ChannelUserOverrideOutboxPayload = parse_json_payload(event)?;
            Ok(TupleSyncCommand::Mutations(
                build_channel_user_override_mutations(payload)?,
            ))
        }
        AUTHZ_TUPLE_EVENT_FULL_RESYNC => {
            let payload: FullResyncOutboxPayload = parse_optional_json_payload(event)?;
            Ok(TupleSyncCommand::FullResync {
                reason: payload.reason,
            })
        }
        _ => Err(format!(
            "unsupported tuple sync event_type: {}",
            event.event_type
        )),
    }
}

#[async_trait]
pub trait TupleBackfillSource: Send + Sync {
    async fn list_guild_roles(&self) -> Result<Vec<GuildRolePermissionRow>, String>;
    async fn list_guild_member_roles(&self) -> Result<Vec<GuildMemberRoleRow>, String>;
    async fn list_channel_role_overrides(&self) -> Result<Vec<ChannelRoleOverrideRow>, String>;
    async fn list_channel_user_overrides(&self) -> Result<Vec<ChannelUserOverrideRow>, String>;
}

#[async_trait]
pub trait TupleSyncOutboxStore: Send + Sync {
    async fn claim_outbox_events(
        &self,
        limit: u32,
        lease_seconds: u32,
    ) -> Result<Vec<TupleSyncOutboxEvent>, String>;
    async fn mark_outbox_event_sent(&self, event_id: i64) -> Result<(), String>;
    async fn mark_outbox_event_failed(
        &self,
        event_id: i64,
        retry_seconds: u32,
    ) -> Result<(), String>;
}

#[async_trait]
pub trait TupleMutationSink: Send + Sync {
    async fn apply_mutations(&self, mutations: Vec<SpiceDbTupleMutation>) -> Result<(), String>;
    async fn list_current_tuples(&self) -> Result<Vec<SpiceDbTuple>, String>;
}

/// Postgresからbackfillソースを読み取る実装を表現する。
#[derive(Clone)]
pub struct PostgresTupleBackfillSource {
    client: Arc<Client>,
}

impl PostgresTupleBackfillSource {
    /// Postgres backfill ソースを生成する。
    /// @param client Postgresクライアント
    /// @returns backfillソース
    /// @throws なし
    pub fn new(client: Arc<Client>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl TupleBackfillSource for PostgresTupleBackfillSource {
    async fn list_guild_roles(&self) -> Result<Vec<GuildRolePermissionRow>, String> {
        let rows = self
            .client
            .query(
                "SELECT guild_id, role_key, allow_view, allow_post, allow_manage
                 FROM guild_roles_v2
                 ORDER BY guild_id, role_key",
                &[],
            )
            .await
            .map_err(|error| format!("tuple_backfill_list_guild_roles_failed:{error}"))?;

        Ok(rows
            .iter()
            .map(|row| GuildRolePermissionRow {
                guild_id: row.get::<usize, i64>(0),
                role_key: row.get::<usize, String>(1),
                allow_view: row.get::<usize, bool>(2),
                allow_post: row.get::<usize, bool>(3),
                allow_manage: row.get::<usize, bool>(4),
            })
            .collect())
    }

    async fn list_guild_member_roles(&self) -> Result<Vec<GuildMemberRoleRow>, String> {
        let rows = self
            .client
            .query(
                "SELECT guild_id, user_id, role_key
                 FROM guild_member_roles_v2
                 ORDER BY guild_id, user_id, role_key",
                &[],
            )
            .await
            .map_err(|error| format!("tuple_backfill_list_guild_member_roles_failed:{error}"))?;

        Ok(rows
            .iter()
            .map(|row| GuildMemberRoleRow {
                guild_id: row.get::<usize, i64>(0),
                user_id: row.get::<usize, i64>(1),
                role_key: row.get::<usize, String>(2),
            })
            .collect())
    }

    async fn list_channel_role_overrides(&self) -> Result<Vec<ChannelRoleOverrideRow>, String> {
        let rows = self
            .client
            .query(
                "SELECT channel_id, guild_id, role_key, can_view, can_post
                 FROM channel_role_permission_overrides_v2
                 ORDER BY channel_id, role_key",
                &[],
            )
            .await
            .map_err(|error| {
                format!("tuple_backfill_list_channel_role_overrides_failed:{error}")
            })?;

        Ok(rows
            .iter()
            .map(|row| ChannelRoleOverrideRow {
                channel_id: row.get::<usize, i64>(0),
                guild_id: row.get::<usize, i64>(1),
                role_key: row.get::<usize, String>(2),
                can_view: row.get::<usize, Option<bool>>(3),
                can_post: row.get::<usize, Option<bool>>(4),
            })
            .collect())
    }

    async fn list_channel_user_overrides(&self) -> Result<Vec<ChannelUserOverrideRow>, String> {
        let rows = self
            .client
            .query(
                "SELECT channel_id, guild_id, user_id, can_view, can_post
                 FROM channel_user_permission_overrides_v2
                 ORDER BY channel_id, user_id",
                &[],
            )
            .await
            .map_err(|error| {
                format!("tuple_backfill_list_channel_user_overrides_failed:{error}")
            })?;

        Ok(rows
            .iter()
            .map(|row| ChannelUserOverrideRow {
                channel_id: row.get::<usize, i64>(0),
                guild_id: row.get::<usize, i64>(1),
                user_id: row.get::<usize, i64>(2),
                can_view: row.get::<usize, Option<bool>>(3),
                can_post: row.get::<usize, Option<bool>>(4),
            })
            .collect())
    }
}

/// Postgres outboxを用いたtuple同期ストア実装を表現する。
#[derive(Clone)]
pub struct PostgresTupleSyncOutboxStore {
    client: Arc<Client>,
}

impl PostgresTupleSyncOutboxStore {
    /// Postgres outbox ストアを生成する。
    /// @param client Postgresクライアント
    /// @returns outboxストア
    /// @throws なし
    pub fn new(client: Arc<Client>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl TupleSyncOutboxStore for PostgresTupleSyncOutboxStore {
    async fn claim_outbox_events(
        &self,
        limit: u32,
        lease_seconds: u32,
    ) -> Result<Vec<TupleSyncOutboxEvent>, String> {
        let limit_i32 = i32::try_from(limit)
            .map_err(|_| format!("tuple_sync_claim_limit_out_of_range:{limit}"))?;
        let lease_i32 = i32::try_from(lease_seconds)
            .map_err(|_| format!("tuple_sync_lease_seconds_out_of_range:{lease_seconds}"))?;

        let rows = self
            .client
            .query(
                "SELECT id, event_type, aggregate_id, payload::text
                 FROM claim_outbox_events($1, $2)",
                &[&limit_i32, &lease_i32],
            )
            .await
            .map_err(|error| format!("tuple_sync_claim_outbox_failed:{error}"))?;

        rows.iter()
            .map(|row| {
                let payload_text = row.get::<usize, String>(3);
                let payload = serde_json::from_str::<Value>(&payload_text).map_err(|error| {
                    format!(
                        "tuple_sync_claim_outbox_payload_parse_failed:event_id={} reason={}",
                        row.get::<usize, i64>(0),
                        error
                    )
                })?;

                Ok(TupleSyncOutboxEvent {
                    id: row.get::<usize, i64>(0),
                    event_type: row.get::<usize, String>(1),
                    aggregate_id: row.get::<usize, String>(2),
                    payload,
                })
            })
            .collect()
    }

    async fn mark_outbox_event_sent(&self, event_id: i64) -> Result<(), String> {
        self.client
            .execute("SELECT mark_outbox_event_sent($1)", &[&event_id])
            .await
            .map_err(|error| format!("tuple_sync_mark_sent_failed:{error}"))?;
        Ok(())
    }

    async fn mark_outbox_event_failed(
        &self,
        event_id: i64,
        retry_seconds: u32,
    ) -> Result<(), String> {
        let retry_i32 = i32::try_from(retry_seconds)
            .map_err(|_| format!("tuple_sync_retry_seconds_out_of_range:{retry_seconds}"))?;
        self.client
            .execute(
                "SELECT mark_outbox_event_failed($1, $2)",
                &[&event_id, &retry_i32],
            )
            .await
            .map_err(|error| format!("tuple_sync_mark_failed_failed:{error}"))?;
        Ok(())
    }
}

/// tuple mutation を no-op で受ける実装を表現する。
#[derive(Default)]
pub struct NoopTupleMutationSink;

#[async_trait]
impl TupleMutationSink for NoopTupleMutationSink {
    async fn apply_mutations(&self, mutations: Vec<SpiceDbTupleMutation>) -> Result<(), String> {
        tracing::info!(
            mutation_count = mutations.len(),
            "noop tuple mutation sink accepted mutations"
        );
        Ok(())
    }

    async fn list_current_tuples(&self) -> Result<Vec<SpiceDbTuple>, String> {
        Err("tuple_snapshot_unsupported".to_owned())
    }
}

/// テスト/検証用のインメモリtuple sinkを表現する。
#[derive(Default)]
pub struct InMemoryTupleMutationSink {
    tuples: RwLock<BTreeSet<SpiceDbTuple>>,
    failure_reason: RwLock<Option<String>>,
}

impl InMemoryTupleMutationSink {
    /// 保存中tupleのスナップショットを返す。
    /// @param なし
    /// @returns tuple一覧
    /// @throws なし
    pub async fn snapshot(&self) -> Vec<SpiceDbTuple> {
        self.tuples.read().await.iter().cloned().collect()
    }

    /// テスト用に初期tupleを投入する。
    /// @param tuples 追加するtuple一覧
    /// @returns なし
    /// @throws なし
    pub async fn seed_tuples(&self, tuples: Vec<SpiceDbTuple>) {
        let mut current = self.tuples.write().await;
        for tuple in tuples {
            current.insert(tuple);
        }
    }

    /// mutation適用時に返す失敗理由を設定する。
    /// @param reason 失敗理由（Noneで解除）
    /// @returns なし
    /// @throws なし
    pub async fn set_failure_reason(&self, reason: Option<String>) {
        *self.failure_reason.write().await = reason;
    }
}

#[async_trait]
impl TupleMutationSink for InMemoryTupleMutationSink {
    async fn apply_mutations(&self, mutations: Vec<SpiceDbTupleMutation>) -> Result<(), String> {
        if let Some(reason) = self.failure_reason.read().await.clone() {
            return Err(reason);
        }

        let mut tuples = self.tuples.write().await;
        for mutation in mutations {
            match mutation {
                SpiceDbTupleMutation::Upsert(tuple) => {
                    tuples.insert(tuple);
                }
                SpiceDbTupleMutation::Delete(tuple) => {
                    tuples.remove(&tuple);
                }
            }
        }

        Ok(())
    }

    async fn list_current_tuples(&self) -> Result<Vec<SpiceDbTuple>, String> {
        Ok(self.snapshot().await)
    }
}

/// tuple同期メトリクスを保持する。
#[derive(Default)]
pub struct AuthzTupleSyncMetrics {
    outbox_claimed_total: AtomicU64,
    outbox_succeeded_total: AtomicU64,
    outbox_failed_total: AtomicU64,
    outbox_full_resync_total: AtomicU64,
    backfill_runs_total: AtomicU64,
    backfill_generated_tuples_total: AtomicU64,
    tuple_mutations_applied_total: AtomicU64,
    sync_apply_failure_total: AtomicU64,
}

/// tuple同期メトリクスのスナップショットを保持する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AuthzTupleSyncMetricsSnapshot {
    pub outbox_claimed_total: u64,
    pub outbox_succeeded_total: u64,
    pub outbox_failed_total: u64,
    pub outbox_full_resync_total: u64,
    pub backfill_runs_total: u64,
    pub backfill_generated_tuples_total: u64,
    pub tuple_mutations_applied_total: u64,
    pub sync_apply_failure_total: u64,
}

impl AuthzTupleSyncMetrics {
    /// outbox claim 件数を記録する。
    /// @param count claim 件数
    /// @returns なし
    /// @throws なし
    pub fn record_outbox_claimed(&self, count: u64) {
        self.outbox_claimed_total
            .fetch_add(count, Ordering::Relaxed);
    }

    /// outboxイベント成功を記録する。
    /// @param applied_mutations 適用したmutation件数
    /// @param full_resync フル再同期イベントかどうか
    /// @returns なし
    /// @throws なし
    pub fn record_outbox_success(&self, applied_mutations: u64, full_resync: bool) {
        self.outbox_succeeded_total.fetch_add(1, Ordering::Relaxed);
        if full_resync {
            self.outbox_full_resync_total
                .fetch_add(1, Ordering::Relaxed);
        }
        self.tuple_mutations_applied_total
            .fetch_add(applied_mutations, Ordering::Relaxed);
    }

    /// outboxイベント失敗を記録する。
    /// @param なし
    /// @returns なし
    /// @throws なし
    pub fn record_outbox_failed(&self) {
        self.outbox_failed_total.fetch_add(1, Ordering::Relaxed);
    }

    /// backfill結果を記録する。
    /// @param generated_tuples 生成したtuple件数
    /// @param applied_mutations 適用したmutation件数
    /// @returns なし
    /// @throws なし
    pub fn record_backfill(&self, generated_tuples: u64, applied_mutations: u64) {
        self.backfill_runs_total.fetch_add(1, Ordering::Relaxed);
        self.backfill_generated_tuples_total
            .fetch_add(generated_tuples, Ordering::Relaxed);
        self.tuple_mutations_applied_total
            .fetch_add(applied_mutations, Ordering::Relaxed);
    }

    /// 同期適用失敗を記録する。
    /// @param なし
    /// @returns なし
    /// @throws なし
    pub fn record_sync_apply_failure(&self) {
        self.sync_apply_failure_total
            .fetch_add(1, Ordering::Relaxed);
    }

    /// メトリクスの現在値を返す。
    /// @param なし
    /// @returns スナップショット
    /// @throws なし
    pub fn snapshot(&self) -> AuthzTupleSyncMetricsSnapshot {
        AuthzTupleSyncMetricsSnapshot {
            outbox_claimed_total: self.outbox_claimed_total.load(Ordering::Relaxed),
            outbox_succeeded_total: self.outbox_succeeded_total.load(Ordering::Relaxed),
            outbox_failed_total: self.outbox_failed_total.load(Ordering::Relaxed),
            outbox_full_resync_total: self.outbox_full_resync_total.load(Ordering::Relaxed),
            backfill_runs_total: self.backfill_runs_total.load(Ordering::Relaxed),
            backfill_generated_tuples_total: self
                .backfill_generated_tuples_total
                .load(Ordering::Relaxed),
            tuple_mutations_applied_total: self
                .tuple_mutations_applied_total
                .load(Ordering::Relaxed),
            sync_apply_failure_total: self.sync_apply_failure_total.load(Ordering::Relaxed),
        }
    }
}

/// tuple同期のユースケース実装を表現する。
pub struct AuthzTupleSyncService {
    outbox_store: Arc<dyn TupleSyncOutboxStore>,
    backfill_source: Arc<dyn TupleBackfillSource>,
    sink: Arc<dyn TupleMutationSink>,
    metrics: Arc<AuthzTupleSyncMetrics>,
    config: SpiceDbTupleSyncRuntimeConfig,
}

impl AuthzTupleSyncService {
    /// tuple同期サービスを生成する。
    /// @param outbox_store outboxストア
    /// @param backfill_source backfillソース
    /// @param sink mutation適用先
    /// @param metrics メトリクス集計器
    /// @param config 同期設定
    /// @returns tuple同期サービス
    /// @throws なし
    pub fn new(
        outbox_store: Arc<dyn TupleSyncOutboxStore>,
        backfill_source: Arc<dyn TupleBackfillSource>,
        sink: Arc<dyn TupleMutationSink>,
        metrics: Arc<AuthzTupleSyncMetrics>,
        config: SpiceDbTupleSyncRuntimeConfig,
    ) -> Self {
        Self {
            outbox_store,
            backfill_source,
            sink,
            metrics,
            config,
        }
    }

    /// メトリクス参照を返す。
    /// @param なし
    /// @returns メトリクス参照
    /// @throws なし
    pub fn metrics(&self) -> Arc<AuthzTupleSyncMetrics> {
        Arc::clone(&self.metrics)
    }

    /// 現在のPostgres状態をフルbackfillとして同期する。
    /// @param なし
    /// @returns backfill実行結果
    /// @throws String 読み取り/適用失敗時
    pub async fn run_backfill_once(&self) -> Result<TupleBackfillReport, String> {
        let guild_roles = self.backfill_source.list_guild_roles().await?;
        let guild_member_roles = self.backfill_source.list_guild_member_roles().await?;
        let channel_role_overrides = self.backfill_source.list_channel_role_overrides().await?;
        let channel_user_overrides = self.backfill_source.list_channel_user_overrides().await?;

        let input = TupleBackfillInput {
            guild_roles,
            guild_member_roles,
            channel_role_overrides,
            channel_user_overrides,
        };

        let expected_tuples = build_backfill_tuples(&input);
        let generated_tuple_count = expected_tuples.len() as u64;
        let observed_tuples = self
            .sink
            .list_current_tuples()
            .await
            .map_err(|error| format!("tuple_backfill_list_current_tuples_failed:{error}"))?;
        let observed_managed_tuples: Vec<SpiceDbTuple> = observed_tuples
            .into_iter()
            .filter(is_tuple_sync_managed_tuple)
            .collect();
        let drift_report = detect_tuple_drift(&expected_tuples, &observed_managed_tuples);
        let mutations = build_resync_mutations(&drift_report);

        let applied_mutation_count = mutations.len() as u64;
        if !mutations.is_empty() {
            if let Err(error) = self.sink.apply_mutations(mutations).await {
                self.metrics.record_sync_apply_failure();
                return Err(format!("tuple_backfill_apply_failed:{error}"));
            }
        }

        self.metrics
            .record_backfill(generated_tuple_count, applied_mutation_count);

        tracing::info!(
            guild_role_rows = input.guild_roles.len(),
            guild_member_role_rows = input.guild_member_roles.len(),
            channel_role_override_rows = input.channel_role_overrides.len(),
            channel_user_override_rows = input.channel_user_overrides.len(),
            generated_tuple_count,
            applied_mutation_count,
            missing_tuple_count = drift_report.missing_tuples.len(),
            unexpected_tuple_count = drift_report.unexpected_tuples.len(),
            "authz tuple backfill completed"
        );

        Ok(TupleBackfillReport {
            guild_role_rows: input.guild_roles.len() as u64,
            guild_member_role_rows: input.guild_member_roles.len() as u64,
            channel_role_override_rows: input.channel_role_overrides.len() as u64,
            channel_user_override_rows: input.channel_user_overrides.len() as u64,
            generated_tuple_count,
            applied_mutation_count,
        })
    }

    /// outboxを1回処理して差分同期を実行する。
    /// @param なし
    /// @returns 同期実行結果
    /// @throws String outbox操作失敗時
    pub async fn run_sync_once(&self) -> Result<TupleSyncRunReport, String> {
        let claimed = self
            .outbox_store
            .claim_outbox_events(
                self.config.outbox_claim_limit,
                self.config.outbox_lease_seconds,
            )
            .await?;

        self.metrics.record_outbox_claimed(claimed.len() as u64);

        let mut report = TupleSyncRunReport {
            claimed_events: claimed.len() as u64,
            ..TupleSyncRunReport::default()
        };

        for event in claimed {
            match self.process_claimed_event(&event).await {
                Ok(result) => {
                    if let Err(error) = self.outbox_store.mark_outbox_event_sent(event.id).await {
                        self.metrics.record_outbox_failed();
                        report.failed_events += 1;
                        tracing::warn!(
                            event_id = event.id,
                            event_type = %event.event_type,
                            aggregate_id = %event.aggregate_id,
                            reason = %error,
                            "authz tuple sync mark sent failed; scheduling retry"
                        );
                        if let Err(mark_error) = self
                            .outbox_store
                            .mark_outbox_event_failed(event.id, self.config.outbox_retry_seconds)
                            .await
                        {
                            return Err(format!(
                                "tuple_sync_mark_sent_recover_failed:event_id={} reason={} mark_error={}",
                                event.id, error, mark_error
                            ));
                        }
                        continue;
                    }

                    report.succeeded_events += 1;
                    report.applied_mutations += result.applied_mutations;
                    if result.full_resync {
                        report.full_resync_events += 1;
                    }

                    let metrics_applied_mutations = if result.full_resync {
                        0
                    } else {
                        result.applied_mutations
                    };
                    self.metrics
                        .record_outbox_success(metrics_applied_mutations, result.full_resync);
                }
                Err(reason) => {
                    self.metrics.record_outbox_failed();
                    report.failed_events += 1;
                    tracing::warn!(
                        event_id = event.id,
                        event_type = %event.event_type,
                        aggregate_id = %event.aggregate_id,
                        reason = %reason,
                        "authz tuple sync event failed"
                    );
                    if let Err(mark_error) = self
                        .outbox_store
                        .mark_outbox_event_failed(event.id, self.config.outbox_retry_seconds)
                        .await
                    {
                        return Err(format!(
                            "tuple_sync_mark_failed_failed:event_id={} reason={} mark_error={}",
                            event.id, reason, mark_error
                        ));
                    }
                }
            }
        }

        Ok(report)
    }

    async fn process_claimed_event(
        &self,
        event: &TupleSyncOutboxEvent,
    ) -> Result<ProcessedEventResult, String> {
        let command = build_tuple_sync_command(event)?;
        match command {
            TupleSyncCommand::Mutations(mutations) => {
                let mutation_count = mutations.len() as u64;
                if let Err(error) = self.sink.apply_mutations(mutations).await {
                    self.metrics.record_sync_apply_failure();
                    return Err(format!("tuple_sync_apply_failed:{error}"));
                }

                Ok(ProcessedEventResult {
                    applied_mutations: mutation_count,
                    full_resync: false,
                })
            }
            TupleSyncCommand::FullResync { reason } => {
                tracing::warn!(
                    reason = ?reason,
                    event_type = %event.event_type,
                    aggregate_id = %event.aggregate_id,
                    "authz tuple full resync requested"
                );
                let backfill_report = self.run_backfill_once().await?;
                Ok(ProcessedEventResult {
                    applied_mutations: backfill_report.applied_mutation_count,
                    full_resync: true,
                })
            }
        }
    }
}

struct ProcessedEventResult {
    applied_mutations: u64,
    full_resync: bool,
}

fn build_guild_role_mutations(
    payload: GuildRoleOutboxPayload,
) -> Result<Vec<SpiceDbTupleMutation>, String> {
    let candidates = guild_role_candidate_tuples(payload.guild_id, &payload.role_key);

    match payload.op {
        TupleSyncOperation::Delete => Ok(build_delete_mutations(candidates)),
        TupleSyncOperation::Upsert => {
            let row = GuildRolePermissionRow {
                guild_id: payload.guild_id,
                role_key: payload.role_key,
                allow_view: require_payload_bool(
                    payload.allow_view,
                    "allow_view",
                    AUTHZ_TUPLE_EVENT_GUILD_ROLE,
                )?,
                allow_post: require_payload_bool(
                    payload.allow_post,
                    "allow_post",
                    AUTHZ_TUPLE_EVENT_GUILD_ROLE,
                )?,
                allow_manage: require_payload_bool(
                    payload.allow_manage,
                    "allow_manage",
                    AUTHZ_TUPLE_EVENT_GUILD_ROLE,
                )?,
            };
            let desired = map_guild_role_permissions_to_tuples(&row);
            Ok(build_replace_mutations(candidates, desired))
        }
    }
}

fn build_guild_member_role_mutations(
    payload: GuildMemberRoleOutboxPayload,
) -> Vec<SpiceDbTupleMutation> {
    let tuple = map_guild_member_role_to_tuple(&GuildMemberRoleRow {
        guild_id: payload.guild_id,
        user_id: payload.user_id,
        role_key: payload.role_key,
    });

    match payload.op {
        TupleSyncOperation::Delete => vec![SpiceDbTupleMutation::Delete(tuple)],
        TupleSyncOperation::Upsert => vec![
            SpiceDbTupleMutation::Delete(tuple.clone()),
            SpiceDbTupleMutation::Upsert(tuple),
        ],
    }
}

fn build_channel_role_override_mutations(
    payload: ChannelRoleOverrideOutboxPayload,
) -> Result<Vec<SpiceDbTupleMutation>, String> {
    let candidates = channel_role_override_candidate_tuples(
        payload.channel_id,
        payload.guild_id,
        &payload.role_key,
    );

    match payload.op {
        TupleSyncOperation::Delete => Ok(build_delete_mutations(candidates)),
        TupleSyncOperation::Upsert => {
            let can_view = require_payload_nullable_bool(
                payload.can_view,
                "can_view",
                AUTHZ_TUPLE_EVENT_CHANNEL_ROLE_OVERRIDE,
            )?;
            let can_post = require_payload_nullable_bool(
                payload.can_post,
                "can_post",
                AUTHZ_TUPLE_EVENT_CHANNEL_ROLE_OVERRIDE,
            )?;
            let desired = map_channel_role_override_to_tuples(&ChannelRoleOverrideRow {
                channel_id: payload.channel_id,
                guild_id: payload.guild_id,
                role_key: payload.role_key,
                can_view,
                can_post,
            });
            Ok(build_replace_mutations(candidates, desired))
        }
    }
}

fn build_channel_user_override_mutations(
    payload: ChannelUserOverrideOutboxPayload,
) -> Result<Vec<SpiceDbTupleMutation>, String> {
    let candidates = channel_user_override_candidate_tuples(payload.channel_id, payload.user_id);

    match payload.op {
        TupleSyncOperation::Delete => Ok(build_delete_mutations(candidates)),
        TupleSyncOperation::Upsert => {
            let can_view = require_payload_nullable_bool(
                payload.can_view,
                "can_view",
                AUTHZ_TUPLE_EVENT_CHANNEL_USER_OVERRIDE,
            )?;
            let can_post = require_payload_nullable_bool(
                payload.can_post,
                "can_post",
                AUTHZ_TUPLE_EVENT_CHANNEL_USER_OVERRIDE,
            )?;
            let desired = map_channel_user_override_to_tuples(&ChannelUserOverrideRow {
                channel_id: payload.channel_id,
                guild_id: payload.guild_id,
                user_id: payload.user_id,
                can_view,
                can_post,
            });
            Ok(build_replace_mutations(candidates, desired))
        }
    }
}

fn parse_optional_u32_env(name: &str, default: u32) -> Result<u32, String> {
    match env::var(name) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err(format!("{name} must not be empty when set"));
            }
            let parsed = trimmed
                .parse::<u32>()
                .map_err(|error| format!("{name} must be a valid u32 (reason: {error})"))?;
            if parsed == 0 {
                return Err(format!("{name} must be greater than 0"));
            }
            Ok(parsed)
        }
        Err(_) => Ok(default),
    }
}

fn parse_json_payload<T>(event: &TupleSyncOutboxEvent) -> Result<T, String>
where
    T: DeserializeOwned,
{
    serde_json::from_value(event.payload.clone()).map_err(|error| {
        format!(
            "invalid payload for {} (event_id={}, reason={})",
            event.event_type, event.id, error
        )
    })
}

fn parse_optional_json_payload<T>(event: &TupleSyncOutboxEvent) -> Result<T, String>
where
    T: DeserializeOwned + Default,
{
    if event.payload.is_null() {
        return Ok(T::default());
    }

    parse_json_payload(event)
}

fn require_payload_bool(
    value: Option<bool>,
    field: &str,
    event_type: &str,
) -> Result<bool, String> {
    value.ok_or_else(|| format!("{event_type} requires bool field: {field}"))
}

fn require_payload_nullable_bool(
    value: PayloadBoolField,
    field: &str,
    event_type: &str,
) -> Result<Option<bool>, String> {
    match value {
        PayloadBoolField::Missing => Err(format!("{event_type} requires field: {field}")),
        PayloadBoolField::Null => Ok(None),
        PayloadBoolField::Value(value) => Ok(Some(value)),
    }
}

fn deserialize_payload_bool_field<'de, D>(deserializer: D) -> Result<PayloadBoolField, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Value::deserialize(deserializer)?;
    if value.is_null() {
        return Ok(PayloadBoolField::Null);
    }
    let parsed = bool::deserialize(value).map_err(serde::de::Error::custom)?;
    Ok(PayloadBoolField::Value(parsed))
}

fn build_replace_mutations(
    candidates: Vec<SpiceDbTuple>,
    desired: Vec<SpiceDbTuple>,
) -> Vec<SpiceDbTupleMutation> {
    let mut mutations = Vec::new();

    for tuple in BTreeSet::<SpiceDbTuple>::from_iter(candidates) {
        mutations.push(SpiceDbTupleMutation::Delete(tuple));
    }

    for tuple in BTreeSet::<SpiceDbTuple>::from_iter(desired) {
        mutations.push(SpiceDbTupleMutation::Upsert(tuple));
    }

    mutations
}

fn build_delete_mutations(candidates: Vec<SpiceDbTuple>) -> Vec<SpiceDbTupleMutation> {
    BTreeSet::<SpiceDbTuple>::from_iter(candidates)
        .into_iter()
        .map(SpiceDbTupleMutation::Delete)
        .collect()
}

fn guild_role_candidate_tuples(guild_id: i64, role_key: &str) -> Vec<SpiceDbTuple> {
    let object = guild_object(guild_id);
    let subject = role_member_subject(guild_id, role_key);
    vec![
        SpiceDbTuple::new(object.clone(), GUILD_MANAGER_RELATION, subject.clone()),
        SpiceDbTuple::new(object.clone(), GUILD_VIEWER_RELATION, subject.clone()),
        SpiceDbTuple::new(object, GUILD_POSTER_RELATION, subject),
    ]
}

fn channel_role_override_candidate_tuples(
    channel_id: i64,
    guild_id: i64,
    role_key: &str,
) -> Vec<SpiceDbTuple> {
    let object = channel_object(channel_id);
    let subject = role_member_subject(guild_id, role_key);
    vec![
        SpiceDbTuple::new(
            object.clone(),
            CHANNEL_VIEWER_ROLE_RELATION,
            subject.clone(),
        ),
        SpiceDbTuple::new(
            object.clone(),
            CHANNEL_VIEW_DENY_ROLE_RELATION,
            subject.clone(),
        ),
        SpiceDbTuple::new(
            object.clone(),
            CHANNEL_POSTER_ROLE_RELATION,
            subject.clone(),
        ),
        SpiceDbTuple::new(object, CHANNEL_POST_DENY_ROLE_RELATION, subject),
    ]
}

fn channel_user_override_candidate_tuples(channel_id: i64, user_id: i64) -> Vec<SpiceDbTuple> {
    let object = channel_object(channel_id);
    let subject = user_subject(user_id);
    vec![
        SpiceDbTuple::new(
            object.clone(),
            CHANNEL_VIEWER_USER_RELATION,
            subject.clone(),
        ),
        SpiceDbTuple::new(
            object.clone(),
            CHANNEL_VIEW_DENY_USER_RELATION,
            subject.clone(),
        ),
        SpiceDbTuple::new(
            object.clone(),
            CHANNEL_POSTER_USER_RELATION,
            subject.clone(),
        ),
        SpiceDbTuple::new(object, CHANNEL_POST_DENY_USER_RELATION, subject),
    ]
}

fn map_channel_guild_tuple(channel_id: i64, guild_id: i64) -> SpiceDbTuple {
    SpiceDbTuple::new(
        channel_object(channel_id),
        CHANNEL_GUILD_RELATION,
        guild_object(guild_id),
    )
}

fn role_object(guild_id: i64, role_key: &str) -> String {
    format!("role:{guild_id}/{role_key}")
}

fn guild_object(guild_id: i64) -> String {
    format!("guild:{guild_id}")
}

fn channel_object(channel_id: i64) -> String {
    format!("channel:{channel_id}")
}

fn role_member_subject(guild_id: i64, role_key: &str) -> String {
    format!("{}#member", role_object(guild_id, role_key))
}

fn user_subject(user_id: i64) -> String {
    format!("user:{user_id}")
}

fn is_tuple_sync_managed_tuple(tuple: &SpiceDbTuple) -> bool {
    let object = tuple.object.as_str();
    let relation = tuple.relation.as_str();

    if object.starts_with("role:") && relation == ROLE_MEMBER_RELATION {
        return true;
    }
    if object.starts_with("guild:")
        && matches!(
            relation,
            GUILD_MANAGER_RELATION | GUILD_VIEWER_RELATION | GUILD_POSTER_RELATION
        )
    {
        return true;
    }
    if object.starts_with("channel:")
        && matches!(
            relation,
            CHANNEL_GUILD_RELATION
                | CHANNEL_VIEWER_ROLE_RELATION
                | CHANNEL_VIEW_DENY_ROLE_RELATION
                | CHANNEL_POSTER_ROLE_RELATION
                | CHANNEL_POST_DENY_ROLE_RELATION
                | CHANNEL_VIEWER_USER_RELATION
                | CHANNEL_VIEW_DENY_USER_RELATION
                | CHANNEL_POSTER_USER_RELATION
                | CHANNEL_POST_DENY_USER_RELATION
        )
    {
        return true;
    }

    false
}
