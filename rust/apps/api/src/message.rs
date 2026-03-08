use std::{
    collections::{HashMap, VecDeque},
    env,
    sync::{
        atomic::{AtomicI64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

use async_trait::async_trait;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use linklynx_message_api::{
    CreateGuildChannelMessageRequestV1, CreateGuildChannelMessageResponseV1,
    ListGuildChannelMessagesQueryV1, ListGuildChannelMessagesResponseV1, MessageApiError,
};
use linklynx_message_domain::{
    AppendGuildChannelMessageCommand, LiveMessageUsecase, MessageUsecase, MessageUsecaseError,
};
use linklynx_platform_postgres_message::PostgresMessageMetadataRepository;
use linklynx_platform_scylla_message::ScyllaMessageStore;
use linklynx_shared::PrincipalId;
use serde::Serialize;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use tokio::sync::Mutex;
use tracing::warn;

include!("message/errors.rs");
include!("message/service.rs");
include!("message/runtime.rs");
