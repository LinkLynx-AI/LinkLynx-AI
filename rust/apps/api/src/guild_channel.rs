use std::{
    env,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};

use async_trait::async_trait;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use linklynx_shared::PrincipalId;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tokio_postgres::{error::SqlState, NoTls};
use tracing::warn;

include!("guild_channel/errors.rs");
include!("guild_channel/service.rs");
include!("guild_channel/postgres.rs");
include!("guild_channel/runtime.rs");
include!("guild_channel/tests.rs");
