use std::{env, sync::Arc};

use async_trait::async_trait;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use linklynx_message_api::{
    CreateGuildChannelMessageRequestV1, ListGuildChannelMessagesQueryV1,
    ListGuildChannelMessagesResponseV1,
};
use linklynx_shared::PrincipalId;
use serde::Serialize;
use tracing::warn;

use crate::message::{CreateGuildChannelMessageExecution, MessageService};

include!("dm/errors.rs");
include!("dm/service.rs");
include!("dm/postgres.rs");
include!("dm/runtime.rs");

#[cfg(test)]
include!("dm/tests.rs");
