use std::{
    collections::VecDeque,
    env,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

use axum::http::Method;
use linklynx_shared::PrincipalId;
use serde::Serialize;
use tokio::sync::Mutex;

use crate::auth::FixedWindowRateLimiter;

const DEFAULT_WINDOW_SECONDS: u64 = 60;
const DEFAULT_MESSAGE_CREATE_MAX_PER_MINUTE: u32 = 30;
const DEFAULT_INVITE_ACCESS_MAX_PER_MINUTE: u32 = 10;
const DEFAULT_MODERATION_MAX_PER_MINUTE: u32 = 5;
const DEFAULT_DEGRADED_ENTER_HEALTHCHECK_FAILURE_SECONDS: u64 = 30;
const DEFAULT_DEGRADED_ENTER_L2_ERROR_RATE_PERCENT: u64 = 20;
const DEFAULT_DEGRADED_ENTER_MIN_L2_SAMPLES: u64 = 10;
const DEFAULT_DEGRADED_EXIT_HEALTHY_SECONDS: u64 = 600;
const DEFAULT_DEGRADED_EXIT_L2_ERROR_RATE_PERCENT: u64 = 1;
const DEFAULT_FAIL_CLOSE_RETRY_AFTER_SECONDS: u64 = 60;
const L2_ERROR_RATE_WINDOW_SECONDS: u64 = 60;

/// レート制限の operation class を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RateLimitOperationClass {
    HighRiskAbuseSurface,
    CoreWritePath,
    #[allow(dead_code)]
    // ADR-005 contract includes continuity class; this module does not map a REST surface to it yet.
    ReadSessionContinuity,
}

/// RESTレート制限対象アクションを表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RestRateLimitAction {
    InviteAccess,
    ModerationAction,
    MessageCreate,
}

impl RestRateLimitAction {
    /// アクションのログ/キー用ラベルを返す。
    /// @param なし
    /// @returns アクションラベル
    /// @throws なし
    pub fn label(self) -> &'static str {
        match self {
            Self::InviteAccess => "invite_access",
            Self::ModerationAction => "moderation_action",
            Self::MessageCreate => "message_create",
        }
    }

    /// アクションの operation class を返す。
    /// @param なし
    /// @returns operation class
    /// @throws なし
    pub fn operation_class(self) -> RateLimitOperationClass {
        match self {
            Self::InviteAccess | Self::ModerationAction => {
                RateLimitOperationClass::HighRiskAbuseSurface
            }
            Self::MessageCreate => RateLimitOperationClass::CoreWritePath,
        }
    }

    /// アクションの既定リクエスト上限を返す。
    /// @param なし
    /// @returns 1分あたり上限
    /// @throws なし
    fn default_max_requests(self) -> u32 {
        match self {
            Self::InviteAccess => DEFAULT_INVITE_ACCESS_MAX_PER_MINUTE,
            Self::ModerationAction => DEFAULT_MODERATION_MAX_PER_MINUTE,
            Self::MessageCreate => DEFAULT_MESSAGE_CREATE_MAX_PER_MINUTE,
        }
    }
}

/// Dragonfly degraded 判定しきい値を保持する。
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DragonflyDegradedThresholds {
    pub enter_after_healthcheck_failure: Duration,
    pub enter_after_l2_error_rate: f64,
    pub enter_min_l2_samples: usize,
    pub exit_after_healthy_duration: Duration,
    pub exit_when_l2_error_rate_below: f64,
}

impl Default for DragonflyDegradedThresholds {
    /// ADR-005 既定値を返す。
    /// @param なし
    /// @returns 既定しきい値
    /// @throws なし
    fn default() -> Self {
        Self {
            enter_after_healthcheck_failure: Duration::from_secs(
                DEFAULT_DEGRADED_ENTER_HEALTHCHECK_FAILURE_SECONDS,
            ),
            enter_after_l2_error_rate: DEFAULT_DEGRADED_ENTER_L2_ERROR_RATE_PERCENT as f64 / 100.0,
            enter_min_l2_samples: DEFAULT_DEGRADED_ENTER_MIN_L2_SAMPLES as usize,
            exit_after_healthy_duration: Duration::from_secs(DEFAULT_DEGRADED_EXIT_HEALTHY_SECONDS),
            exit_when_l2_error_rate_below: DEFAULT_DEGRADED_EXIT_L2_ERROR_RATE_PERCENT as f64
                / 100.0,
        }
    }
}

