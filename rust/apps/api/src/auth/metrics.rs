/// 認証メトリクスを保持する。
#[derive(Default)]
pub struct AuthMetrics {
    token_verify_success_total: AtomicU64,
    token_verify_failure_total: AtomicU64,
    token_verify_unavailable_total: AtomicU64,
    token_verify_latency_ms_total: AtomicU64,
    token_verify_latency_samples: AtomicU64,
    principal_cache_hit_total: AtomicU64,
    principal_cache_miss_total: AtomicU64,
    principal_provision_success_total: AtomicU64,
    principal_provision_failure_total: AtomicU64,
    principal_provision_retry_total: AtomicU64,
    ws_reauth_success_total: AtomicU64,
    ws_reauth_failure_total: AtomicU64,
}

/// メトリクス出力スナップショットを保持する。
#[derive(Debug, Serialize)]
pub struct AuthMetricsSnapshot {
    pub token_verify_success_total: u64,
    pub token_verify_failure_total: u64,
    pub token_verify_unavailable_total: u64,
    pub token_verify_latency_avg_ms: f64,
    pub principal_cache_hit_total: u64,
    pub principal_cache_miss_total: u64,
    pub principal_cache_hit_ratio: f64,
    pub principal_provision_success_total: u64,
    pub principal_provision_failure_total: u64,
    pub principal_provision_retry_total: u64,
    pub ws_reauth_success_total: u64,
    pub ws_reauth_failure_total: u64,
}

impl AuthMetrics {
    /// トークン検証結果を記録する。
    /// @param result 検証結果
    /// @param elapsed 検証時間
    /// @returns なし
    /// @throws なし
    pub fn record_token_verify(&self, result: TokenVerifyResult, elapsed: Duration) {
        let elapsed_ms = duration_millis_u64(elapsed);
        self.token_verify_latency_ms_total
            .fetch_add(elapsed_ms, Ordering::Relaxed);
        self.token_verify_latency_samples
            .fetch_add(1, Ordering::Relaxed);

        match result {
            TokenVerifyResult::Success => {
                self.token_verify_success_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            TokenVerifyResult::Failure => {
                self.token_verify_failure_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            TokenVerifyResult::Unavailable => {
                self.token_verify_unavailable_total
                    .fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    /// principal解決時のキャッシュ利用結果を記録する。
    /// @param hit キャッシュヒット有無
    /// @returns なし
    /// @throws なし
    pub fn record_principal_cache(&self, hit: bool) {
        if hit {
            self.principal_cache_hit_total
                .fetch_add(1, Ordering::Relaxed);
        } else {
            self.principal_cache_miss_total
                .fetch_add(1, Ordering::Relaxed);
        }
    }

    /// principal自動プロビジョニング結果を記録する。
    /// @param success 成功可否
    /// @returns なし
    /// @throws なし
    pub fn record_principal_provision(&self, success: bool) {
        if success {
            self.principal_provision_success_total
                .fetch_add(1, Ordering::Relaxed);
        } else {
            self.principal_provision_failure_total
                .fetch_add(1, Ordering::Relaxed);
        }
    }

    /// principal自動プロビジョニング再試行を記録する。
    /// @param なし
    /// @returns なし
    /// @throws なし
    pub fn record_principal_provision_retry(&self) {
        self.principal_provision_retry_total
            .fetch_add(1, Ordering::Relaxed);
    }

    /// WS再認証結果を記録する。
    /// @param success 成功可否
    /// @returns なし
    /// @throws なし
    pub fn record_ws_reauth(&self, success: bool) {
        if success {
            self.ws_reauth_success_total.fetch_add(1, Ordering::Relaxed);
        } else {
            self.ws_reauth_failure_total.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// 現在メトリクスのスナップショットを返す。
    /// @param なし
    /// @returns メトリクススナップショット
    /// @throws なし
    pub fn snapshot(&self) -> AuthMetricsSnapshot {
        let latency_total = self.token_verify_latency_ms_total.load(Ordering::Relaxed) as f64;
        let latency_samples = self.token_verify_latency_samples.load(Ordering::Relaxed) as f64;
        let cache_hit = self.principal_cache_hit_total.load(Ordering::Relaxed) as f64;
        let cache_miss = self.principal_cache_miss_total.load(Ordering::Relaxed) as f64;
        let cache_total = cache_hit + cache_miss;

        AuthMetricsSnapshot {
            token_verify_success_total: self.token_verify_success_total.load(Ordering::Relaxed),
            token_verify_failure_total: self.token_verify_failure_total.load(Ordering::Relaxed),
            token_verify_unavailable_total: self
                .token_verify_unavailable_total
                .load(Ordering::Relaxed),
            token_verify_latency_avg_ms: if latency_samples > 0.0 {
                latency_total / latency_samples
            } else {
                0.0
            },
            principal_cache_hit_total: cache_hit as u64,
            principal_cache_miss_total: cache_miss as u64,
            principal_cache_hit_ratio: if cache_total > 0.0 {
                cache_hit / cache_total
            } else {
                0.0
            },
            principal_provision_success_total: self
                .principal_provision_success_total
                .load(Ordering::Relaxed),
            principal_provision_failure_total: self
                .principal_provision_failure_total
                .load(Ordering::Relaxed),
            principal_provision_retry_total: self
                .principal_provision_retry_total
                .load(Ordering::Relaxed),
            ws_reauth_success_total: self.ws_reauth_success_total.load(Ordering::Relaxed),
            ws_reauth_failure_total: self.ws_reauth_failure_total.load(Ordering::Relaxed),
        }
    }
}

/// Durationのミリ秒値をu64で返す。
/// @param duration 変換対象のDuration
/// @returns ミリ秒値（u64上限で飽和）
/// @throws なし
fn duration_millis_u64(duration: Duration) -> u64 {
    duration.as_millis().min(u64::MAX as u128) as u64
}

/// トークン検証メトリクス分類を表現する。
#[derive(Debug, Clone, Copy)]
pub enum TokenVerifyResult {
    Success,
    Failure,
    Unavailable,
}
