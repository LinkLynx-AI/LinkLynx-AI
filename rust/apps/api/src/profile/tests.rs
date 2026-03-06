#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_error_validation_maps_to_contract() {
        let error = ProfileError::validation("display_name_required");

        assert_eq!(error.status_code(), axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(error.app_code(), "VALIDATION_ERROR");
    }

    #[test]
    fn profile_error_not_found_maps_to_contract() {
        let error = ProfileError::not_found("user_not_found");

        assert_eq!(error.status_code(), axum::http::StatusCode::NOT_FOUND);
        assert_eq!(error.app_code(), "USER_NOT_FOUND");
    }

    #[test]
    fn normalize_profile_patch_input_rejects_empty_patch() {
        let patch = ProfilePatchInput {
            display_name: None,
            status_text: None,
            avatar_key: None,
            banner_key: None,
        };

        let result = normalize_profile_patch_input(patch);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                ..
            })
        ));
    }

    #[test]
    fn normalize_profile_patch_input_rejects_blank_display_name() {
        let patch = ProfilePatchInput {
            display_name: Some("   ".to_owned()),
            status_text: None,
            avatar_key: None,
            banner_key: None,
        };

        let result = normalize_profile_patch_input(patch);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                ..
            })
        ));
    }

    #[test]
    fn normalize_profile_patch_input_rejects_display_name_too_long() {
        let patch = ProfilePatchInput {
            display_name: Some("a".repeat(33)),
            status_text: None,
            avatar_key: None,
            banner_key: None,
        };

        let result = normalize_profile_patch_input(patch);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "display_name_too_long"
        ));
    }

    #[test]
    fn normalize_profile_patch_input_normalizes_nullable_text_as_null() {
        let patch = ProfilePatchInput {
            display_name: Some("  Display Name  ".to_owned()),
            status_text: Some(Some("   ".to_owned())),
            avatar_key: Some(Some("  folder/avatar_1.png  ".to_owned())),
            banner_key: Some(Some("  banners/banner_1.png  ".to_owned())),
        };

        let normalized = normalize_profile_patch_input(patch).unwrap();
        assert_eq!(normalized.display_name, Some("Display Name".to_owned()));
        assert_eq!(normalized.status_text, Some(None));
        assert_eq!(
            normalized.avatar_key,
            Some(Some("folder/avatar_1.png".to_owned()))
        );
        assert_eq!(
            normalized.banner_key,
            Some(Some("banners/banner_1.png".to_owned()))
        );
    }

    #[test]
    fn normalize_profile_patch_input_rejects_status_too_long() {
        let patch = ProfilePatchInput {
            display_name: None,
            status_text: Some(Some("a".repeat(191))),
            avatar_key: None,
            banner_key: None,
        };

        let result = normalize_profile_patch_input(patch);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                ..
            })
        ));
    }

    #[test]
    fn normalize_profile_patch_input_rejects_invalid_avatar_key_format() {
        let patch = ProfilePatchInput {
            display_name: None,
            status_text: None,
            avatar_key: Some(Some("avatar key with space".to_owned())),
            banner_key: None,
        };

        let result = normalize_profile_patch_input(patch);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                ..
            })
        ));
    }

    #[test]
    fn normalize_profile_patch_input_rejects_avatar_key_too_long() {
        let patch = ProfilePatchInput {
            display_name: None,
            status_text: None,
            avatar_key: Some(Some("a".repeat(513))),
            banner_key: None,
        };

        let result = normalize_profile_patch_input(patch);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "avatar_key_too_long"
        ));
    }

    #[test]
    fn normalize_profile_patch_input_rejects_invalid_banner_key_format() {
        let patch = ProfilePatchInput {
            display_name: None,
            status_text: None,
            avatar_key: None,
            banner_key: Some(Some("banner key with space".to_owned())),
        };

        let result = normalize_profile_patch_input(patch);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "banner_key_invalid_format"
        ));
    }

    #[test]
    fn normalize_profile_patch_input_rejects_banner_key_too_long() {
        let patch = ProfilePatchInput {
            display_name: None,
            status_text: None,
            avatar_key: None,
            banner_key: Some(Some("a".repeat(513))),
        };

        let result = normalize_profile_patch_input(patch);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "banner_key_too_long"
        ));
    }
}
