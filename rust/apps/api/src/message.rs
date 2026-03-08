use std::{
    env,
    sync::{
        atomic::{AtomicI64, Ordering},
        Arc,
    },
};

use async_trait::async_trait;
use linklynx_message_api::{
    CreateGuildChannelMessageResponseV1, ListGuildChannelMessagesResponseV1,
};
use linklynx_message_domain::{
    CreateGuildChannelMessageCommand, DefaultMessageService, ListGuildChannelMessagesCommand,
    MessageClock, MessageDomainError, MessageIdGenerator, MessageService,
};
use linklynx_postgres_message::PostgresMessageMetadataRepository;
use linklynx_scylla_message::ScyllaMessageRepository;
use scylla::client::session_builder::SessionBuilder;
use time::OffsetDateTime;
use tokio::time::{timeout, Duration};
use tokio_postgres::NoTls;
use tracing::warn;

use crate::scylla_health::build_scylla_runtime_config_from_env;

/// 依存未構成時に fail-close する message service を表現する。
#[derive(Clone)]
pub struct UnavailableMessageService {
    reason: Arc<str>,
}

impl UnavailableMessageService {
    /// 依存未構成 service を生成する。
    /// @param reason 障害理由
    /// @returns fail-close service
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: Arc::from(reason.into()),
        }
    }

    fn unavailable_error(&self) -> MessageDomainError {
        MessageDomainError::dependency_unavailable(self.reason.as_ref())
    }
}

#[async_trait]
impl MessageService for UnavailableMessageService {
    async fn list_guild_channel_messages(
        &self,
        _command: ListGuildChannelMessagesCommand,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageDomainError> {
        Err(self.unavailable_error())
    }

    async fn create_guild_channel_message(
        &self,
        _command: CreateGuildChannelMessageCommand,
    ) -> Result<CreateGuildChannelMessageResponseV1, MessageDomainError> {
        Err(self.unavailable_error())
    }
}

struct SystemMessageClock;

impl MessageClock for SystemMessageClock {
    fn now_created_at(&self) -> String {
        let now = OffsetDateTime::now_utc();
        format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
            now.year(),
            now.month() as u8,
            now.day(),
            now.hour(),
            now.minute(),
            now.second()
        )
    }
}

struct SystemMessageIdGenerator;

static NEXT_MESSAGE_ID: AtomicI64 = AtomicI64::new(0);

impl MessageIdGenerator for SystemMessageIdGenerator {
    fn next_message_id(&self, _created_at: &str) -> i64 {
        loop {
            let candidate = OffsetDateTime::now_utc().unix_timestamp_nanos() as i64;
            let current = NEXT_MESSAGE_ID.load(Ordering::Relaxed);
            let next = candidate.max(current.saturating_add(1));
            if NEXT_MESSAGE_ID
                .compare_exchange(current, next, Ordering::SeqCst, Ordering::Relaxed)
                .is_ok()
            {
                return next;
            }
        }
    }
}

/// 実行時向け message service を構築する。
/// @param なし
/// @returns message service
/// @throws なし
pub async fn build_runtime_message_service() -> Arc<dyn MessageService> {
    let database_url = match env::var("DATABASE_URL") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => {
            warn!("DATABASE_URL missing; message service will fail-close as unavailable");
            return Arc::new(UnavailableMessageService::new(
                "message_postgres_unconfigured",
            ));
        }
    };

    let allow_postgres_notls = parse_runtime_bool_env("AUTH_ALLOW_POSTGRES_NOTLS", false);
    if !allow_postgres_notls {
        warn!(
            "AUTH_ALLOW_POSTGRES_NOTLS is false; message service stays fail-close until TLS connector is configured"
        );
        return Arc::new(UnavailableMessageService::new("postgres_tls_required"));
    }

    let scylla_config = match build_scylla_runtime_config_from_env() {
        Ok(config) => config,
        Err(reason) => {
            warn!(reason = %reason, "Scylla runtime config is invalid for message service");
            return Arc::new(UnavailableMessageService::new(
                "message_scylla_unconfigured",
            ));
        }
    };

    let postgres_client = match connect_postgres_client(&database_url).await {
        Ok(client) => client,
        Err(reason) => {
            warn!(reason = %reason, "Postgres client initialization failed for message service");
            return Arc::new(UnavailableMessageService::new(reason));
        }
    };

    let scylla_session = match connect_scylla_session(
        &scylla_config.hosts,
        scylla_config.request_timeout_ms,
    )
    .await
    {
        Ok(session) => session,
        Err(reason) => {
            warn!(reason = %reason, "Scylla session initialization failed for message service");
            return Arc::new(UnavailableMessageService::new(reason));
        }
    };

    Arc::new(DefaultMessageService::new(
        Arc::new(ScyllaMessageRepository::new(scylla_session)),
        Arc::new(PostgresMessageMetadataRepository::new(postgres_client)),
        Arc::new(SystemMessageClock),
        Arc::new(SystemMessageIdGenerator),
    ))
}

async fn connect_postgres_client(
    database_url: &str,
) -> Result<Arc<tokio_postgres::Client>, String> {
    let (client, connection) = tokio_postgres::connect(database_url, NoTls)
        .await
        .map_err(|error| format!("message_postgres_connect_failed:{error}"))?;
    tokio::spawn(async move {
        if let Err(error) = connection.await {
            tracing::warn!(reason = %error, "message postgres connection ended");
        }
    });
    Ok(Arc::new(client))
}

async fn connect_scylla_session(
    hosts: &[String],
    request_timeout_ms: u64,
) -> Result<Arc<scylla::client::session::Session>, String> {
    let mut builder = SessionBuilder::new();
    for host in hosts {
        builder = builder.known_node(host);
    }
    let request_timeout = Duration::from_millis(request_timeout_ms);
    let session = timeout(request_timeout, builder.build())
        .await
        .map_err(|_| format!("message_scylla_connect_timeout:{request_timeout_ms}ms"))?
        .map_err(|error| format!("message_scylla_connect_failed:{error}"))?;
    Ok(Arc::new(session))
}

fn parse_runtime_bool_env(name: &str, default: bool) -> bool {
    match env::var(name) {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            match normalized.as_str() {
                "1" | "true" | "yes" | "on" => true,
                "0" | "false" | "no" | "off" => false,
                _ => default,
            }
        }
        Err(_) => default,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn unavailable_message_service_fail_closes() {
        let service = UnavailableMessageService::new("dependency_missing");
        let error = service
            .list_guild_channel_messages(ListGuildChannelMessagesCommand {
                principal_id: linklynx_shared::PrincipalId(1),
                guild_id: 10,
                channel_id: 20,
                query: Default::default(),
            })
            .await
            .unwrap_err();
        assert_eq!(error.reason, "dependency_missing");
    }

    #[test]
    fn system_message_clock_formats_fixed_width_utc_timestamp() {
        let value = SystemMessageClock.now_created_at();
        assert_eq!(value.len(), 20);
        assert!(value.ends_with('Z'));
    }

    #[test]
    fn system_message_id_generator_is_monotonic_within_process() {
        let generator = SystemMessageIdGenerator;
        let first = generator.next_message_id("2026-03-08T09:00:00Z");
        let second = generator.next_message_id("2026-03-08T09:00:00Z");
        assert!(second > first);
    }
}
