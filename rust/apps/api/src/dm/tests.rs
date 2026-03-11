#[cfg(test)]
mod dm_service_tests {
    use super::*;

    #[tokio::test]
    async fn unavailable_dm_service_returns_dependency_error() {
        let service = UnavailableDmService::new("dm_store_unconfigured");
        let error = service
            .list_dm_channels(PrincipalId(1))
            .await
            .expect_err("service should fail");
        assert_eq!(error.kind, DmErrorKind::DependencyUnavailable);
        assert_eq!(error.reason, "dm_store_unconfigured");
    }

    #[test]
    fn open_or_create_sql_serializes_same_pair_with_advisory_lock() {
        assert!(PostgresDmService::OPEN_OR_CREATE_DM_SQL.contains("pg_advisory_xact_lock"));
    }
}
