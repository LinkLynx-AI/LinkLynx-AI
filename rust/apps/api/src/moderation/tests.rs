#[cfg(test)]
mod tests {
    use super::*;
    use crate::authz::AuthzError;
    struct AllowManageAuthorizer;
    struct DenyManageAuthorizer;
    struct UnavailableManageAuthorizer;

    #[async_trait]
    impl Authorizer for AllowManageAuthorizer {
        async fn check(&self, _input: &AuthzCheckInput) -> Result<(), AuthzError> {
            Ok(())
        }
    }

    #[async_trait]
    impl Authorizer for DenyManageAuthorizer {
        async fn check(&self, _input: &AuthzCheckInput) -> Result<(), AuthzError> {
            Err(AuthzError::denied("guild_manage_denied"))
        }
    }

    #[async_trait]
    impl Authorizer for UnavailableManageAuthorizer {
        async fn check(&self, _input: &AuthzCheckInput) -> Result<(), AuthzError> {
            Err(AuthzError::unavailable("spicedb_unavailable"))
        }
    }

    #[test]
    fn moderation_error_forbidden_maps_to_authz_contract() {
        let error = ModerationError::forbidden("moderation_role_required");

        assert_eq!(error.status_code(), axum::http::StatusCode::FORBIDDEN);
        assert_eq!(error.app_code(), "AUTHZ_DENIED");
    }

    #[test]
    fn moderation_error_unavailable_maps_to_authz_contract() {
        let error = ModerationError::dependency_unavailable("postgres_down");

        assert_eq!(error.status_code(), axum::http::StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(error.app_code(), "AUTHZ_UNAVAILABLE");
    }

    #[test]
    fn parse_target_type_from_api_label() {
        assert_eq!(
            ModerationTargetType::parse_api_label("message"),
            Some(ModerationTargetType::Message)
        );
        assert_eq!(
            ModerationTargetType::parse_api_label("USER"),
            Some(ModerationTargetType::User)
        );
        assert_eq!(ModerationTargetType::parse_api_label("unknown"), None);
    }

    #[test]
    fn normalize_non_empty_reason_rejects_blank() {
        let result = normalize_non_empty_reason("   ", "report_reason_required");

        assert!(matches!(
            result,
            Err(ModerationError {
                kind: ModerationErrorKind::Validation,
                ..
            })
        ));
    }

    #[test]
    fn normalize_non_empty_reason_trims_value() {
        let result = normalize_non_empty_reason("  spam  ", "report_reason_required").unwrap();

        assert_eq!(result, "spam");
    }

    #[test]
    fn normalize_optional_expires_at_converts_blank_to_none() {
        let result = normalize_optional_expires_at(Some("   ".to_owned())).unwrap();

        assert_eq!(result, None);
    }

    #[test]
    fn normalize_positive_id_rejects_non_positive_value() {
        let result = normalize_positive_id(0, "report_id_must_be_positive");

        assert!(matches!(
            result,
            Err(ModerationError {
                kind: ModerationErrorKind::Validation,
                reason,
            }) if reason == "report_id_must_be_positive"
        ));
    }

    #[test]
    fn moderation_report_list_cursor_rejects_invalid_timestamp() {
        let cursor = ModerationReportListCursor::decode("not-a-timestamp|4001");

        assert_eq!(cursor, None);
    }

    #[tokio::test]
    async fn ensure_moderator_access_uses_authorizer_manage_check() {
        let service = PostgresModerationService::new(
            Arc::new(AllowManageAuthorizer),
            "postgres://example".to_owned(),
            true,
        );

        assert!(service
            .ensure_moderator_access(2001, PrincipalId(9002))
            .await
            .is_ok());
    }

    #[tokio::test]
    async fn ensure_moderator_access_maps_denied_to_forbidden() {
        let service = PostgresModerationService::new(
            Arc::new(DenyManageAuthorizer),
            "postgres://example".to_owned(),
            true,
        );

        let result = service
            .ensure_moderator_access(2001, PrincipalId(9003))
            .await;

        assert!(matches!(
            result,
            Err(ModerationError {
                kind: ModerationErrorKind::Forbidden,
                reason,
            }) if reason == "moderation_role_required"
        ));
    }

    #[tokio::test]
    async fn ensure_moderator_access_maps_unavailable_to_dependency_unavailable() {
        let service = PostgresModerationService::new(
            Arc::new(UnavailableManageAuthorizer),
            "postgres://example".to_owned(),
            true,
        );

        let result = service
            .ensure_moderator_access(2001, PrincipalId(9003))
            .await;

        assert!(matches!(
            result,
            Err(ModerationError {
                kind: ModerationErrorKind::DependencyUnavailable,
                reason,
            }) if reason.contains("moderation_authorizer_failed:spicedb_unavailable")
        ));
    }
}