/// RESTレート制限構成を保持する。
#[derive(Debug, Clone, Copy)]
pub struct RestRateLimitConfig {
    pub window: Duration,
    pub message_create_max_requests: u32,
    pub invite_access_max_requests: u32,
    pub moderation_max_requests: u32,
    pub degraded_thresholds: DragonflyDegradedThresholds,
    pub fail_close_retry_after: Duration,
}

impl Default for RestRateLimitConfig {
    /// ADR-005 と v1 最小 REST surface の既定構成を返す。
    /// @param なし
    /// @returns 既定構成
    /// @throws なし
    fn default() -> Self {
        Self {
            window: Duration::from_secs(DEFAULT_WINDOW_SECONDS),
            message_create_max_requests: DEFAULT_MESSAGE_CREATE_MAX_PER_MINUTE,
            invite_access_max_requests: DEFAULT_INVITE_ACCESS_MAX_PER_MINUTE,
            moderation_max_requests: DEFAULT_MODERATION_MAX_PER_MINUTE,
            degraded_thresholds: DragonflyDegradedThresholds::default(),
            fail_close_retry_after: Duration::from_secs(DEFAULT_FAIL_CLOSE_RETRY_AFTER_SECONDS),
        }
    }
}

impl RestRateLimitConfig {
    /// 環境変数から構成を生成する。
    /// @param なし
    /// @returns 実行時構成
    /// @throws なし
    pub fn from_env() -> Self {
        Self {
            window: Duration::from_secs(parse_env_u64(
                "RATE_LIMIT_WINDOW_SECONDS",
                DEFAULT_WINDOW_SECONDS,
            )),
            message_create_max_requests: parse_env_u32(
                "RATE_LIMIT_MESSAGE_CREATE_MAX_PER_MINUTE",
                RestRateLimitAction::MessageCreate.default_max_requests(),
            ),
            invite_access_max_requests: parse_env_u32(
                "RATE_LIMIT_INVITE_ACCESS_MAX_PER_MINUTE",
                RestRateLimitAction::InviteAccess.default_max_requests(),
            ),
            moderation_max_requests: parse_env_u32(
                "RATE_LIMIT_MODERATION_MAX_PER_MINUTE",
                RestRateLimitAction::ModerationAction.default_max_requests(),
            ),
            degraded_thresholds: DragonflyDegradedThresholds {
                enter_after_healthcheck_failure: Duration::from_secs(parse_env_u64(
                    "RATE_LIMIT_DEGRADED_ENTER_HEALTHCHECK_FAILURE_SECONDS",
                    DEFAULT_DEGRADED_ENTER_HEALTHCHECK_FAILURE_SECONDS,
                )),
                enter_after_l2_error_rate: parse_env_u64(
                    "RATE_LIMIT_DEGRADED_ENTER_L2_ERROR_RATE_PERCENT",
                    DEFAULT_DEGRADED_ENTER_L2_ERROR_RATE_PERCENT,
                ) as f64
                    / 100.0,
                enter_min_l2_samples: parse_env_u64(
                    "RATE_LIMIT_DEGRADED_ENTER_MIN_L2_SAMPLES",
                    DEFAULT_DEGRADED_ENTER_MIN_L2_SAMPLES,
                ) as usize,
                exit_after_healthy_duration: Duration::from_secs(parse_env_u64(
                    "RATE_LIMIT_DEGRADED_EXIT_HEALTHY_SECONDS",
                    DEFAULT_DEGRADED_EXIT_HEALTHY_SECONDS,
                )),
                exit_when_l2_error_rate_below: parse_env_u64(
                    "RATE_LIMIT_DEGRADED_EXIT_L2_ERROR_RATE_PERCENT",
                    DEFAULT_DEGRADED_EXIT_L2_ERROR_RATE_PERCENT,
                ) as f64
                    / 100.0,
            },
            fail_close_retry_after: Duration::from_secs(parse_env_u64(
                "RATE_LIMIT_FAIL_CLOSE_RETRY_AFTER_SECONDS",
                DEFAULT_FAIL_CLOSE_RETRY_AFTER_SECONDS,
            )),
        }
    }
}

