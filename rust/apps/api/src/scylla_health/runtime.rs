const DEFAULT_SCYLLA_KEYSPACE: &str = "chat";
const DEFAULT_SCYLLA_SCHEMA_PATH: &str = "database/scylla/001_lin139_messages.cql";
const DEFAULT_SCYLLA_REQUEST_TIMEOUT_MS: u64 = 1000;

/// Scylla runtime 設定を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScyllaRuntimeConfig {
    pub hosts: Vec<String>,
    pub keyspace: String,
    pub schema_path: String,
    pub request_timeout_ms: u64,
}

/// 実行時環境変数から Scylla 設定を構築する。
/// @param なし
/// @returns 構築済み Scylla 設定
/// @throws String 必須値欠落または不正値時
pub fn build_scylla_runtime_config_from_env() -> Result<ScyllaRuntimeConfig, String> {
    let hosts = parse_required_csv_env("SCYLLA_HOSTS")?;
    let keyspace = parse_optional_non_empty_env("SCYLLA_KEYSPACE", DEFAULT_SCYLLA_KEYSPACE)?;
    let schema_path =
        parse_optional_non_empty_env("SCYLLA_SCHEMA_PATH", DEFAULT_SCYLLA_SCHEMA_PATH)?;
    let request_timeout_ms = parse_optional_u64_env(
        "SCYLLA_REQUEST_TIMEOUT_MS",
        DEFAULT_SCYLLA_REQUEST_TIMEOUT_MS,
    )?;

    let resolved_schema_path = resolve_runtime_path(&schema_path).ok_or_else(|| {
        format!("SCYLLA_SCHEMA_PATH not found: {schema_path}")
    })?;

    Ok(ScyllaRuntimeConfig {
        hosts,
        keyspace,
        schema_path: resolved_schema_path,
        request_timeout_ms,
    })
}

/// 実行時パスを現在ディレクトリまたは親ディレクトリ基準で解決する。
/// @param raw_path 入力パス
/// @returns 存在する解決済みパス
/// @throws なし
fn resolve_runtime_path(raw_path: &str) -> Option<String> {
    let direct_path = Path::new(raw_path);
    if direct_path.exists() {
        return Some(raw_path.to_owned());
    }

    if direct_path.is_absolute() {
        return None;
    }

    let current_dir = env::current_dir().ok()?;
    for ancestor in current_dir.ancestors() {
        let candidate = ancestor.join(raw_path);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }

    None
}

/// 実行時向けの Scylla health reporter を生成する。
/// @param なし
/// @returns Scylla health reporter
/// @throws なし
pub async fn build_runtime_scylla_health_reporter() -> Arc<dyn ScyllaHealthReporter> {
    match build_scylla_runtime_config_from_env() {
        Ok(config) => {
            let live_reporter = build_live_scylla_health_reporter(&config).await;
            build_runtime_scylla_health_reporter_from_parts(config, live_reporter).await
        }
        Err(reason) => {
            warn!(
                reason = %reason,
                "Scylla runtime config is invalid; error reporter is active"
            );
            Arc::new(UnavailableScyllaHealthReporter::new(
                SCYLLA_REASON_CONFIG_INVALID,
            ))
        }
    }
}

async fn build_runtime_scylla_health_reporter_from_parts(
    config: ScyllaRuntimeConfig,
    live_reporter: Result<LiveScyllaHealthReporter, String>,
) -> Arc<dyn ScyllaHealthReporter> {
    match live_reporter {
        Ok(reporter) => {
            let reporter: Arc<dyn ScyllaHealthReporter> = Arc::new(reporter);
            let startup_report = reporter.report().await;
            match startup_report.status {
                ScyllaHealthStatus::Ready => info!(
                    hosts = ?config.hosts,
                    keyspace = %config.keyspace,
                    schema_path = %config.schema_path,
                    "Scylla runtime is ready"
                ),
                ScyllaHealthStatus::Degraded => warn!(
                    hosts = ?config.hosts,
                    keyspace = %config.keyspace,
                    schema_path = %config.schema_path,
                    reason = %startup_report.reason.clone().unwrap_or_default(),
                    "Scylla runtime connected but baseline schema is incomplete"
                ),
                ScyllaHealthStatus::Error => warn!(
                    hosts = ?config.hosts,
                    keyspace = %config.keyspace,
                    schema_path = %config.schema_path,
                    reason = %startup_report.reason.clone().unwrap_or_default(),
                    "Scylla runtime initialized with an unhealthy state"
                ),
            }
            reporter
        }
        Err(reason) => {
            warn!(
                hosts = ?config.hosts,
                keyspace = %config.keyspace,
                schema_path = %config.schema_path,
                reason = %reason,
                "Scylla runtime initialization failed; error reporter is active"
            );
            Arc::new(UnavailableScyllaHealthReporter::new(public_reason_code(
                &reason,
            )))
        }
    }
}

/// Scylla session を初期化して live reporter を構築する。
/// @param config Scylla runtime 設定
/// @returns live reporter
/// @throws String session 初期化失敗時
async fn build_live_scylla_health_reporter(
    config: &ScyllaRuntimeConfig,
) -> Result<LiveScyllaHealthReporter, String> {
    let request_timeout = Duration::from_millis(config.request_timeout_ms);
    let session = build_runtime_scylla_session(config).await?;

    Ok(LiveScyllaHealthReporter::new(
        session,
        config.keyspace.clone(),
        request_timeout,
    ))
}

/// 実行時設定から Scylla session を初期化する。
/// @param config Scylla runtime 設定
/// @returns 初期化済み session
/// @throws String session 初期化失敗時
pub(crate) async fn build_runtime_scylla_session(
    config: &ScyllaRuntimeConfig,
) -> Result<Session, String> {
    let mut builder = SessionBuilder::new();
    for host in &config.hosts {
        builder = builder.known_node(host);
    }

    timeout(Duration::from_millis(config.request_timeout_ms), builder.build())
        .await
        .map_err(|_| format!("scylla_connect_timeout:{}ms", config.request_timeout_ms))?
        .map_err(|error| format!("scylla_connect_failed:{error}"))
}

/// 必須環境変数を CSV として読み取る。
/// @param name 環境変数名
/// @returns 非空要素の配列
/// @throws String 必須値が欠落または空の場合
fn parse_required_csv_env(name: &str) -> Result<Vec<String>, String> {
    let raw = env::var(name).map_err(|_| format!("{name} is required"))?;
    let parsed = raw
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    if parsed.is_empty() {
        return Err(format!("{name} must contain at least one host"));
    }
    Ok(parsed)
}

/// 任意環境変数を非空文字列として読み取り、未設定時は既定値を返す。
/// @param name 環境変数名
/// @param default 未設定時の既定値
/// @returns 読み取った文字列
/// @throws String 空文字列が設定されている場合
fn parse_optional_non_empty_env(name: &str, default: &str) -> Result<String, String> {
    match env::var(name) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err(format!("{name} must not be empty when set"));
            }
            Ok(trimmed.to_owned())
        }
        Err(_) => Ok(default.to_owned()),
    }
}

/// 任意環境変数を u64 として読み取り、未設定時は既定値を返す。
/// @param name 環境変数名
/// @param default 未設定時の既定値
/// @returns 読み取った u64 値
/// @throws String 数値変換に失敗した場合
fn parse_optional_u64_env(name: &str, default: u64) -> Result<u64, String> {
    match env::var(name) {
        Ok(value) => value
            .trim()
            .parse::<u64>()
            .map_err(|error| format!("{name} must be a valid u64: {error}")),
        Err(_) => Ok(default),
    }
}
