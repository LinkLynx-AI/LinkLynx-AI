use std::{
    collections::HashMap,
    env,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use axum::{
    http::{header::AUTHORIZATION, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{errors::ErrorKind, Algorithm, DecodingKey, Validation};
use linklynx_shared::PrincipalId;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, RwLock};
use tokio_postgres::NoTls;
use tracing::warn;
use uuid::Uuid;

const FIREBASE_PROVIDER: &str = "firebase";
const DEFAULT_JWKS_URL: &str =
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const DEFAULT_MISSING_KID_REFRESH_BACKOFF_SECONDS: u64 = 30;

include!("auth/errors.rs");
include!("auth/metrics.rs");
include!("auth/service.rs");
include!("auth/firebase.rs");
include!("auth/principal.rs");
include!("auth/runtime.rs");
include!("auth/tests.rs");
