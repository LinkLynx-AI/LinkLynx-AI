#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guild_channel_error_forbidden_maps_to_authz_contract() {
        let error = GuildChannelError::forbidden("guild_membership_required");

        assert_eq!(error.status_code(), axum::http::StatusCode::FORBIDDEN);
        assert_eq!(error.app_code(), "AUTHZ_DENIED");
    }

    #[test]
    fn guild_channel_error_unavailable_maps_to_authz_contract() {
        let error = GuildChannelError::dependency_unavailable("postgres_down");

        assert_eq!(error.status_code(), axum::http::StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(error.app_code(), "AUTHZ_UNAVAILABLE");
    }

    #[test]
    fn guild_channel_error_channel_not_found_maps_to_contract() {
        let error = GuildChannelError::channel_not_found("channel_not_found");

        assert_eq!(error.status_code(), axum::http::StatusCode::NOT_FOUND);
        assert_eq!(error.app_code(), "CHANNEL_NOT_FOUND");
    }

    #[test]
    fn normalize_non_empty_name_rejects_blank() {
        let result = normalize_non_empty_name("   ", "guild_name_required");

        assert!(matches!(
            result,
            Err(GuildChannelError {
                kind: GuildChannelErrorKind::Validation,
                ..
            })
        ));
    }

    #[test]
    fn normalize_non_empty_name_trims_value() {
        let result = normalize_non_empty_name("  hello  ", "guild_name_required").unwrap();

        assert_eq!(result, "hello");
    }

    #[test]
    fn normalize_channel_patch_input_rejects_blank() {
        let result = normalize_channel_patch_input(ChannelPatchInput {
            name: "   ".to_owned(),
        });

        assert!(matches!(
            result,
            Err(GuildChannelError {
                kind: GuildChannelErrorKind::Validation,
                ..
            })
        ));
    }

    #[test]
    fn normalize_channel_patch_input_trims_name() {
        let result = normalize_channel_patch_input(ChannelPatchInput {
            name: "  release-notes  ".to_owned(),
        })
        .unwrap();

        assert_eq!(result, "release-notes");
    }

    #[test]
    fn normalize_channel_patch_input_rejects_too_long_name() {
        let too_long = "a".repeat(CHANNEL_NAME_MAX_CHARS + 1);
        let result = normalize_channel_patch_input(ChannelPatchInput { name: too_long });

        assert!(matches!(
            result,
            Err(GuildChannelError {
                kind: GuildChannelErrorKind::Validation,
                reason,
            }) if reason == "channel_name_too_long"
        ));
    }

    #[test]
    fn normalize_channel_create_input_trims_name_and_preserves_hierarchy_fields() {
        let result = normalize_channel_create_input(CreateChannelInput {
            name: "  times-abe  ".to_owned(),
            kind: ChannelKind::GuildText,
            parent_id: Some(3001),
        })
        .unwrap();

        assert_eq!(result.name, "times-abe");
        assert_eq!(result.kind, ChannelKind::GuildText);
        assert_eq!(result.parent_id, Some(3001));
    }

    #[test]
    fn normalize_channel_create_input_rejects_non_positive_parent_id() {
        let result = normalize_channel_create_input(CreateChannelInput {
            name: "times-abe".to_owned(),
            kind: ChannelKind::GuildText,
            parent_id: Some(0),
        });

        assert!(matches!(
            result,
            Err(GuildChannelError {
                kind: GuildChannelErrorKind::Validation,
                reason,
            }) if reason == "parent_id_must_be_positive"
        ));
    }

    #[test]
    fn normalize_guild_name_rejects_too_long_value() {
        let long_name = "a".repeat(101);
        let result = normalize_guild_name(&long_name);

        assert!(matches!(
            result,
            Err(GuildChannelError {
                kind: GuildChannelErrorKind::Validation,
                reason,
            }) if reason == "guild_name_too_long"
        ));
    }

    #[test]
    fn normalize_icon_key_normalizes_blank_to_none() {
        let result = normalize_icon_key(Some("   ".to_owned())).unwrap();

        assert_eq!(result, None);
    }

    #[test]
    fn normalize_icon_key_rejects_invalid_format() {
        let result = normalize_icon_key(Some("bad key".to_owned()));

        assert!(matches!(
            result,
            Err(GuildChannelError {
                kind: GuildChannelErrorKind::Validation,
                reason,
            }) if reason == "icon_key_invalid_format"
        ));
    }

    #[test]
    fn create_guild_channel_sql_requires_membership_lookup() {
        let sql = PostgresGuildChannelService::CREATE_GUILD_CHANNEL_SQL;

        assert!(sql.contains("FROM guild_members"));
        assert!(sql.contains("owner_id = $4"));
        assert!(sql.contains("validated_parent"));
        assert!(sql.contains("channel_hierarchies_v2"));
        assert!(sql.contains("FOR KEY SHARE"));
        assert!(!sql.contains("VALUES ('guild_text'"));
        assert!(!sql.contains("role_key IN ('owner', 'admin')"));
    }

    #[test]
    fn create_guild_sql_bootstraps_v2_system_roles() {
        let sql = PostgresGuildChannelService::CREATE_GUILD_SQL;

        assert!(sql.contains("INSERT INTO guild_roles_v2"));
        assert!(sql.contains("INSERT INTO guild_member_roles_v2"));
        assert!(sql.contains("('owner'::text, 'Owner'::text, 300::int, TRUE)"));
        assert!(sql.contains("('member'::text, 'Member'::text, 100::int, FALSE)"));
        assert!(sql.contains("is_system"));
        assert!(!sql.contains("INSERT INTO guild_roles ("));
        assert!(!sql.contains("INSERT INTO guild_member_roles ("));
        assert!(!sql.contains("role_level"));
    }

    #[test]
    fn list_guild_channels_sql_requires_membership_lookup() {
        let sql = PostgresGuildChannelService::LIST_GUILD_CHANNELS_SQL;

        assert!(sql.contains("FROM guild_members"));
        assert!(sql.contains("LEFT JOIN channels"));
        assert!(sql.contains("channel_hierarchies_v2"));
        assert!(sql.contains("FOR KEY SHARE"));
    }

    #[test]
    fn channel_kind_parse_supports_known_types() {
        assert_eq!(ChannelKind::parse("guild_text").unwrap(), ChannelKind::GuildText);
        assert_eq!(
            ChannelKind::parse("guild_category").unwrap(),
            ChannelKind::GuildCategory
        );
    }

    #[test]
    fn update_guild_sql_requires_manage_boundary_lookup() {
        let sql = PostgresGuildChannelService::UPDATE_GUILD_SQL;

        assert!(sql.contains("guild_member_roles_v2"));
        assert!(sql.contains("guild_roles_v2"));
        assert!(sql.contains("allow_manage = TRUE"));
    }

    #[test]
    fn delete_guild_sql_requires_manage_boundary_lookup() {
        let sql = PostgresGuildChannelService::DELETE_GUILD_SQL;

        assert!(sql.contains("DELETE FROM guilds"));
        assert!(sql.contains("guild_member_roles_v2"));
        assert!(sql.contains("guild_roles_v2"));
        assert!(sql.contains("allow_manage = TRUE"));
    }

    #[test]
    fn update_guild_channel_sql_requires_manage_permission_lookup() {
        let sql = PostgresGuildChannelService::UPDATE_GUILD_CHANNEL_SQL;

        assert!(sql.contains("UPDATE channels"));
        assert!(sql.contains("guild_member_roles_v2"));
        assert!(sql.contains("guild_roles_v2"));
        assert!(sql.contains("owner_id = $2"));
        assert!(sql.contains("allow_manage = TRUE"));
        assert!(!sql.contains("role_key IN ('owner', 'admin')"));
    }

    #[test]
    fn delete_guild_channel_sql_requires_manage_permission_lookup() {
        let sql = PostgresGuildChannelService::DELETE_GUILD_CHANNEL_SQL;

        assert!(sql.contains("DELETE FROM channels"));
        assert!(sql.contains("guild_member_roles_v2"));
        assert!(sql.contains("guild_roles_v2"));
        assert!(sql.contains("owner_id = $2"));
        assert!(sql.contains("allow_manage = TRUE"));
        assert!(!sql.contains("role_key IN ('owner', 'admin')"));
    }
}
