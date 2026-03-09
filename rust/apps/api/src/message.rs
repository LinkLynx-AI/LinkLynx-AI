use std::{
    env,
    sync::{
        atomic::{AtomicI64, Ordering},
        Arc,
    },
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
    CreateGuildChannelMessageCommand, LiveMessageUsecase, MessageCreateIdempotency,
    MessageIdentity, MessageUsecase, MessageUsecaseError,
};
use linklynx_platform_postgres_message::PostgresMessageMetadataRepository;
use linklynx_platform_scylla_message::ScyllaMessageStore;
use linklynx_shared::PrincipalId;
use serde::Serialize;
use sha2::{Digest, Sha256};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use tracing::warn;

include!("message/errors.rs");
include!("message/service.rs");
include!("message/runtime.rs");

#[cfg(test)]
pub(crate) mod test_support;
