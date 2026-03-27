use std::{
    collections::BTreeSet,
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
use tokio_postgres::{GenericClient, NoTls};
use tracing::warn;

include!("user_directory/errors.rs");
include!("user_directory/service.rs");
include!("user_directory/postgres.rs");
include!("user_directory/runtime.rs");
