use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    init_tracing();
    tracing::info!("{}", worker_started_message());
}

fn init_tracing() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_filter_from_env())
        .init();
}

fn default_log_filter() -> &'static str {
    "info"
}

fn tracing_filter_from_env() -> tracing_subscriber::EnvFilter {
    tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| default_log_filter().into())
}

fn worker_started_message() -> &'static str {
    "batch worker started"
}

#[cfg(test)]
mod tests {
    use super::{default_log_filter, init_tracing, worker_started_message};

    #[test]
    fn default_log_filter_is_info() {
        assert_eq!(default_log_filter(), "info");
    }

    #[test]
    fn worker_started_message_is_stable() {
        assert_eq!(worker_started_message(), "batch worker started");
    }

    #[test]
    fn init_tracing_can_be_called_once() {
        init_tracing();
    }
}
