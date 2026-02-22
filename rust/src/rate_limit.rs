use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RateLimitError {
    #[error("l2 store error: {0}")]
    L2(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GcraConfig {
    pub interval_ms: i64,
    pub burst: i64,
    pub ttl_seconds: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RateLimitDecision {
    pub allowed: bool,
    pub retry_after_ms: i64,
}

pub trait GcraL2Store: Send + Sync + 'static {
    fn get_tat_ms<'a>(
        &'a self,
        key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<Option<i64>, String>> + Send + 'a>>;

    fn set_tat_ms<'a>(
        &'a self,
        key: &'a str,
        tat_ms: i64,
        ttl_seconds: u64,
    ) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send + 'a>>;
}

#[derive(Default)]
pub struct InMemoryL2Store {
    values: tokio::sync::RwLock<HashMap<String, i64>>,
}

impl GcraL2Store for InMemoryL2Store {
    fn get_tat_ms<'a>(
        &'a self,
        key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<Option<i64>, String>> + Send + 'a>> {
        Box::pin(async move {
            let guard = self.values.read().await;
            Ok(guard.get(key).copied())
        })
    }

    fn set_tat_ms<'a>(
        &'a self,
        key: &'a str,
        tat_ms: i64,
        _ttl_seconds: u64,
    ) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send + 'a>> {
        Box::pin(async move {
            let mut guard = self.values.write().await;
            guard.insert(key.to_string(), tat_ms);
            Ok(())
        })
    }
}

pub fn user_key(user_id: i64, action: &str) -> String {
    format!("rl2:gcra:user:{user_id}:{action}")
}

pub fn ip_key(ip: &str, action: &str) -> String {
    format!("rl2:gcra:ip:{ip}:{action}")
}

pub struct RateLimiter<L2: GcraL2Store> {
    l1_tat_by_key: HashMap<String, i64>,
    l2: L2,
}

impl<L2: GcraL2Store> RateLimiter<L2> {
    pub fn new(l2: L2) -> Self {
        Self {
            l1_tat_by_key: HashMap::new(),
            l2,
        }
    }

    pub async fn evaluate(
        &mut self,
        key: &str,
        now_ms: i64,
        config: GcraConfig,
        should_consult_l2: bool,
    ) -> Result<RateLimitDecision, RateLimitError> {
        let tat = if should_consult_l2 {
            let l2 = self
                .l2
                .get_tat_ms(key)
                .await
                .map_err(RateLimitError::L2)?
                .unwrap_or(now_ms);
            self.l1_tat_by_key.get(key).copied().unwrap_or(l2)
        } else {
            self.l1_tat_by_key.get(key).copied().unwrap_or(now_ms)
        };

        let next_tat = tat.max(now_ms) + config.interval_ms;
        let allowance = config.interval_ms * config.burst;
        let allowed = next_tat - now_ms <= allowance;
        let retry_after_ms = if allowed { 0 } else { (next_tat - allowance) - now_ms };

        if allowed {
            self.l1_tat_by_key.insert(key.to_string(), next_tat);
            if should_consult_l2 {
                self.l2
                    .set_tat_ms(key, next_tat, config.ttl_seconds)
                    .await
                    .map_err(RateLimitError::L2)?;
            }
        }

        Ok(RateLimitDecision {
            allowed,
            retry_after_ms,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{ip_key, user_key, GcraConfig, InMemoryL2Store, RateLimiter};

    #[test]
    fn keys_follow_contract() {
        assert_eq!(user_key(7, "send_message"), "rl2:gcra:user:7:send_message");
        assert_eq!(
            ip_key("203.0.113.1", "login"),
            "rl2:gcra:ip:203.0.113.1:login"
        );
    }

    #[tokio::test]
    async fn allows_then_throttles_when_burst_exhausted() {
        let mut limiter = RateLimiter::new(InMemoryL2Store::default());
        let cfg = GcraConfig {
            interval_ms: 1000,
            burst: 2,
            ttl_seconds: 300,
        };
        let key = user_key(1, "send");

        let d1 = limiter.evaluate(&key, 0, cfg, true).await.unwrap();
        let d2 = limiter.evaluate(&key, 10, cfg, true).await.unwrap();
        let d3 = limiter.evaluate(&key, 20, cfg, true).await.unwrap();

        assert!(d1.allowed);
        assert!(d2.allowed);
        assert!(!d3.allowed);
        assert!(d3.retry_after_ms > 0);
    }

    #[tokio::test]
    async fn l2_consult_can_be_skipped_for_normal_path() {
        let mut limiter = RateLimiter::new(InMemoryL2Store::default());
        let cfg = GcraConfig {
            interval_ms: 1000,
            burst: 2,
            ttl_seconds: 300,
        };
        let key = user_key(2, "send");

        let first = limiter.evaluate(&key, 0, cfg, false).await.unwrap();
        let second = limiter.evaluate(&key, 500, cfg, false).await.unwrap();

        assert!(first.allowed);
        assert!(second.allowed);
    }
}
