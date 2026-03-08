#[cfg(test)]
mod tests {
    use super::*;

    fn sample_guild() -> PublicInviteGuild {
        PublicInviteGuild {
            guild_id: 2001,
            name: "LinkLynx Developers".to_owned(),
            icon_key: None,
        }
    }

    #[test]
    fn invite_error_unavailable_maps_to_service_unavailable() {
        let error = InviteError::dependency_unavailable("postgres_down");

        assert_eq!(error.status_code(), axum::http::StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(error.app_code(), "INVITE_UNAVAILABLE");
    }

    #[test]
    fn normalize_invite_code_rejects_blank() {
        let result = normalize_invite_code("   ");

        assert!(matches!(
            result,
            Err(InviteError {
                kind: InviteErrorKind::Validation,
                ..
            })
        ));
    }

    #[test]
    fn normalize_invite_code_trims_value() {
        let result = normalize_invite_code("  DEVJOIN2026  ").unwrap();

        assert_eq!(result, "DEVJOIN2026");
    }

    #[test]
    fn build_public_invite_lookup_maps_missing_record_to_invalid() {
        let invite = build_public_invite_lookup("DEVJOIN2026".to_owned(), None).unwrap();

        assert_eq!(invite.status, PublicInviteStatus::Invalid);
        assert_eq!(invite.invite_code, "DEVJOIN2026");
        assert!(invite.guild.is_none());
        assert!(invite.uses.is_none());
    }

    #[test]
    fn build_public_invite_lookup_preserves_expired_record_details() {
        let invite = build_public_invite_lookup(
            "DEVJOIN2026".to_owned(),
            Some(InviteRecord {
                invite_code: "DEVJOIN2026".to_owned(),
                status: PublicInviteStatus::Expired,
                guild: sample_guild(),
                expires_at: Some("2026-03-07T00:00:00Z".to_owned()),
                uses: 10,
                max_uses: Some(10),
            }),
        )
        .unwrap();

        assert_eq!(invite.status, PublicInviteStatus::Expired);
        assert_eq!(invite.guild.unwrap().guild_id, 2001);
        assert_eq!(invite.uses, Some(10));
        assert_eq!(invite.max_uses, Some(10));
    }

    #[test]
    fn verify_public_invite_sql_reads_invite_and_guild_state() {
        let sql = PostgresInviteService::VERIFY_PUBLIC_INVITE_SQL;

        assert!(sql.contains("FROM invites i"));
        assert!(sql.contains("JOIN guilds g"));
        assert!(sql.contains("i.is_disabled"));
        assert!(sql.contains("i.max_uses IS NOT NULL AND i.uses >= i.max_uses"));
        assert!(sql.contains("i.expires_at IS NOT NULL AND i.expires_at < now()"));
    }

    #[test]
    fn verify_public_invite_sql_prioritizes_invalid_over_expired() {
        let sql = PostgresInviteService::VERIFY_PUBLIC_INVITE_SQL;
        let invalid_index = sql
            .find("WHEN i.is_disabled OR (i.max_uses IS NOT NULL AND i.uses >= i.max_uses)")
            .unwrap();
        let expired_index = sql
            .find("WHEN i.expires_at IS NOT NULL AND i.expires_at < now()")
            .unwrap();

        assert!(invalid_index < expired_index);
    }
}
