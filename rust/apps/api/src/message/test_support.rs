use std::{
    env,
    sync::{
        atomic::{AtomicI64, Ordering},
        Arc,
    },
};

use linklynx_message_domain::{LiveMessageUsecase, MessageUsecase};
use linklynx_platform_postgres_message::PostgresMessageMetadataRepository;
use linklynx_platform_scylla_message::ScyllaMessageStore;
use scylla::{
    client::{session::Session, session_builder::SessionBuilder},
    value::CqlTimestamp,
};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use tokio_postgres::NoTls;

use super::{MessageService, RuntimeMessageService};

static NEXT_INTEGRATION_ID: AtomicI64 = AtomicI64::new(950_000);

/// integration 用の seed message 行を表現する。
#[derive(Clone, Copy)]
pub(crate) struct SeedMessageRow {
    pub(crate) message_id: i64,
    pub(crate) author_id: i64,
    pub(crate) created_at: &'static str,
}

/// message integration test が有効かを返す。
/// @param なし
/// @returns `MESSAGE_SCYLLA_INTEGRATION` が truthy の場合は `true`
/// @throws なし
pub(crate) fn integration_test_enabled() -> bool {
    env::var("MESSAGE_SCYLLA_INTEGRATION")
        .ok()
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

/// integration test 用の一意な ID block を確保する。
/// @param width 確保する連続 ID 幅
/// @returns 予約済み block の先頭 ID
/// @throws なし
pub(crate) fn next_integration_id_block(width: i64) -> i64 {
    NEXT_INTEGRATION_ID.fetch_add(width, Ordering::Relaxed)
}

/// integration 用の Postgres URL を返す。
/// @param なし
/// @returns integration 向け Postgres URL
/// @throws なし
fn integration_database_url() -> String {
    env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/linklynx".to_owned())
}

/// integration 用の Scylla host 一覧を返す。
/// @param なし
/// @returns integration 向け Scylla host 一覧
/// @throws なし
fn integration_scylla_hosts() -> Vec<String> {
    env::var("SCYLLA_HOSTS")
        .ok()
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .filter(|hosts| !hosts.is_empty())
        .unwrap_or_else(|| vec!["127.0.0.1:9042".to_owned()])
}

/// integration 用の Scylla keyspace を返す。
/// @param なし
/// @returns integration 向け Scylla keyspace
/// @throws なし
fn integration_scylla_keyspace() -> String {
    env::var("SCYLLA_KEYSPACE").unwrap_or_else(|_| "chat".to_owned())
}

/// integration 用 messages table 名を構築する。
/// @param keyspace 対象 keyspace 名
/// @returns fully-qualified messages table 名
/// @throws panic keyspace が英数字/アンダースコア規約に違反する場合
fn qualify_integration_messages_table(keyspace: &str) -> String {
    let mut chars = keyspace.chars();
    let Some(first) = chars.next() else {
        panic!("invalid integration keyspace");
    };
    assert!(
        first.is_ascii_alphabetic()
            && chars.all(|value| value.is_ascii_alphanumeric() || value == '_'),
        "invalid integration keyspace"
    );
    format!("{keyspace}.messages_by_channel")
}

/// RFC3339 timestamp から Scylla bucket を算出する。
/// @param value RFC3339 timestamp
/// @returns `YYYYMMDD` 形式の bucket 値
/// @throws panic timestamp を parse できない場合
pub(crate) fn bucket_from_created_at(value: &str) -> i32 {
    let parsed = OffsetDateTime::parse(value, &Rfc3339).expect("timestamp should parse");
    let date = parsed.date();
    date.year() * 10_000 + date.month() as i32 * 100 + date.day() as i32
}

/// integration 用の Postgres client を接続する。
/// @param なし
/// @returns integration 有効時は `(database_url, client)`、無効時は `None`
/// @throws panic integration 有効時に Postgres へ接続できない場合
pub(crate) async fn connect_integration_database() -> Option<(String, tokio_postgres::Client)> {
    if !integration_test_enabled() {
        return None;
    }

    let database_url = integration_database_url();
    let (client, connection) = tokio_postgres::connect(&database_url, NoTls)
        .await
        .expect("failed to connect integration postgres");
    tokio::spawn(async move {
        if let Err(error) = connection.await {
            panic!("message integration postgres connection failed: {error}");
        }
    });

    Some((database_url, client))
}

/// integration 用の Scylla session を接続する。
/// @param なし
/// @returns integration 有効時は `(session, keyspace)`、無効時は `None`
/// @throws panic integration 有効時に Scylla へ接続できない場合
pub(crate) async fn connect_integration_scylla() -> Option<(Session, String)> {
    if !integration_test_enabled() {
        return None;
    }

    let mut builder = SessionBuilder::new();
    for host in integration_scylla_hosts() {
        builder = builder.known_node(host);
    }
    let session = builder
        .build()
        .await
        .expect("failed to connect integration scylla");

    Some((session, integration_scylla_keyspace()))
}

/// integration 用の user row を seed する。
/// @param client Postgres client
/// @param user_id seed 対象 user_id
/// @param label email/display 名に付与する label
/// @returns `()`
/// @throws panic seed SQL が失敗した場合
pub(crate) async fn seed_user(client: &tokio_postgres::Client, user_id: i64, label: &str) {
    client
        .execute(
            "INSERT INTO users (id, email, display_name, theme)
             VALUES ($1, $2, $3, 'dark')
             ON CONFLICT (id)
             DO UPDATE SET
               email = EXCLUDED.email,
               display_name = EXCLUDED.display_name,
               theme = EXCLUDED.theme",
            &[
                &user_id,
                &format!("{label}-{user_id}@example.com"),
                &format!("{label}-{user_id}"),
            ],
        )
        .await
        .expect("failed to seed user");
}

/// integration 用の guild text channel を seed する。
/// @param client Postgres client
/// @param guild_id seed 対象 guild_id
/// @param owner_id guild owner / channel creator
/// @param channel_id seed 対象 channel_id
/// @param channel_created_at channel 作成時刻
/// @returns `()`
/// @throws panic guild/channel seed SQL が失敗した場合
pub(crate) async fn seed_guild_text_channel(
    client: &tokio_postgres::Client,
    guild_id: i64,
    owner_id: i64,
    channel_id: i64,
    channel_created_at: &str,
) {
    client
        .execute(
            "INSERT INTO guilds (id, name, owner_id, created_at)
             VALUES ($1, $2, $3, CAST($4 AS text)::timestamptz)
             ON CONFLICT (id)
             DO UPDATE SET
               name = EXCLUDED.name,
               owner_id = EXCLUDED.owner_id,
               created_at = EXCLUDED.created_at",
            &[
                &guild_id,
                &format!("Guild {guild_id}"),
                &owner_id,
                &channel_created_at,
            ],
        )
        .await
        .expect("failed to seed guild");
    client
        .execute(
            "INSERT INTO channels (id, type, guild_id, name, created_by, created_at)
             VALUES ($1, 'guild_text', $2, $3, $4, CAST($5 AS text)::timestamptz)
             ON CONFLICT (id)
             DO UPDATE SET
               guild_id = EXCLUDED.guild_id,
               name = EXCLUDED.name,
               created_by = EXCLUDED.created_by,
               created_at = EXCLUDED.created_at",
            &[
                &channel_id,
                &guild_id,
                &format!("channel-{channel_id}"),
                &owner_id,
                &channel_created_at,
            ],
        )
        .await
        .expect("failed to seed channel");
}

/// integration 用の channel_last_message を upsert する。
/// @param client Postgres client
/// @param channel_id 対象 channel_id
/// @param last_message_id 記録する最新 message_id
/// @param last_message_at 記録する最新 created_at
/// @returns `()`
/// @throws panic upsert SQL が失敗した場合
pub(crate) async fn upsert_channel_last_message(
    client: &tokio_postgres::Client,
    channel_id: i64,
    last_message_id: i64,
    last_message_at: &str,
) {
    client
        .execute(
            "INSERT INTO channel_last_message (channel_id, last_message_id, last_message_at)
             VALUES ($1, $2, CAST($3 AS text)::timestamptz)
             ON CONFLICT (channel_id)
             DO UPDATE SET
               last_message_id = EXCLUDED.last_message_id,
               last_message_at = EXCLUDED.last_message_at,
               updated_at = now()",
            &[&channel_id, &last_message_id, &last_message_at],
        )
        .await
        .expect("failed to upsert channel_last_message");
}

/// integration 用の channel_last_message を取得する。
/// @param client Postgres client
/// @param channel_id 対象 channel_id
/// @returns `(last_message_id, last_message_at)`
/// @throws panic query が失敗した場合
pub(crate) async fn query_last_message(
    client: &tokio_postgres::Client,
    channel_id: i64,
) -> (i64, String) {
    let row = client
        .query_one(
            "SELECT
                last_message_id,
                to_char(
                  last_message_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'
                ) AS last_message_at
             FROM channel_last_message
             WHERE channel_id = $1",
            &[&channel_id],
        )
        .await
        .expect("failed to fetch channel_last_message");
    (row.get("last_message_id"), row.get("last_message_at"))
}

/// integration 用の Scylla message row を seed する。
/// @param session Scylla session
/// @param keyspace 対象 keyspace
/// @param channel_id 対象 channel_id
/// @param bucket 書き込み先 bucket
/// @param row seed 内容
/// @returns `()`
/// @throws panic Scylla insert が失敗した場合
pub(crate) async fn insert_scylla_message(
    session: &Session,
    keyspace: &str,
    channel_id: i64,
    bucket: i32,
    row: SeedMessageRow,
) {
    let messages_table = qualify_integration_messages_table(keyspace);
    let sql = format!(
        "INSERT INTO {messages_table} (
           channel_id,
           bucket,
           message_id,
           author_id,
           content,
           version,
           edited_at,
           is_deleted,
           deleted_at,
           deleted_by,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    session
        .query_unpaged(
            sql,
            (
                channel_id,
                bucket,
                row.message_id,
                row.author_id,
                format!("message-{}", row.message_id),
                1_i64,
                Option::<CqlTimestamp>::None,
                false,
                Option::<CqlTimestamp>::None,
                Option::<i64>::None,
                timestamp_to_cql(row.created_at),
            ),
        )
        .await
        .expect("failed to seed scylla message");
}

/// integration 用の Scylla row 件数を返す。
/// @param session Scylla session
/// @param keyspace 対象 keyspace
/// @param channel_id 対象 channel_id
/// @param bucket 集計対象 bucket
/// @returns 指定 partition の row 件数
/// @throws panic count query または decode が失敗した場合
pub(crate) async fn count_scylla_messages(
    session: &Session,
    keyspace: &str,
    channel_id: i64,
    bucket: i32,
) -> i64 {
    let messages_table = qualify_integration_messages_table(keyspace);
    let sql = format!(
        "SELECT COUNT(*) FROM {messages_table}
         WHERE channel_id = ?
           AND bucket = ?"
    );
    let rows = session
        .query_unpaged(sql, (channel_id, bucket))
        .await
        .expect("failed to count scylla rows")
        .into_rows_result()
        .expect("count rows unavailable");
    rows.maybe_first_row::<(i64,)>()
        .expect("count row decode failed")
        .expect("count row missing")
        .0
}

/// RFC3339 timestamp を CQL timestamp へ変換する。
/// @param value RFC3339 timestamp
/// @returns CQL timestamp
/// @throws panic timestamp を parse できない場合
fn timestamp_to_cql(value: &str) -> CqlTimestamp {
    let parsed = OffsetDateTime::parse(value, &Rfc3339).expect("timestamp should parse");
    CqlTimestamp(parsed.unix_timestamp() * 1000 + i64::from(parsed.millisecond()))
}

/// live message usecase を integration 用に構築する。
/// @param database_url Postgres 接続文字列
/// @param session 初期化済み Scylla session
/// @param keyspace 対象 keyspace
/// @returns integration 用 live usecase
/// @throws panic Scylla message store 初期化が失敗した場合
pub(crate) fn build_live_usecase(
    database_url: String,
    session: Session,
    keyspace: String,
) -> LiveMessageUsecase {
    let metadata = Arc::new(PostgresMessageMetadataRepository::new(database_url, true));
    LiveMessageUsecase::new(
        Arc::new(ScyllaMessageStore::new(session, keyspace).expect("valid scylla keyspace")),
        metadata.clone(),
        metadata,
    )
}

/// live message service を integration 用に構築する。
/// @param database_url Postgres 接続文字列
/// @param session 初期化済み Scylla session
/// @param keyspace 対象 keyspace
/// @returns integration 用 live message service
/// @throws panic 下位 usecase 構築が失敗した場合
pub(crate) fn build_live_message_service(
    database_url: String,
    session: Session,
    keyspace: String,
) -> Arc<dyn MessageService> {
    let usecase: Arc<dyn MessageUsecase> =
        Arc::new(build_live_usecase(database_url, session, keyspace));
    Arc::new(RuntimeMessageService::new(usecase))
}
