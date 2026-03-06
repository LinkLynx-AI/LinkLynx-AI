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
use serde::Serialize;
use tokio::sync::RwLock;
use tokio_postgres::{error::SqlState, NoTls};
use tracing::warn;

include!("moderation/errors.rs");
include!("moderation/service.rs");
include!("moderation/postgres.rs");
include!("moderation/runtime.rs");
include!("moderation/tests.rs");
