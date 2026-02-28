use std::{env, sync::Arc};

use async_trait::async_trait;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use linklynx_shared::PrincipalId;
use serde::Serialize;
use tracing::warn;

include!("authz/errors.rs");
include!("authz/service.rs");
include!("authz/runtime.rs");
include!("authz/tests.rs");
