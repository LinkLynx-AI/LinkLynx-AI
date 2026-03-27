#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        env,
        sync::atomic::{AtomicI64, Ordering},
    };

    use tokio_postgres::NoTls;

    static NEXT_TEST_ID: AtomicI64 = AtomicI64::new(980_000);

    fn next_test_id_block(width: i64) -> i64 {
        NEXT_TEST_ID.fetch_add(width, Ordering::Relaxed)
    }

    fn integration_test_enabled() -> bool {
        env::var("MODERATION_POSTGRES_INTEGRATION")
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
            .expect("MODERATION_POSTGRES_INTEGRATION requires DATABASE_URL to be set");
        let (client, connection) = tokio_postgres::connect(&database_url, NoTls)
            .await
            .expect("failed to connect integration postgres");
        tokio::spawn(async move {
            if let Err(error) = connection.await {
                panic!("moderation integration postgres connection failed: {error}");
            }
        });

        Some((database_url, client))
    }

    async fn seed_user(client: &tokio_postgres::Client, user_id: i64, label: &str) {
        client
            .execute(
                "INSERT INTO users (id, email, display_name, theme)
                 VALUES ($1, $2, $3, 'dark')
                 ON CONFLICT (id)
                 DO UPDATE SET
                   email = EXCLUDED.email,
                   display_name = EXCLUDED.display_name,
                   theme = EXCLUDED.theme",
                &[
                    &user_id,
                    &format!("{label}-{user_id}@example.com"),
                    &format!("{label}-{user_id}"),
                ],
            )
            .await
            .expect("failed to seed user");
    }

    async fn seed_guild(client: &tokio_postgres::Client, guild_id: i64, owner_id: i64) {
        client
            .execute(
                "INSERT INTO guilds (id, name, owner_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (id)
                 DO UPDATE SET
                   name = EXCLUDED.name,
                   owner_id = EXCLUDED.owner_id",
                &[&guild_id, &format!("Guild {guild_id}"), &owner_id],
            )
            .await
            .expect("failed to seed guild");
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

    #[tokio::test]
    async fn ensure_target_member_exists_returns_guild_not_found_for_missing_guild() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };

        let service = PostgresModerationService::new(database_url, true);
        let base_id = next_test_id_block(10);
        let target_user_id = base_id + 1;
        seed_user(&client, target_user_id, "moderation-target").await;

        let result = service
            .ensure_target_member_exists(&client, base_id + 2, target_user_id)
            .await;

        assert!(matches!(
            result,
            Err(ModerationError {
                kind: ModerationErrorKind::NotFound,
                reason,
            }) if reason == "guild_not_found"
        ));
    }

    #[tokio::test]
    async fn ensure_target_member_exists_returns_member_not_found_for_non_member() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };

        let service = PostgresModerationService::new(database_url, true);
        let base_id = next_test_id_block(10);
        let owner_id = base_id;
        let target_user_id = base_id + 1;
        let guild_id = base_id + 2;
        seed_user(&client, owner_id, "moderation-owner").await;
        seed_user(&client, target_user_id, "moderation-target").await;
        seed_guild(&client, guild_id, owner_id).await;

        let result = service
            .ensure_target_member_exists(&client, guild_id, target_user_id)
            .await;

        assert!(matches!(
            result,
            Err(ModerationError {
                kind: ModerationErrorKind::NotFound,
                reason,
            }) if reason == "member_not_found"
        ));
    }
}
