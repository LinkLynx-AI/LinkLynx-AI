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
    fn create_guild_channel_sql_requires_membership_lookup() {
        let sql = PostgresGuildChannelService::CREATE_GUILD_CHANNEL_SQL;

        assert!(sql.contains("FROM guild_members"));
        assert!(sql.contains("FOR KEY SHARE"));
        assert!(!sql.contains("VALUES ('guild_text'"));
    }

    #[test]
    fn list_guild_channels_sql_requires_membership_lookup() {
        let sql = PostgresGuildChannelService::LIST_GUILD_CHANNELS_SQL;

        assert!(sql.contains("FROM guild_members"));
        assert!(sql.contains("LEFT JOIN channels"));
        assert!(sql.contains("FOR KEY SHARE"));
    }
}
