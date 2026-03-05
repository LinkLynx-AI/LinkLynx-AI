#[cfg(test)]
mod tests {
    use super::*;

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
}