/// Dragonfly 観測入力を保持する。
#[derive(Debug, Clone, Copy)]
#[cfg(test)]
pub struct DragonflyObservation {
    pub healthcheck_success: Option<bool>,
    pub l2_result_success: Option<bool>,
}

/// Dragonfly 状態スナップショットを保持する。
#[derive(Debug, Clone, Copy, Serialize)]
pub struct DragonflyStatusSnapshot {
    pub degraded: bool,
    pub healthcheck_failure_streak_seconds: u64,
    pub healthy_streak_seconds: u64,
    pub l2_error_rate: f64,
    pub l2_sample_total: u64,
}

/// リクエスト判定結果を保持する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RateLimitDecision {
    allowed: bool,
    fail_close: bool,
    retry_after_seconds: Option<u64>,
    action: RestRateLimitAction,
    operation_class: RateLimitOperationClass,
    degraded: bool,
}

impl RateLimitDecision {
    /// 許可判定を生成する。
    /// @param action 対象アクション
    /// @param degraded degraded状態
    /// @returns 許可判定
    /// @throws なし
    fn allow(action: RestRateLimitAction, degraded: bool) -> Self {
        Self {
            allowed: true,
            fail_close: false,
            retry_after_seconds: None,
            action,
            operation_class: action.operation_class(),
            degraded,
        }
    }

    /// 拒否判定を生成する。
    /// @param action 対象アクション
    /// @param fail_close fail-close適用有無
    /// @param retry_after_seconds Retry-After秒
    /// @param degraded degraded状態
    /// @returns 拒否判定
    /// @throws なし
    fn reject(
        action: RestRateLimitAction,
        fail_close: bool,
        retry_after_seconds: u64,
        degraded: bool,
    ) -> Self {
        Self {
            allowed: false,
            fail_close,
            retry_after_seconds: Some(retry_after_seconds.max(1)),
            action,
            operation_class: action.operation_class(),
            degraded,
        }
    }

    /// 判定が許可かを返す。
    /// @param なし
    /// @returns 許可時 `true`
    /// @throws なし
    pub fn allowed(self) -> bool {
        self.allowed
    }

    /// fail-close 拒否かを返す。
    /// @param なし
    /// @returns fail-close時 `true`
    /// @throws なし
    pub fn is_fail_close(self) -> bool {
        self.fail_close
    }

    /// Retry-After 秒を返す。
    /// @param なし
    /// @returns Retry-After秒
    /// @throws なし
    pub fn retry_after_seconds(self) -> Option<u64> {
        self.retry_after_seconds
    }

    /// 対象 action を返す。
    /// @param なし
    /// @returns action
    /// @throws なし
    pub fn action(self) -> RestRateLimitAction {
        self.action
    }

    /// operation class を返す。
    /// @param なし
    /// @returns operation class
    /// @throws なし
    pub fn operation_class(self) -> RateLimitOperationClass {
        self.operation_class
    }

    /// degraded 状態を返す。
    /// @param なし
    /// @returns degraded時 `true`
    /// @throws なし
    pub fn degraded(self) -> bool {
        self.degraded
    }
}

#[derive(Default)]
struct RateLimitMetrics {
    invite_access_requests_total: AtomicU64,
    invite_access_limited_total: AtomicU64,
    moderation_requests_total: AtomicU64,
    moderation_limited_total: AtomicU64,
    message_create_requests_total: AtomicU64,
    message_create_limited_total: AtomicU64,
    allowed_total: AtomicU64,
    limited_total: AtomicU64,
    high_risk_fail_close_total: AtomicU64,
    dragonfly_unavailable_total: AtomicU64,
}

impl RateLimitMetrics {
    /// 対象アクションのリクエスト総数を記録する。
    /// @param action 対象アクション
    /// @returns なし
    /// @throws なし
    fn record_request(&self, action: RestRateLimitAction) {
        counter_for_action(self, action, CounterKind::Requests).fetch_add(1, Ordering::Relaxed);
    }

