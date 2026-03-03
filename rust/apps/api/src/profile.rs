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
use tokio_postgres::NoTls;
use tracing::warn;

include!("profile/errors.rs");
include!("profile/service.rs");
include!("profile/postgres.rs");
include!("profile/runtime.rs");
include!("profile/tests.rs");
