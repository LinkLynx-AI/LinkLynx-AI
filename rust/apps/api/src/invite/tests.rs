#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicI64, Ordering};

    use tokio_postgres::NoTls;

    static NEXT_TEST_ID: AtomicI64 = AtomicI64::new(70_000);

    fn sample_guild() -> PublicInviteGuild {
        PublicInviteGuild {
            guild_id: 2001,
            name: "LinkLynx Developers".to_owned(),
            icon_key: None,
        }
    }

    fn sample_channel() -> InviteChannelSummary {
        InviteChannelSummary {
            channel_id: 3001,
            name: "general".to_owned(),
        }
    }

    fn next_test_id_block(width: i64) -> i64 {
        NEXT_TEST_ID.fetch_add(width, Ordering::Relaxed)
    }

    fn integration_test_enabled() -> bool {
        env::var("INVITE_POSTGRES_INTEGRATION")
            .ok()
            .map(|value| {
                matches!(
                    value.trim().to_ascii_lowercase().as_str(),
                    "1" | "true" | "yes" | "on"
                )
            })
            .unwrap_or(false)
    }

    async fn connect_integration_database() -> Option<(String, tokio_postgres::Client)> {
        if !integration_test_enabled() {
            return None;
        }

        let database_url = env::var("DATABASE_URL")
            .expect("INVITE_POSTGRES_INTEGRATION requires DATABASE_URL to be set");
        let (client, connection) = tokio_postgres::connect(&database_url, NoTls)
            .await
            .expect("failed to connect integration postgres");
        tokio::spawn(async move {
            if let Err(error) = connection.await {
                panic!("invite integration postgres connection failed: {error}");
            }
        });

        Some((database_url, client))
    }

    async fn seed_user(client: &tokio_postgres::Client, user_id: i64, label: &str) {
        client
            .execute(
                "INSERT INTO users (id, email, display_name, theme)
                 VALUES ($1, $2, $3, 'dark')",
                &[
                    &user_id,
                    &format!("{label}-{user_id}@example.com"),
                    &format!("{label}-{user_id}"),
                ],
            )
            .await
            .expect("failed to seed user");
    }

    async fn seed_member_role(client: &tokio_postgres::Client, guild_id: i64) {
        client
            .execute(
                "INSERT INTO guild_roles_v2 (
                    guild_id,
                    role_key,
                    name,
                    priority,
                    allow_view,
                    allow_post,
                    allow_manage,
                    is_system
                 )
                 VALUES ($1, 'member', 'Member', 100, TRUE, TRUE, FALSE, TRUE)",
                &[&guild_id],
            )
            .await
            .expect("failed to seed member role");
    }

    #[test]
    fn invite_error_unavailable_maps_to_service_unavailable() {
        let error = InviteError::dependency_unavailable("postgres_down");

        assert_eq!(error.status_code(), axum::http::StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(error.app_code(), "INVITE_UNAVAILABLE");
    }

    #[test]
    fn invite_error_invalid_maps_to_conflict() {
        let error = InviteError::invalid_invite("invite_invalid");

        assert_eq!(error.status_code(), axum::http::StatusCode::CONFLICT);
        assert_eq!(error.app_code(), "INVITE_INVALID");
    }

    #[test]
    fn invite_error_channel_not_found_maps_to_not_found() {
        let error = InviteError::channel_not_found("invite_channel_not_found");

        assert_eq!(error.status_code(), axum::http::StatusCode::NOT_FOUND);
        assert_eq!(error.app_code(), "CHANNEL_NOT_FOUND");
    }

    #[test]
    fn invite_error_expired_maps_to_conflict() {
        let error = InviteError::expired_invite("invite_expired");

        assert_eq!(error.status_code(), axum::http::StatusCode::CONFLICT);
        assert_eq!(error.app_code(), "INVITE_EXPIRED");
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
    fn normalize_create_invite_input_rejects_non_positive_channel_id() {
        let result = normalize_create_invite_input(CreateInviteInput {
            channel_id: 0,
            max_age_seconds: None,
            max_uses: None,
        });

        assert!(matches!(
            result,
            Err(InviteError {
                kind: InviteErrorKind::Validation,
                ..
            })
        ));
    }

    #[test]
    fn normalize_create_invite_input_rejects_non_positive_limits() {
        let result = normalize_create_invite_input(CreateInviteInput {
            channel_id: 3001,
            max_age_seconds: Some(0),
            max_uses: Some(5),
        });
        assert!(matches!(
            result,
            Err(InviteError {
                kind: InviteErrorKind::Validation,
                ..
            })
        ));

        let result = normalize_create_invite_input(CreateInviteInput {
            channel_id: 3001,
            max_age_seconds: Some(60),
            max_uses: Some(0),
        });
        assert!(matches!(
            result,
            Err(InviteError {
                kind: InviteErrorKind::Validation,
                ..
            })
        ));
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
    fn build_invite_join_result_maps_missing_record_to_invalid_error() {
        let result = build_invite_join_result("DEVJOIN2026".to_owned(), None);

        assert!(matches!(
            result,
            Err(InviteError {
                kind: InviteErrorKind::InvalidInvite,
                ..
            })
        ));
    }

    #[test]
    fn build_invite_join_result_maps_expired_record_to_expired_error() {
        let result = build_invite_join_result(
            "DEVJOIN2026".to_owned(),
            Some(InviteJoinRecord {
                guild_id: 2001,
                decision: InviteJoinDecision::Expired,
            }),
        );

        assert!(matches!(
            result,
            Err(InviteError {
                kind: InviteErrorKind::ExpiredInvite,
                ..
            })
        ));
    }

    #[test]
    fn build_invite_join_result_preserves_already_member_status() {
        let result = build_invite_join_result(
            "DEVJOIN2026".to_owned(),
            Some(InviteJoinRecord {
                guild_id: 2001,
                decision: InviteJoinDecision::AlreadyMember,
            }),
        )
        .unwrap();

        assert_eq!(result.invite_code, "DEVJOIN2026");
        assert_eq!(result.guild_id, 2001);
        assert_eq!(result.status, InviteJoinStatus::AlreadyMember);
    }

    #[test]
    fn build_created_invite_preserves_guild_channel_and_limits() {
        let invite = build_created_invite(
            "  NEWJOIN2026  ".to_owned(),
            CreatedInviteRecord {
                guild: sample_guild(),
                channel: sample_channel(),
                expires_at: Some("2026-03-21T00:00:00Z".to_owned()),
                uses: 0,
                max_uses: Some(5),
            },
        )
        .unwrap();

        assert_eq!(invite.invite_code, "NEWJOIN2026");
        assert_eq!(invite.guild.guild_id, 2001);
        assert_eq!(invite.channel.channel_id, 3001);
        assert_eq!(invite.max_uses, Some(5));
    }

    #[test]
    fn create_invite_sql_inserts_manageable_guild_text_channel_invite() {
        let sql = PostgresInviteService::CREATE_INVITE_SQL;

        assert!(sql.contains("FROM guild_members gm"));
        assert!(sql.contains("JOIN manageable m"));
        assert!(sql.contains("c.type = 'guild_text'"));
        assert!(sql.contains("INSERT INTO invites"));
        assert!(sql.contains("now() + ($5::bigint * interval '1 second')"));
        assert!(sql.contains("ii.invite_code"));
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

    #[test]
    fn join_invite_sql_updates_membership_and_usage_idempotently() {
        let sql = PostgresInviteService::JOIN_INVITE_SQL;

        assert!(sql.contains("FROM invites i"));
        assert!(sql.contains("INSERT INTO guild_members"));
        assert!(sql.contains("INSERT INTO guild_member_roles_v2"));
        assert!(sql.contains("INSERT INTO invite_uses"));
        assert!(sql.contains("UPDATE invites i"));
        assert!(sql.contains("WHEN im.already_member THEN 'already_member'"));
        assert!(sql.contains("AND NOT state.already_used"));
        assert!(sql.contains("FROM member_insert inserted"));
    }

    #[test]
    fn join_invite_sql_prioritizes_already_member_and_invalid_before_expired() {
        let sql = PostgresInviteService::JOIN_INVITE_SQL;
        let already_member_index = sql.find("WHEN im.already_member THEN 'already_member'").unwrap();
        let invalid_index = sql
            .find("WHEN im.is_disabled OR (im.max_uses IS NOT NULL AND im.uses >= im.max_uses) THEN 'invalid'")
            .unwrap();
        let expired_index = sql
            .find("WHEN im.expires_at IS NOT NULL AND im.expires_at < now() THEN 'expired'")
            .unwrap();

        assert!(already_member_index < invalid_index);
        assert!(invalid_index < expired_index);
    }

    #[tokio::test]
    async fn postgres_create_invite_integration_returns_created_invite() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };

        let base_id = next_test_id_block(10);
        let owner_id = base_id;
        let guild_id = base_id + 1;
        let channel_id = base_id + 2;

        seed_user(&client, owner_id, "invite-create-owner").await;
        client
            .execute(
                "INSERT INTO guilds (id, name, owner_id)
                 VALUES ($1, $2, $3)",
                &[&guild_id, &format!("Guild {guild_id}"), &owner_id],
            )
            .await
            .expect("failed to seed guild");
        client
            .execute(
                "INSERT INTO guild_members (guild_id, user_id)
                 VALUES ($1, $2)",
                &[&guild_id, &owner_id],
            )
            .await
            .expect("failed to seed guild membership");
        client
            .execute(
                "INSERT INTO channels (id, type, guild_id, name, created_by)
                 VALUES ($1, 'guild_text', $2, 'general', $3)",
                &[&channel_id, &guild_id, &owner_id],
            )
            .await
            .expect("failed to seed channel");

        let service = PostgresInviteService::new(database_url, true);
        let created = service
            .create_invite(
                PrincipalId(owner_id),
                guild_id,
                CreateInviteInput {
                    channel_id,
                    max_age_seconds: Some(3600),
                    max_uses: Some(5),
                },
            )
            .await
            .expect("invite create should succeed");

        assert_eq!(created.guild.guild_id, guild_id);
        assert_eq!(created.channel.channel_id, channel_id);
        assert_eq!(created.channel.name, "general");
        assert_eq!(created.uses, 0);
        assert_eq!(created.max_uses, Some(5));
        assert_eq!(created.invite_code.len(), 10);

        let row = client
            .query_one(
                "SELECT guild_id, created_by, max_uses, uses
                 FROM invites
                 WHERE code = $1",
                &[&created.invite_code],
            )
            .await
            .expect("failed to read created invite");
        assert_eq!(row.get::<usize, i64>(0), guild_id);
        assert_eq!(row.get::<usize, Option<i64>>(1), Some(owner_id));
        assert_eq!(row.get::<usize, Option<i32>>(2), Some(5));
        assert_eq!(row.get::<usize, i32>(3), 0);
    }

    #[tokio::test]
    async fn postgres_join_invite_integration_maintains_membership_and_usage_idempotently() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };

        let base_id = next_test_id_block(10);
        let owner_id = base_id;
        let member_id = base_id + 1;
        let guild_id = base_id + 2;
        let invite_id = base_id + 3;
        let invite_code = format!("JOININTEGRATION{invite_id}");
        seed_user(&client, owner_id, "invite-owner").await;
        seed_user(&client, member_id, "invite-member").await;
        client
            .execute(
                "INSERT INTO guilds (id, name, owner_id)
                 VALUES ($1, $2, $3)",
                &[&guild_id, &format!("Guild {guild_id}"), &owner_id],
            )
            .await
            .expect("failed to seed guild");
        seed_member_role(&client, guild_id).await;
        client
            .execute(
                "INSERT INTO invites (
                    id,
                    guild_id,
                    created_by,
                    code,
                    expires_at,
                    max_uses,
                    uses,
                    is_disabled
                 )
                 VALUES ($1, $2, $3, $4, now() + interval '7 days', 5, 0, FALSE)",
                &[&invite_id, &guild_id, &owner_id, &invite_code],
            )
            .await
            .expect("failed to seed invite");

        let service = PostgresInviteService::new(database_url, true);
        let first_join = service
            .join_invite(PrincipalId(member_id), invite_code.clone())
            .await
            .expect("first join should succeed");
        assert_eq!(first_join.status, InviteJoinStatus::Joined);

        let member_count = client
            .query_one(
                "SELECT COUNT(*)::bigint
                 FROM guild_members
                 WHERE guild_id = $1
                   AND user_id = $2",
                &[&guild_id, &member_id],
            )
            .await
            .expect("failed to count memberships")
            .get::<usize, i64>(0);
        assert_eq!(member_count, 1);

        let member_role_count = client
            .query_one(
                "SELECT COUNT(*)::bigint
                 FROM guild_member_roles_v2
                 WHERE guild_id = $1
                   AND user_id = $2
                   AND role_key = 'member'",
                &[&guild_id, &member_id],
            )
            .await
            .expect("failed to count member roles")
            .get::<usize, i64>(0);
        assert_eq!(member_role_count, 1);

        let invite_use_count = client
            .query_one(
                "SELECT COUNT(*)::bigint
                 FROM invite_uses
                 WHERE invite_id = $1
                   AND used_by = $2",
                &[&invite_id, &member_id],
            )
            .await
            .expect("failed to count invite uses")
            .get::<usize, i64>(0);
        assert_eq!(invite_use_count, 1);

        let invite_uses_after_first_join = client
            .query_one("SELECT uses FROM invites WHERE id = $1", &[&invite_id])
            .await
            .expect("failed to fetch invite uses")
            .get::<usize, i32>(0);
        assert_eq!(invite_uses_after_first_join, 1);

        let second_join = service
            .join_invite(PrincipalId(member_id), invite_code.clone())
            .await
            .expect("second join should be idempotent");
        assert_eq!(second_join.status, InviteJoinStatus::AlreadyMember);

        let invite_uses_after_second_join = client
            .query_one("SELECT uses FROM invites WHERE id = $1", &[&invite_id])
            .await
            .expect("failed to fetch invite uses after second join")
            .get::<usize, i32>(0);
        assert_eq!(invite_uses_after_second_join, 1);

        client
            .execute("UPDATE invites SET is_disabled = TRUE WHERE id = $1", &[&invite_id])
            .await
            .expect("failed to disable invite");
        let disabled_join = service
            .join_invite(PrincipalId(member_id), invite_code.clone())
            .await
            .expect("existing member should still resolve successfully for disabled invite");
        assert_eq!(disabled_join.status, InviteJoinStatus::AlreadyMember);

        client
            .execute(
                "UPDATE invites
                 SET is_disabled = FALSE,
                     expires_at = now() - interval '1 day'
                 WHERE id = $1",
                &[&invite_id],
            )
            .await
            .expect("failed to expire invite");
        let expired_join = service
            .join_invite(PrincipalId(member_id), invite_code)
            .await
            .expect("existing member should still resolve successfully for expired invite");
        assert_eq!(expired_join.status, InviteJoinStatus::AlreadyMember);
    }

    #[tokio::test]
    async fn postgres_join_invite_integration_rejects_expired_and_disabled_non_members() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };

        let base_id = next_test_id_block(20);
        let owner_id = base_id;
        let expired_member_id = base_id + 1;
        let disabled_member_id = base_id + 2;
        let guild_id = base_id + 3;
        let expired_invite_id = base_id + 4;
        let disabled_invite_id = base_id + 5;
        let expired_invite_code = format!("EXPIREDINTEGRATION{expired_invite_id}");
        let disabled_invite_code = format!("DISABLEDINTEGRATION{disabled_invite_id}");

        seed_user(&client, owner_id, "invite-owner").await;
        seed_user(&client, expired_member_id, "invite-expired-member").await;
        seed_user(&client, disabled_member_id, "invite-disabled-member").await;
        client
            .execute(
                "INSERT INTO guilds (id, name, owner_id)
                 VALUES ($1, $2, $3)",
                &[&guild_id, &format!("Guild {guild_id}"), &owner_id],
            )
            .await
            .expect("failed to seed guild");
        seed_member_role(&client, guild_id).await;
        client
            .execute(
                "INSERT INTO invites (
                    id,
                    guild_id,
                    created_by,
                    code,
                    expires_at,
                    max_uses,
                    uses,
                    is_disabled
                 )
                 VALUES
                    ($1, $2, $3, $4, now() - interval '1 day', 5, 0, FALSE),
                    ($5, $2, $3, $6, now() + interval '7 days', 5, 0, TRUE)",
                &[
                    &expired_invite_id,
                    &guild_id,
                    &owner_id,
                    &expired_invite_code,
                    &disabled_invite_id,
                    &disabled_invite_code,
                ],
            )
            .await
            .expect("failed to seed invalid invites");

        let service = PostgresInviteService::new(database_url, true);
        let expired_error = service
            .join_invite(PrincipalId(expired_member_id), expired_invite_code)
            .await
            .expect_err("expired invite should reject non-member");
        assert_eq!(expired_error.kind, InviteErrorKind::ExpiredInvite);

        let disabled_error = service
            .join_invite(PrincipalId(disabled_member_id), disabled_invite_code)
            .await
            .expect_err("disabled invite should reject non-member");
        assert_eq!(disabled_error.kind, InviteErrorKind::InvalidInvite);
    }
}
