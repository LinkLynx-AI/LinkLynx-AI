use sha2::{Digest, Sha256};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

pub const DEFAULT_WS_ALLOWED_ORIGINS: &str = "http://localhost:3000,http://127.0.0.1:3000";

#[derive(Debug, Clone)]
pub struct IssuedWsTicket {
    pub ticket: String,
    pub expires_at_epoch: u64,
}

#[derive(Debug, Clone)]
struct ActiveWsTicketEntry {
    principal: AuthenticatedPrincipal,
    expires_at_epoch: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WsTicketConsumeError {
    Invalid,
    Expired,
    AlreadyUsed,
}

#[derive(Debug, Default, Clone)]
pub struct WsTicketStore {
    active_tickets: Arc<Mutex<HashMap<String, ActiveWsTicketEntry>>>,
    consumed_tickets: Arc<Mutex<HashMap<String, u64>>>,
}

impl WsTicketStore {
    /// WSワンタイムチケットを発行して保存する。
    /// @param principal チケットに紐づく認証済み主体
    /// @param ttl チケットTTL
    /// @returns 発行済みチケット
    /// @throws なし
    pub async fn issue_ticket(
        &self,
        principal: AuthenticatedPrincipal,
        ttl: Duration,
    ) -> IssuedWsTicket {
        let now_epoch = unix_timestamp_seconds();
        let ticket = format!(
            "{}{}",
            Uuid::new_v4().as_simple(),
            Uuid::new_v4().as_simple()
        );
        let hashed_ticket = hash_ws_ticket(&ticket);
        let expires_at_epoch = now_epoch.saturating_add(ttl.as_secs());
        self.cleanup_expired_entries(now_epoch).await;

        let mut active = self.active_tickets.lock().await;
        active.insert(
            hashed_ticket,
            ActiveWsTicketEntry {
                principal,
                expires_at_epoch,
            },
        );

        IssuedWsTicket {
            ticket,
            expires_at_epoch,
        }
    }

    /// WSワンタイムチケットを消費して主体を返す。
    /// @param ticket 消費対象チケット
    /// @returns チケットに紐づく認証済み主体
    /// @throws WsTicketConsumeError 無効/期限切れ/再利用時
    pub async fn consume_ticket(
        &self,
        ticket: &str,
    ) -> Result<AuthenticatedPrincipal, WsTicketConsumeError> {
        let now_epoch = unix_timestamp_seconds();
        let hashed_ticket = hash_ws_ticket(ticket);

        {
            let mut consumed = self.consumed_tickets.lock().await;
            if let Some(expires_at_epoch) = consumed.get(&hashed_ticket).copied() {
                if expires_at_epoch > now_epoch {
                    return Err(WsTicketConsumeError::AlreadyUsed);
                }
                consumed.remove(&hashed_ticket);
            }
        }

        let entry = {
            let mut active = self.active_tickets.lock().await;
            active.remove(&hashed_ticket)
        };

        let Some(entry) = entry else {
            return Err(WsTicketConsumeError::Invalid);
        };

        if entry.expires_at_epoch <= now_epoch {
            return Err(WsTicketConsumeError::Expired);
        }

        let mut consumed = self.consumed_tickets.lock().await;
        consumed.insert(hashed_ticket, entry.expires_at_epoch);

        Ok(entry.principal)
    }

    /// WSワンタイムチケットに紐づく principal_id を非消費で参照する。
    /// @param ticket 参照対象チケット
    /// @returns active ticket に紐づく principal_id。取得できない場合は `None`
    /// @throws なし
    pub async fn peek_principal_id(&self, ticket: &str) -> Option<PrincipalId> {
        let now_epoch = unix_timestamp_seconds();
        self.cleanup_expired_entries(now_epoch).await;
        let hashed_ticket = hash_ws_ticket(ticket);
        let active = self.active_tickets.lock().await;
        active.get(&hashed_ticket).map(|entry| entry.principal.principal_id)
    }

