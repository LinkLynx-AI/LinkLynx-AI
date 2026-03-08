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

include!("invite/errors.rs");
include!("invite/service.rs");
include!("invite/postgres.rs");
include!("invite/runtime.rs");
include!("invite/tests.rs");
