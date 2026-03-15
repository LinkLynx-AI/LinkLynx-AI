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
            theme: None,
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
            theme: None,
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
            theme: None,
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
            banner_key: Some(Some("  folder/banner_1.png  ".to_owned())),
            theme: Some(" dark ".to_owned()),
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
            Some(Some("folder/banner_1.png".to_owned()))
        );
        assert_eq!(normalized.theme, Some(ProfileTheme::Dark));
    }

    #[test]
    fn normalize_profile_patch_input_rejects_status_too_long() {
        let patch = ProfilePatchInput {
            display_name: None,
            status_text: Some(Some("a".repeat(191))),
            avatar_key: None,
            banner_key: None,
            theme: None,
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
            theme: None,
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
            theme: None,
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
            theme: None,
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
    fn normalize_profile_patch_input_rejects_invalid_theme() {
        let patch = ProfilePatchInput {
            display_name: None,
            status_text: None,
            avatar_key: None,
            banner_key: None,
            theme: Some("onyx".to_owned()),
        };

        let result = normalize_profile_patch_input(patch);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "theme_invalid_value"
        ));
    }

    #[test]
    fn validate_profile_media_patch_keys_rejects_cross_principal_key() {
        let patch = NormalizedProfilePatch {
            display_name: None,
            status_text: None,
            avatar_key: None,
            banner_key: Some(Some(
                "v0/tenant/default/user/999/profile/banner/asset/550e8400-e29b-41d4-a716-446655440000/banner.png"
                    .to_owned(),
            )),
            theme: None,
        };

        let result = validate_profile_media_patch_keys(PrincipalId(1001), &patch);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "banner_key_invalid_profile_media_key"
        ));
    }

    #[test]
    fn validate_profile_media_patch_keys_accepts_matching_target_and_principal() {
        let patch = NormalizedProfilePatch {
            display_name: None,
            status_text: None,
            avatar_key: Some(Some(
                "v0/tenant/default/user/1001/profile/avatar/asset/550e8400-e29b-41d4-a716-446655440000/avatar.png"
                    .to_owned(),
            )),
            banner_key: Some(Some(
                "v0/tenant/default/user/1001/profile/banner/asset/550e8400-e29b-41d4-a716-446655440001/banner.png"
                    .to_owned(),
            )),
            theme: None,
        };

        let result = validate_profile_media_patch_keys(PrincipalId(1001), &patch);
        assert!(result.is_ok());
    }

    #[test]
    fn profile_media_error_maps_to_contract() {
        let error = ProfileError::media_not_found("profile_media_key_missing");

        assert_eq!(error.status_code(), axum::http::StatusCode::NOT_FOUND);
        assert_eq!(error.app_code(), "PROFILE_MEDIA_NOT_FOUND");
    }

    #[test]
    fn profile_media_target_parses_avatar() {
        let target = ProfileMediaTarget::parse("avatar").unwrap();
        assert_eq!(target, ProfileMediaTarget::Avatar);
    }

    #[test]
    fn sanitize_profile_media_filename_replaces_unsafe_characters() {
        let normalized = sanitize_profile_media_filename(" avatar image!.png ").unwrap();
        assert_eq!(normalized, "avatar-image-.png");
    }

    #[test]
    fn normalize_profile_media_content_type_rejects_non_image() {
        let result = normalize_profile_media_content_type("text/plain");
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "profile_media_content_type_invalid"
        ));
    }

    #[test]
    fn normalize_profile_media_content_type_rejects_control_chars() {
        let result = normalize_profile_media_content_type("image/png\r\nx-test: injected");
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "profile_media_content_type_invalid"
        ));
    }

    #[test]
    fn normalize_profile_media_content_type_rejects_unallowed_svg() {
        let result = normalize_profile_media_content_type("image/svg+xml");
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "profile_media_content_type_not_allowed"
        ));
    }

    #[test]
    fn validate_profile_media_content_type_filename_match_rejects_known_mismatch() {
        let result = validate_profile_media_content_type_filename_match("image/png", "avatar.jpg");
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "profile_media_content_type_extension_mismatch"
        ));
    }

    #[test]
    fn validate_profile_media_content_type_filename_match_allows_unknown_extension() {
        let result = validate_profile_media_content_type_filename_match("image/png", "avatar.bin");
        assert!(result.is_ok());
    }

    #[test]
    fn validate_profile_media_size_bytes_rejects_oversized_avatar() {
        let result = validate_profile_media_size_bytes(
            ProfileMediaTarget::Avatar,
            PROFILE_MEDIA_AVATAR_MAX_SIZE_BYTES + 1,
        );
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "profile_media_size_too_large"
        ));
    }

    #[test]
    fn validate_profile_media_size_bytes_rejects_zero_size() {
        let result = validate_profile_media_size_bytes(ProfileMediaTarget::Banner, 0);
        assert!(matches!(
            result,
            Err(ProfileError {
                kind: ProfileErrorKind::Validation,
                reason,
            }) if reason == "profile_media_size_invalid"
        ));
    }

    #[test]
    fn signed_url_contains_expected_profile_media_segments() {
        let signer = GcsSignedUrlSigner::from_service_account_path(
            "profile-media".to_owned(),
            "/tmp/lin939-test-service-account.json",
        )
        .unwrap_or_else(|_| {
            let private_key = r#"-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCvUF8orxlww/dC
gWPEb/oOIXShUtsGmeMVGyksbcpuUHPR5N+ZFiJmCao8LKT3T+CNYzSOuYMkK2PU
e+Td7Kq4bbb/QIej+l5USv808a9xgU4TE3BTaeNgslNpEE7f6wU9brYVhw2nQ/Hb
2NNOcHu4CluilqTaQrjPdj5TWo81doxn8CjvA/DeDJuTZkgd2riHhP60cx4J0C7p
ietytsr4K8SCzh/1qh787FpfVU4fU21gAulIuqf17Kt4CTE4tAeWAfjumjNmLAKA
ZyMcEujKTNy0OB8ObPARuqRLLaqwvGF4rQ2RGZrAbm4BiWrTfCOJPBQqlN8MW7Xk
f99V0ecFAgMBAAECggEAAVFwobjtT0p9569a3W19GxGX06WwlWRfT3eQj++0Y69x
q3yVzMwcjplYgRLR27UrSkzaZo9RA9raqYyT7DI9F11l0JX+3xYBEw+sSwzdJZSU
DnMpN0tWxRGaLHJNsYPOGofkURWenekWHrHK5u5UE85qIXcR/r0dMBwivFQ0OvHp
xnmn98nZ21T4joBoftb1ai+TKEzhwYYYEgGby9KA0ekIHb+V0QMJbocRig98znUp
I29ObXRD3JDNM9P0a4Q7tObeBqrkspxBRxmU4pqc2Jxp7GeFA+UC4U37S+xjpU0y
0v2dvJdUb2PS3MluWYOlZg8BXOszVqIwiGIMuVyskQKBgQDxF09VM+JYlmb3cCfu
snHbuczf9R9nHHIgk3LBiLIQX1f9ytY9DgSr8w2hwGdZ+/TXqLEjqtlGLVF80u7B
LlDCldt1BSkV9Yp+bIP2//CgBXiI61NXD02hAUC5roqV5SWaxLSCksfTNn+cnKEe
zNZkDsH+lLZRpl74mgZ73C/r1QKBgQC6J8AoktTjYyRV1RJzRHftOUSa+w2MX99e
8RQE7u2qaBF1AaMrMw4I4/GmPYDKeV6I8BtsHyTjGv9QFmjjZFE6zK2hoxZEReyE
SG7vOmXZePjvvTvYRs3b9BqHj2wazPf+UxviCZWx3S76o7+SlL3zlc1hWMqL7Q0l
8GwVuIyWcQKBgDCzy8Pjekr4/w3nKznt9FA1xWxMgS58MZXhE2KDMa1bBVRwgDzP
MyRlMhDF5FrqKfjSzA3venrRts9ncPG3YHseeLm39CfKdVK6qyHfbAV3dXT7TNee
cMkgjqmz160WIDWWnPxvmExTiw3hGi81o+2MiaXa9sWhvTetLbghr9CNAoGAKTk+
S33gmQ5OcJeDw3TpHeZts+heorRkcdDvPvxuMytimkeni5x9wihATjEWgUAJWEfb
usDW2VgUK/caeSiw+FV1KfNErg/SBaVIs7956IPqlKSSSR283rWa3mQ7a1/ylyZu
aUr4FHBHxAdZGCvKONP2rFUOXZg8Liekt9arg3ECgYBYusofwKGMzD/0s8L7hDe+
PXkN4qGgcW05V/fShCKeuFReUw4P3bplKwTcK2KOfynpo42gLRa3/DJxv5yHPNt0
iYQwLAtAPWEfPJcpkZ60iaDeUtuTrckLBIMfINHXC6+ltIfxFa4VdNTyLkKen9Tt
+irj5Hd2wpn14JeGdDoASQ==
-----END PRIVATE KEY-----"#;
            GcsSignedUrlSigner {
                bucket: "profile-media".to_owned(),
                credential: GcsSignerCredential::LocalKey {
                    client_email: "profile-media@example.com".to_owned(),
                    encoding_key: jsonwebtoken::EncodingKey::from_rsa_pem(private_key.as_bytes())
                        .unwrap(),
                },
            }
        });
        let runtime = tokio::runtime::Runtime::new().unwrap();
        let upload = runtime
            .block_on(signer.issue_upload_url(
                PrincipalId(1001),
                ProfileMediaUploadInput {
                    target: ProfileMediaTarget::Banner,
                    filename: "banner image.png".to_owned(),
                    content_type: "image/png".to_owned(),
                    size_bytes: 1_048_576,
                },
            ))
            .unwrap();
        assert!(upload.object_key.contains("/profile/banner/asset/"));
        assert!(upload.upload_url.contains("X-Goog-Signature="));
        assert!(
            upload.upload_url.contains("X%2DGoog%2DSignedHeaders="),
            "{}",
            upload.upload_url
        );
        assert!(
            upload.upload_url.contains("content%2Dlength"),
            "{}",
            upload.upload_url
        );
        assert!(
            upload.upload_url.contains("content%2Dtype"),
            "{}",
            upload.upload_url
        );
        assert!(upload.required_headers.contains_key("content-type"));
    }
}
