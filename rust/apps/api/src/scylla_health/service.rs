const SCYLLA_SERVICE_NAME: &str = "scylla";
const SCYLLA_REASON_CONFIG_INVALID: &str = "config_invalid";
const SCYLLA_REASON_CONNECT_TIMEOUT: &str = "connect_timeout";
const SCYLLA_REASON_CONNECT_FAILED: &str = "connect_failed";
const SCYLLA_REASON_QUERY_TIMEOUT: &str = "query_timeout";
const SCYLLA_REASON_QUERY_FAILED: &str = "query_failed";
const SCYLLA_REASON_KEYSPACE_MISSING: &str = "keyspace_missing";
const SCYLLA_REASON_TABLE_MISSING: &str = "table_missing";
const REQUIRED_SCYLLA_TABLES: &[&str] = &["messages_by_channel"];

/// Scylla health の状態種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ScyllaHealthStatus {
    Ready,
    Degraded,
    Error,
}

impl ScyllaHealthStatus {
    /// 状態に対応するHTTPステータスを返す。
    /// @param なし
    /// @returns HTTPステータス
    /// @throws なし
    pub fn http_status(self) -> StatusCode {
        match self {
            Self::Ready | Self::Degraded => StatusCode::OK,
            Self::Error => StatusCode::SERVICE_UNAVAILABLE,
        }
    }
}

/// Scylla health probe の応答を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ScyllaHealthReport {
    pub service: &'static str,
    pub status: ScyllaHealthStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl ScyllaHealthReport {
    /// ready 状態のレポートを生成する。
    /// @param なし
    /// @returns ready レポート
    /// @throws なし
    pub fn ready() -> Self {
        Self {
            service: SCYLLA_SERVICE_NAME,
            status: ScyllaHealthStatus::Ready,
            reason: None,
        }
    }

    /// degraded 状態のレポートを生成する。
    /// @param reason degraded 理由
    /// @returns degraded レポート
    /// @throws なし
    pub fn degraded(reason: impl Into<String>) -> Self {
        Self {
            service: SCYLLA_SERVICE_NAME,
            status: ScyllaHealthStatus::Degraded,
            reason: Some(reason.into()),
        }
    }

    /// error 状態のレポートを生成する。
    /// @param reason error 理由
    /// @returns error レポート
    /// @throws なし
    pub fn error(reason: impl Into<String>) -> Self {
        Self {
            service: SCYLLA_SERVICE_NAME,
            status: ScyllaHealthStatus::Error,
            reason: Some(reason.into()),
        }
    }

    /// 公開レスポンス向けの coarse reason code を返す。
    /// @param なし
    /// @returns 公開用 reason code
    /// @throws なし
    fn public_reason_code(&self) -> Option<&'static str> {
        let reason = self.reason.as_deref()?;
        Some(public_reason_code(reason))
    }
}

#[derive(Debug, Serialize)]
struct ScyllaHealthHttpResponse<'a> {
    service: &'static str,
    status: ScyllaHealthStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<&'a str>,
}

/// Scylla health を取得する抽象を表現する。
#[async_trait]
pub trait ScyllaHealthReporter: Send + Sync {
    /// Scylla health を評価して返す。
    /// @param なし
    /// @returns health レポート
    /// @throws なし
    async fn report(&self) -> ScyllaHealthReport;
}

#[async_trait]
trait ScyllaHealthCheck: Send + Sync {
    async fn verify_connectivity(&self) -> Result<(), String>;
    async fn keyspace_exists(&self, keyspace: &str) -> Result<bool, String>;
    async fn table_exists(&self, keyspace: &str, table_name: &str) -> Result<bool, String>;
}

struct SessionScyllaHealthCheck {
    session: Arc<Session>,
    request_timeout: Duration,
}

impl SessionScyllaHealthCheck {
    fn new(session: Session, request_timeout: Duration) -> Self {
        Self {
            session: Arc::new(session),
            request_timeout,
        }
    }
}

#[async_trait]
impl ScyllaHealthCheck for SessionScyllaHealthCheck {
    /// Scylla への接続疎通を検証する。
    /// @param なし
    /// @returns 成功時は `()`
    /// @throws String query timeout または query failure 時
    async fn verify_connectivity(&self) -> Result<(), String> {
        let query_future = self
            .session
            .query_unpaged("SELECT release_version FROM system.local", &[]);
        let query_result = timeout(self.request_timeout, query_future)
            .await
            .map_err(|_| format!("scylla_query_timeout:{}ms", self.request_timeout.as_millis()))?
            .map_err(|error| format!("scylla_query_failed:{error}"))?;
        let rows_result = query_result
            .into_rows_result()
            .map_err(|error| format!("scylla_rows_unavailable:{error}"))?;
        rows_result
            .first_row::<(String,)>()
            .map_err(|error| format!("scylla_connectivity_deserialize_failed:{error}"))?;
        Ok(())
    }

    /// keyspace の存在を確認する。
    /// @param keyspace 検証対象 keyspace
    /// @returns keyspace が存在する場合は `true`
    /// @throws String query timeout または query failure 時
    async fn keyspace_exists(&self, keyspace: &str) -> Result<bool, String> {
        let query_future = self.session.query_unpaged(
            "SELECT keyspace_name FROM system_schema.keyspaces WHERE keyspace_name = ?",
            (keyspace,),
        );
        let query_result = timeout(self.request_timeout, query_future)
            .await
            .map_err(|_| format!("scylla_query_timeout:{}ms", self.request_timeout.as_millis()))?
            .map_err(|error| format!("scylla_query_failed:{error}"))?;
        let rows_result = query_result
            .into_rows_result()
            .map_err(|error| format!("scylla_rows_unavailable:{error}"))?;
        rows_result
            .maybe_first_row::<(String,)>()
            .map(|row| row.is_some())
            .map_err(|error| format!("scylla_keyspace_deserialize_failed:{error}"))
    }

