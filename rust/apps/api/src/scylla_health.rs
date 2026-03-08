use std::{env, path::Path, sync::Arc, time::Duration};

use async_trait::async_trait;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use scylla::client::{session::Session, session_builder::SessionBuilder};
use serde::Serialize;
use tokio::time::timeout;
use tracing::{info, warn};

include!("scylla_health/service.rs");
include!("scylla_health/runtime.rs");
include!("scylla_health/tests.rs");