    async fn cleanup_expired_entries(&self, now_epoch: u64) {
        {
            let mut active = self.active_tickets.lock().await;
            active.retain(|_, entry| entry.expires_at_epoch > now_epoch);
        }

        let mut consumed = self.consumed_tickets.lock().await;
        consumed.retain(|_, expires_at_epoch| *expires_at_epoch > now_epoch);
    }
}

#[derive(Debug, Clone)]
struct FixedWindowBucket {
    window_started_at: Instant,
    count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FixedWindowDecision {
    pub allowed: bool,
    pub retry_after: Option<Duration>,
}

#[derive(Debug, Clone)]
pub struct FixedWindowRateLimiter {
    max_requests: u32,
    window: Duration,
    buckets: Arc<Mutex<HashMap<String, FixedWindowBucket>>>,
}

impl FixedWindowRateLimiter {
    /// 固定窓レートリミッタを生成する。
    /// @param max_requests 1窓あたり許可数
    /// @param window 集計窓
    /// @returns レートリミッタ
    /// @throws なし
    pub fn new(max_requests: u32, window: Duration) -> Self {
        Self {
            max_requests: max_requests.max(1),
            window,
            buckets: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// キーごとにリクエスト可否を判定して記録する。
    /// @param key 判定キー
    /// @returns 許可時 `true`
    /// @throws なし
    pub async fn check_and_record(&self, key: &str) -> bool {
        self.check_and_record_with_retry_after(key).await.allowed
    }

    /// キーごとにリクエスト可否と待機時間を判定して記録する。
    /// @param key 判定キー
    /// @returns 判定結果
    /// @throws なし
    pub async fn check_and_record_with_retry_after(&self, key: &str) -> FixedWindowDecision {
        let now = Instant::now();
        let mut buckets = self.buckets.lock().await;

        if buckets.len() > 8_192 {
            buckets.retain(|_, bucket| now.duration_since(bucket.window_started_at) < self.window);
        }

        let bucket = buckets
            .entry(key.to_owned())
            .or_insert_with(|| FixedWindowBucket {
                window_started_at: now,
                count: 0,
            });

        if now.duration_since(bucket.window_started_at) >= self.window {
            bucket.window_started_at = now;
            bucket.count = 0;
        }

        if bucket.count >= self.max_requests {
            return FixedWindowDecision {
                allowed: false,
                retry_after: Some(self.window.saturating_sub(now.duration_since(bucket.window_started_at))),
            };
        }

        bucket.count = bucket.count.saturating_add(1);
        FixedWindowDecision {
            allowed: true,
            retry_after: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct WsOriginAllowlist {
    allowed_origins: Arc<HashSet<String>>,
}

impl WsOriginAllowlist {
    /// 正規化済みOrigin集合からallowlistを生成する。
    /// @param allowed_origins 正規化済みOrigin集合
    /// @returns Origin allowlist
    /// @throws なし
    pub fn new(allowed_origins: HashSet<String>) -> Self {
        Self {
            allowed_origins: Arc::new(allowed_origins),
        }
    }

    /// Originヘッダーの許可可否を判定する。
    /// @param origin_header Originヘッダー値
    /// @returns 許可時 `true`
    /// @throws なし
    pub fn is_allowed(&self, origin_header: Option<&str>) -> bool {
        match origin_header {
            Some(raw_origin) => normalize_origin(raw_origin)
                .map(|origin| self.allowed_origins.contains(&origin))
                .unwrap_or(false),
            None => false,
        }
    }
}

/// カンマ区切りOriginリストを正規化して返す。
/// @param value カンマ区切りOrigin文字列
/// @returns 正規化済みOrigin集合
/// @throws String 形式不正時
pub fn parse_ws_origin_allowlist(value: &str) -> Result<HashSet<String>, String> {
    let mut normalized = HashSet::new();

    for raw in value.split(',') {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Some(origin) = normalize_origin(trimmed) else {
            return Err(format!("invalid origin in WS_ALLOWED_ORIGINS: {trimmed}"));
        };
        normalized.insert(origin);
    }

    if normalized.is_empty() {
        return Err("WS_ALLOWED_ORIGINS must contain at least one valid origin".to_owned());
    }

    Ok(normalized)
}

/// チケット有効期限のRFC3339文字列を返す。
/// @param expires_at_epoch UNIX秒
/// @returns RFC3339文字列
/// @throws なし
pub fn format_ticket_expiration(expires_at_epoch: u64) -> String {
    match OffsetDateTime::from_unix_timestamp(expires_at_epoch as i64) {
        Ok(value) => value
            .format(&Rfc3339)
            .unwrap_or_else(|_| expires_at_epoch.to_string()),
        Err(_) => expires_at_epoch.to_string(),
    }
}

fn normalize_origin(raw_origin: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(raw_origin.trim()).ok()?;
    if parsed.query().is_some() || parsed.fragment().is_some() {
        return None;
    }
    if parsed.path() != "/" {
        return None;
    }

    let scheme = parsed.scheme().to_ascii_lowercase();
    if scheme != "http" && scheme != "https" {
        return None;
    }

    let host = parsed.host_str()?.to_ascii_lowercase();
    let port = parsed.port_or_known_default()?;

    Some(format!("{scheme}://{host}:{port}"))
}

fn hash_ws_ticket(ticket: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(ticket.as_bytes());
    format!("{:x}", hasher.finalize())
}