    /// 許可結果を記録する。
    /// @param なし
    /// @returns なし
    /// @throws なし
    fn record_allowed(&self) {
        self.allowed_total.fetch_add(1, Ordering::Relaxed);
    }

    /// 拒否結果を記録する。
    /// @param action 対象アクション
    /// @param fail_close fail-close適用有無
    /// @returns なし
    /// @throws なし
    fn record_rejected(&self, action: RestRateLimitAction, fail_close: bool) {
        counter_for_action(self, action, CounterKind::Limited).fetch_add(1, Ordering::Relaxed);
        self.limited_total.fetch_add(1, Ordering::Relaxed);
        if fail_close {
            self.high_risk_fail_close_total
                .fetch_add(1, Ordering::Relaxed);
            self.dragonfly_unavailable_total
                .fetch_add(1, Ordering::Relaxed);
        }
    }
}

#[derive(Debug, Clone, Copy)]
enum CounterKind {
    Requests,
    Limited,
}

/// アクション別カウンタを返す。
/// @param metrics メトリクス
/// @param action 対象アクション
/// @param kind 取得種別
/// @returns 対象AtomicU64
/// @throws なし
fn counter_for_action(
    metrics: &RateLimitMetrics,
    action: RestRateLimitAction,
    kind: CounterKind,
) -> &AtomicU64 {
    match (action, kind) {
        (RestRateLimitAction::InviteAccess, CounterKind::Requests) => {
            &metrics.invite_access_requests_total
        }
        (RestRateLimitAction::InviteAccess, CounterKind::Limited) => {
            &metrics.invite_access_limited_total
        }
        (RestRateLimitAction::ModerationAction, CounterKind::Requests) => {
            &metrics.moderation_requests_total
        }
        (RestRateLimitAction::ModerationAction, CounterKind::Limited) => {
            &metrics.moderation_limited_total
        }
        (RestRateLimitAction::MessageCreate, CounterKind::Requests) => {
            &metrics.message_create_requests_total
        }
        (RestRateLimitAction::MessageCreate, CounterKind::Limited) => {
            &metrics.message_create_limited_total
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct L2ResultSample {
    at: Instant,
    success: bool,
}

#[derive(Debug, Default)]
struct DragonflyMonitorState {
    degraded: bool,
    continuous_failure_since: Option<Instant>,
    healthy_since: Option<Instant>,
    l2_samples: VecDeque<L2ResultSample>,
}

struct DragonflyRateLimitMonitor {
    thresholds: DragonflyDegradedThresholds,
    state: Mutex<DragonflyMonitorState>,
    degraded_enter_total: AtomicU64,
    degraded_exit_total: AtomicU64,
}

impl DragonflyRateLimitMonitor {
    /// degraded 監視器を生成する。
    /// @param thresholds しきい値
    /// @returns degraded監視器
    /// @throws なし
    fn new(thresholds: DragonflyDegradedThresholds) -> Self {
        Self {
            thresholds,
            state: Mutex::new(DragonflyMonitorState::default()),
            degraded_enter_total: AtomicU64::new(0),
            degraded_exit_total: AtomicU64::new(0),
        }
    }

    /// 観測結果を指定時刻で反映する。
    /// @param observation 観測入力
    /// @param now 判定時刻
    /// @returns なし
    /// @throws なし
    #[cfg(test)]
    async fn observe_at(&self, observation: DragonflyObservation, now: Instant) {
        let mut state = self.state.lock().await;
        apply_observation(&mut state, observation, now);
        self.refresh_degraded_state(&mut state, now);
    }

    /// 現在状態のスナップショットを返す。
    /// @param なし
    /// @returns 状態スナップショット
    /// @throws なし
    async fn snapshot(&self) -> DragonflyStatusSnapshot {
        self.snapshot_at(Instant::now()).await
    }

    /// 指定時刻の状態スナップショットを返す。
    /// @param now 判定時刻
    /// @returns 状態スナップショット
    /// @throws なし
    async fn snapshot_at(&self, now: Instant) -> DragonflyStatusSnapshot {
        let mut state = self.state.lock().await;
        self.refresh_degraded_state(&mut state, now);
        build_dragonfly_snapshot(&state, now)
    }

    /// テスト用に degraded 状態を直接設定する。
    /// @param degraded 設定値
    /// @returns なし
    /// @throws なし
    #[cfg(test)]
    async fn set_degraded_for_test(&self, degraded: bool) {
        let now = Instant::now();
        let mut state = self.state.lock().await;
        if state.degraded == degraded {
            return;
        }

        state.degraded = degraded;
        state.continuous_failure_since = degraded.then_some(now);
        state.healthy_since = (!degraded).then_some(now);
        state.l2_samples.clear();
        if degraded {
            self.degraded_enter_total.fetch_add(1, Ordering::Relaxed);
        } else {
            self.degraded_exit_total.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// degraded 状態遷移を評価する。
    /// @param state 内部状態
    /// @param now 判定時刻
    /// @returns なし
    /// @throws なし
    fn refresh_degraded_state(&self, state: &mut DragonflyMonitorState, now: Instant) {
        prune_l2_samples(state, now);
        let snapshot = build_dragonfly_snapshot(state, now);
        let should_enter = snapshot.healthcheck_failure_streak_seconds
            >= self.thresholds.enter_after_healthcheck_failure.as_secs()
            || (snapshot.l2_sample_total >= self.thresholds.enter_min_l2_samples as u64
                && snapshot.l2_error_rate >= self.thresholds.enter_after_l2_error_rate);
        let should_exit = snapshot.healthy_streak_seconds
            >= self.thresholds.exit_after_healthy_duration.as_secs()
            && snapshot.l2_error_rate < self.thresholds.exit_when_l2_error_rate_below;

        if !state.degraded && should_enter {
            state.degraded = true;
            self.degraded_enter_total.fetch_add(1, Ordering::Relaxed);
        } else if state.degraded && should_exit {
            state.degraded = false;
            self.degraded_exit_total.fetch_add(1, Ordering::Relaxed);
        }
    }
}

/// RESTレート制限サービスを保持する。
#[derive(Clone)]
pub struct RestRateLimitService {
    config: RestRateLimitConfig,
    message_create_limiter: Arc<FixedWindowRateLimiter>,
    invite_access_limiter: Arc<FixedWindowRateLimiter>,
    moderation_limiter: Arc<FixedWindowRateLimiter>,
    dragonfly_monitor: Arc<DragonflyRateLimitMonitor>,
    metrics: Arc<RateLimitMetrics>,
}

impl RestRateLimitService {
    /// サービスを生成する。
    /// @param config レート制限構成
    /// @returns レート制限サービス
    /// @throws なし
    pub fn new(config: RestRateLimitConfig) -> Self {
        Self {
            config,
            message_create_limiter: Arc::new(FixedWindowRateLimiter::new(
                config.message_create_max_requests,
                config.window,
            )),
            invite_access_limiter: Arc::new(FixedWindowRateLimiter::new(
                config.invite_access_max_requests,
                config.window,
            )),
            moderation_limiter: Arc::new(FixedWindowRateLimiter::new(
                config.moderation_max_requests,
                config.window,
            )),
            dragonfly_monitor: Arc::new(DragonflyRateLimitMonitor::new(config.degraded_thresholds)),
            metrics: Arc::new(RateLimitMetrics::default()),
        }
    }

    /// principal と action に対するレート制限判定を返す。
    /// @param principal_id 対象principal
    /// @param action 対象アクション
    /// @returns 判定結果
    /// @throws なし
    pub async fn evaluate(
        &self,
        principal_id: PrincipalId,
        action: RestRateLimitAction,
    ) -> RateLimitDecision {
        let rate_limit_key = format!("principal:{}:{}", principal_id.0, action.label());
        self.evaluate_key(rate_limit_key, action).await
    }

    /// 任意キーと action に対するレート制限判定を返す。
    /// @param rate_limit_key 対象キー
    /// @param action 対象アクション
    /// @returns 判定結果
    /// @throws なし
    pub async fn evaluate_key(
        &self,
        rate_limit_key: impl Into<String>,
        action: RestRateLimitAction,
    ) -> RateLimitDecision {
        let rate_limit_key = rate_limit_key.into();
        self.metrics.record_request(action);
        let dragonfly = self.dragonfly_monitor.snapshot().await;

        if action.operation_class() == RateLimitOperationClass::HighRiskAbuseSurface
            && dragonfly.degraded
        {
            self.metrics.record_rejected(action, true);
            return RateLimitDecision::reject(
                action,
                true,
                ceil_duration_seconds(self.config.fail_close_retry_after),
                true,
            );
        }

        let decision = limiter_for_action(self, action)
            .check_and_record_with_retry_after(&rate_limit_key)
            .await;

        if decision.allowed {
            self.metrics.record_allowed();
            return RateLimitDecision::allow(action, dragonfly.degraded);
        }

        self.metrics.record_rejected(action, false);
        RateLimitDecision::reject(
            action,
            false,
            ceil_duration_seconds(decision.retry_after.unwrap_or(self.config.window)),
            dragonfly.degraded,
        )
    }

    /// テスト用に degraded 状態を直接設定する。
    /// @param degraded 設定値
    /// @returns なし
    /// @throws なし
    #[cfg(test)]
    pub(crate) async fn set_degraded_for_test(&self, degraded: bool) {
        self.dragonfly_monitor.set_degraded_for_test(degraded).await;
    }
}

/// 実行時構成でサービスを生成する。
/// @param なし
/// @returns 実行時レート制限サービス
/// @throws なし
pub fn build_runtime_rest_rate_limit_service() -> RestRateLimitService {
    RestRateLimitService::new(RestRateLimitConfig::from_env())
}

/// RESTリクエストからレート制限対象アクションを返す。
/// @param method HTTPメソッド
/// @param path リクエストパス
/// @returns 対象アクション
/// @throws なし
pub fn rest_rate_limit_action_for_request(
    method: &Method,
    path: &str,
) -> Option<RestRateLimitAction> {
    if *method == Method::GET && is_invite_access_path(path) {
        return Some(RestRateLimitAction::InviteAccess);
    }
    if *method == Method::PATCH && is_moderation_path(path) {
        return Some(RestRateLimitAction::ModerationAction);
    }
    if *method == Method::POST
        && (is_guild_message_create_path(path) || is_dm_message_create_path(path))
    {
        return Some(RestRateLimitAction::MessageCreate);
    }

    None
}

/// guild message create パスかを判定する。
/// @param path リクエストパス
/// @returns 対象時 `true`
/// @throws なし
fn is_guild_message_create_path(path: &str) -> bool {
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    segments.len() == 6
        && segments[0] == "v1"
        && segments[1] == "guilds"
        && segments[3] == "channels"
        && segments[5] == "messages"
}

/// DM message create パスかを判定する。
/// @param path リクエストパス
/// @returns 対象時 `true`
/// @throws なし
fn is_dm_message_create_path(path: &str) -> bool {
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    segments.len() == 4 && segments[0] == "v1" && segments[1] == "dms" && segments[3] == "messages"
}

/// guild invite パスかを判定する。
/// @param path リクエストパス
/// @returns 対象時 `true`
/// @throws なし
fn is_invite_access_path(path: &str) -> bool {
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    (segments.len() == 5
        && segments[0] == "v1"
        && segments[1] == "guilds"
        && segments[3] == "invites")
        || (segments.len() == 3 && segments[0] == "v1" && segments[1] == "invites")
}

/// moderation パスかを判定する。
/// @param path リクエストパス
/// @returns 対象時 `true`
/// @throws なし
fn is_moderation_path(path: &str) -> bool {
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    segments.len() == 6
        && segments[0] == "v1"
        && segments[1] == "moderation"
        && segments[2] == "guilds"
        && segments[4] == "members"
}

/// 実際に使う limiter を返す。
/// @param service レート制限サービス
/// @param action 対象アクション
/// @returns 対応 limiter
/// @throws なし
fn limiter_for_action(
    service: &RestRateLimitService,
    action: RestRateLimitAction,
) -> &Arc<FixedWindowRateLimiter> {
    match action {
        RestRateLimitAction::InviteAccess => &service.invite_access_limiter,
        RestRateLimitAction::ModerationAction => &service.moderation_limiter,
        RestRateLimitAction::MessageCreate => &service.message_create_limiter,
    }
}

/// 観測を状態へ反映する。
/// @param state 内部状態
/// @param observation 観測入力
/// @param now 判定時刻
/// @returns なし
/// @throws なし
#[cfg(test)]
fn apply_observation(
    state: &mut DragonflyMonitorState,
    observation: DragonflyObservation,
    now: Instant,
) {
    if let Some(healthcheck_success) = observation.healthcheck_success {
        if healthcheck_success {
            state.continuous_failure_since = None;
            if state.healthy_since.is_none() {
                state.healthy_since = Some(now);
            }
        } else {
            if state.continuous_failure_since.is_none() {
                state.continuous_failure_since = Some(now);
            }
            state.healthy_since = None;
        }
    }

    if let Some(l2_result_success) = observation.l2_result_success {
        state.l2_samples.push_back(L2ResultSample {
            at: now,
            success: l2_result_success,
        });
    }
}

/// 時間窓外の L2 サンプルを削除する。
/// @param state 内部状態
/// @param now 判定時刻
/// @returns なし
/// @throws なし
fn prune_l2_samples(state: &mut DragonflyMonitorState, now: Instant) {
    let window = Duration::from_secs(L2_ERROR_RATE_WINDOW_SECONDS);
    while let Some(sample) = state.l2_samples.front() {
        if now.duration_since(sample.at) <= window {
            break;
        }
        state.l2_samples.pop_front();
    }
}

/// 現在状態から Dragonfly スナップショットを生成する。
/// @param state 内部状態
/// @param now 判定時刻
/// @returns Dragonfly状態スナップショット
/// @throws なし
fn build_dragonfly_snapshot(
    state: &DragonflyMonitorState,
    now: Instant,
) -> DragonflyStatusSnapshot {
    let l2_error_count = state
        .l2_samples
        .iter()
        .filter(|sample| !sample.success)
        .count() as f64;
    let l2_sample_total = state.l2_samples.len() as f64;
    let l2_error_rate = if l2_sample_total > 0.0 {
        l2_error_count / l2_sample_total
    } else {
        0.0
    };

    DragonflyStatusSnapshot {
        degraded: state.degraded,
        healthcheck_failure_streak_seconds: state
            .continuous_failure_since
            .map(|instant| now.duration_since(instant).as_secs())
            .unwrap_or(0),
        healthy_streak_seconds: state
            .healthy_since
            .map(|instant| now.duration_since(instant).as_secs())
            .unwrap_or(0),
        l2_error_rate,
        l2_sample_total: l2_sample_total as u64,
    }
}

/// Duration を Retry-After の秒へ切り上げ変換する。
/// @param duration 変換対象
/// @returns 秒数
/// @throws なし
fn ceil_duration_seconds(duration: Duration) -> u64 {
    if duration.is_zero() {
        return 1;
    }

    let seconds = duration.as_secs();
    if duration.subsec_nanos() > 0 {
        seconds.saturating_add(1)
    } else {
        seconds.max(1)
    }
}

/// u32 環境変数を解釈する。
/// @param name 環境変数名
/// @param default 既定値
/// @returns 解析結果
/// @throws なし
fn parse_env_u32(name: &str, default: u32) -> u32 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(default)
        .max(1)
}

/// u64 環境変数を解釈する。
/// @param name 環境変数名
/// @param default 既定値
/// @returns 解析結果
/// @throws なし
fn parse_env_u64(name: &str, default: u64) -> u64 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(default)
        .max(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rest_rate_limit_action_maps_supported_paths() {
        assert_eq!(
            rest_rate_limit_action_for_request(&Method::GET, "/v1/guilds/10/invites/invite-abc"),
            Some(RestRateLimitAction::InviteAccess)
        );
        assert_eq!(
            rest_rate_limit_action_for_request(&Method::GET, "/v1/invites/invite-abc"),
            Some(RestRateLimitAction::InviteAccess)
        );
        assert_eq!(
            rest_rate_limit_action_for_request(
                &Method::PATCH,
                "/v1/moderation/guilds/10/members/9003"
            ),
            Some(RestRateLimitAction::ModerationAction)
        );
        assert_eq!(
            rest_rate_limit_action_for_request(&Method::POST, "/v1/guilds/10/channels/55/messages"),
            Some(RestRateLimitAction::MessageCreate)
        );
        assert_eq!(
            rest_rate_limit_action_for_request(&Method::POST, "/v1/dms/55/messages"),
            Some(RestRateLimitAction::MessageCreate)
        );
        assert_eq!(
            rest_rate_limit_action_for_request(&Method::GET, "/v1/dms/55/messages"),
            None
        );
    }

    #[tokio::test]
    async fn dragonfly_monitor_enters_degraded_after_healthcheck_failure_window() {
        let monitor = DragonflyRateLimitMonitor::new(DragonflyDegradedThresholds::default());
        let base = Instant::now();

        monitor
            .observe_at(
                DragonflyObservation {
                    healthcheck_success: Some(false),
                    l2_result_success: None,
                },
                base,
            )
            .await;
        let snapshot = monitor.snapshot_at(base + Duration::from_secs(31)).await;

        assert!(snapshot.degraded);
        assert!(snapshot.healthcheck_failure_streak_seconds >= 31);
    }

    #[tokio::test]
    async fn dragonfly_monitor_enters_degraded_after_l2_error_rate_threshold() {
        let monitor = DragonflyRateLimitMonitor::new(DragonflyDegradedThresholds::default());
        let base = Instant::now();

        for index in 0..10 {
            monitor
                .observe_at(
                    DragonflyObservation {
                        healthcheck_success: Some(true),
                        l2_result_success: Some(index < 7),
                    },
                    base + Duration::from_secs(index),
                )
                .await;
        }

        let snapshot = monitor.snapshot_at(base + Duration::from_secs(10)).await;
        assert!(snapshot.degraded);
        assert!(snapshot.l2_error_rate >= 0.2);
    }

    #[tokio::test]
    async fn dragonfly_monitor_does_not_enter_degraded_before_min_l2_samples() {
        let monitor = DragonflyRateLimitMonitor::new(DragonflyDegradedThresholds::default());
        let base = Instant::now();

        monitor
            .observe_at(
                DragonflyObservation {
                    healthcheck_success: Some(true),
                    l2_result_success: Some(false),
                },
                base,
            )
            .await;

        let snapshot = monitor.snapshot_at(base + Duration::from_secs(1)).await;
        assert!(!snapshot.degraded);
        assert_eq!(snapshot.l2_sample_total, 1);
    }

    #[tokio::test]
    async fn dragonfly_monitor_exits_degraded_after_healthy_window() {
        let monitor = DragonflyRateLimitMonitor::new(DragonflyDegradedThresholds::default());
        let base = Instant::now();

        monitor
            .observe_at(
                DragonflyObservation {
                    healthcheck_success: Some(false),
                    l2_result_success: Some(false),
                },
                base,
            )
            .await;
        let degraded_snapshot = monitor.snapshot_at(base + Duration::from_secs(31)).await;
        assert!(degraded_snapshot.degraded);

        monitor
            .observe_at(
                DragonflyObservation {
                    healthcheck_success: Some(true),
                    l2_result_success: Some(true),
                },
                base + Duration::from_secs(32),
            )
            .await;
        let recovered_snapshot = monitor
            .snapshot_at(base + Duration::from_secs(32 + 601))
            .await;

        assert!(!recovered_snapshot.degraded);
        assert!(recovered_snapshot.healthy_streak_seconds >= 600);
        assert!(recovered_snapshot.l2_error_rate < 0.01);
    }

    #[tokio::test]
    async fn rest_rate_limit_service_fail_closes_high_risk_actions_when_degraded() {
        let service = RestRateLimitService::new(RestRateLimitConfig::default());
        service.set_degraded_for_test(true).await;

        let invite_decision = service
            .evaluate(PrincipalId(42), RestRateLimitAction::InviteAccess)
            .await;
        let message_decision = service
            .evaluate(PrincipalId(42), RestRateLimitAction::MessageCreate)
            .await;

        assert!(!invite_decision.allowed());
        assert!(invite_decision.is_fail_close());
        assert!(message_decision.allowed());
    }
}