    /// table の存在を確認する。
    /// @param keyspace 検証対象 keyspace
    /// @param table_name 検証対象 table 名
    /// @returns table が存在する場合は `true`
    /// @throws String query timeout または query failure 時
    async fn table_exists(&self, keyspace: &str, table_name: &str) -> Result<bool, String> {
        let query_future = self.session.query_unpaged(
            "SELECT table_name FROM system_schema.tables WHERE keyspace_name = ? AND table_name = ?",
            (keyspace, table_name),
        );
        let query_result = timeout(self.request_timeout, query_future)
            .await
            .map_err(|_| format!("scylla_query_timeout:{}ms", self.request_timeout.as_millis()))?
            .map_err(|error| format!("scylla_query_failed:{error}"))?;
        let rows_result = query_result
            .into_rows_result()
            .map_err(|error| format!("scylla_rows_unavailable:{error}"))?;
        rows_result
            .maybe_first_row::<(String,)>()
            .map(|row| row.is_some())
            .map_err(|error| format!("scylla_table_deserialize_failed:{error}"))
    }
}

fn public_reason_code(reason: &str) -> &'static str {
    if reason.starts_with("scylla_keyspace_missing:") {
        return SCYLLA_REASON_KEYSPACE_MISSING;
    }
    if reason.starts_with("scylla_table_missing:") {
        return SCYLLA_REASON_TABLE_MISSING;
    }
    if reason.starts_with("scylla_runtime_config_invalid:") || reason.starts_with("SCYLLA_") {
        return SCYLLA_REASON_CONFIG_INVALID;
    }
    if reason.starts_with("scylla_connect_timeout:") {
        return SCYLLA_REASON_CONNECT_TIMEOUT;
    }
    if reason.starts_with("scylla_connect_failed:") {
        return SCYLLA_REASON_CONNECT_FAILED;
    }
    if reason.starts_with("scylla_query_timeout:") {
        return SCYLLA_REASON_QUERY_TIMEOUT;
    }
    SCYLLA_REASON_QUERY_FAILED
}

/// Scylla session を利用して live health を評価する。
pub struct LiveScyllaHealthReporter {
    checker: Arc<dyn ScyllaHealthCheck>,
    keyspace: Arc<str>,
}

impl LiveScyllaHealthReporter {
    /// live reporter を生成する。
    /// @param session 初期化済み Scylla session
    /// @param keyspace 検証対象 keyspace
    /// @param request_timeout health query の timeout
    /// @returns live reporter
    /// @throws なし
    pub fn new(session: Session, keyspace: String, request_timeout: Duration) -> Self {
        Self::with_checker(
            Arc::new(SessionScyllaHealthCheck::new(session, request_timeout)),
            keyspace,
        )
    }

    fn with_checker(checker: Arc<dyn ScyllaHealthCheck>, keyspace: String) -> Self {
        Self {
            checker,
            keyspace: Arc::from(keyspace),
        }
    }
}

#[async_trait]
impl ScyllaHealthReporter for LiveScyllaHealthReporter {
    /// Scylla health を live session で評価する。
    /// @param なし
    /// @returns health レポート
    /// @throws なし
    async fn report(&self) -> ScyllaHealthReport {
        if let Err(reason) = self.checker.verify_connectivity().await {
            return ScyllaHealthReport::error(public_reason_code(&reason));
        }

        match self.checker.keyspace_exists(self.keyspace.as_ref()).await {
            Ok(true) => {}
            Ok(false) => return ScyllaHealthReport::degraded(SCYLLA_REASON_KEYSPACE_MISSING),
            Err(reason) => return ScyllaHealthReport::error(public_reason_code(&reason)),
        }

        for table_name in REQUIRED_SCYLLA_TABLES {
            match self
                .checker
                .table_exists(self.keyspace.as_ref(), table_name)
                .await
            {
                Ok(true) => {}
                Ok(false) => return ScyllaHealthReport::degraded(SCYLLA_REASON_TABLE_MISSING),
                Err(reason) => return ScyllaHealthReport::error(public_reason_code(&reason)),
            }
        }

        ScyllaHealthReport::ready()
    }
}

/// Scylla runtime 未初期化時の health を返す reporter を表現する。
pub struct UnavailableScyllaHealthReporter {
    reason: Arc<str>,
}

impl UnavailableScyllaHealthReporter {
    /// unavailable reporter を生成する。
    /// @param reason unavailable 理由
    /// @returns unavailable reporter
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: Arc::from(reason.into()),
        }
    }
}

#[async_trait]
impl ScyllaHealthReporter for UnavailableScyllaHealthReporter {
    /// 初期化不能状態の health を返す。
    /// @param なし
    /// @returns error レポート
    /// @throws なし
    async fn report(&self) -> ScyllaHealthReport {
        ScyllaHealthReport::error(self.reason.as_ref())
    }
}

impl IntoResponse for ScyllaHealthReport {
    /// health レポートをHTTPレスポンスへ変換する。
    /// @param なし
    /// @returns JSON レスポンス
    /// @throws なし
    fn into_response(self) -> Response {
        let http_response = ScyllaHealthHttpResponse {
            service: self.service,
            status: self.status,
            reason: self.public_reason_code(),
        };
        (self.status.http_status(), Json(http_response)).into_response()
    }
}
