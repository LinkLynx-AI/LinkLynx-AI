use std::{env, sync::Arc};

use async_trait::async_trait;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use linklynx_shared::PrincipalId;
use serde::Serialize;
use tokio_postgres::{error::SqlState, NoTls};
use tracing::warn;

include!("guild_channel/errors.rs");
include!("guild_channel/service.rs");
include!("guild_channel/postgres.rs");
include!("guild_channel/runtime.rs");
include!("guild_channel/tests.rs");
