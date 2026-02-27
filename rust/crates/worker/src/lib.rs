pub async fn run_worker_once() {
    // placeholder
}

#[cfg(test)]
mod tests {
    use super::run_worker_once;

    #[tokio::test]
    async fn run_worker_once_completes() {
        run_worker_once().await;
    }
}
