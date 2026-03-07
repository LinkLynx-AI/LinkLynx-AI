#[cfg(test)]
mod tests {
    use super::*;
    use crate::ratelimit::RestRateLimitConfig;
    use async_trait::async_trait;
    use std::collections::HashSet;
    use auth::{
        CachingPrincipalResolver, InMemoryPrincipalCache, InMemoryPrincipalStore,
        PrincipalProvisioner, PrincipalResolver, PrincipalStore, TokenVerifier, TokenVerifyError,
        VerifiedToken,
    };
    use authz::{
        Authorizer, AuthzAction, AuthzCheckInput, AuthzError, AuthzErrorKind, AuthzResource,
    };
    use futures_util::{SinkExt, StreamExt};
    use guild_channel::{
        ChannelPatchInput, ChannelSummary, CreatedChannel, CreatedGuild, GuildChannelError,
        GuildPatchInput, GuildSummary,
        GuildChannelService,
    };
    use invite::{
        InviteError, InviteService, PublicInviteGuild, PublicInviteLookup, PublicInviteStatus,
    };
    use moderation::{
        CreateModerationMuteInput, CreateModerationReportInput, ModerationError, ModerationReport,
        ModerationReportStatus, ModerationService, ModerationTargetType,
    };
    use profile::{ProfileError, ProfilePatchInput, ProfileService, ProfileSettings};
    use axum::{
        body::to_bytes,
        http::{
            header::{AUTHORIZATION, ORIGIN, RETRY_AFTER},
            Method, StatusCode,
        },
    };
    use linklynx_shared::PrincipalId;
    use tokio::{
        net::{TcpListener, TcpStream},
        task::JoinHandle,
        time::timeout,
    };
    use tokio_tungstenite::{
        connect_async,
        tungstenite::{
            client::IntoClientRequest,
            protocol::frame::coding::CloseCode,
            Message as WsClientMessage,
        },
        MaybeTlsStream, WebSocketStream,
    };
    use tower::ServiceExt;

    const MAX_RESPONSE_BYTES: usize = 16 * 1024;

    struct StaticTokenVerifier;
    struct StaticAllowAllAuthorizer;
    struct StaticDenyAuthorizer;
    struct StaticUnavailableAuthorizer;
    struct WsTextDeniedAuthorizer;
    struct WsTextUnavailableAuthorizer;
    struct StaticGuildChannelService;
    struct StaticModerationService;
    struct StaticProfileService;
    struct StaticUnavailableProfileService;
    struct StaticInviteService;
    struct StaticUnavailableInviteService;
    struct RoleScenarioAuthorizer;

    type TestWsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

    #[async_trait]
    impl TokenVerifier for StaticTokenVerifier {
        async fn verify(&self, token: &str) -> Result<VerifiedToken, TokenVerifyError> {
            let Some((uid, exp)) = token.split_once(':') else {
                return Err(TokenVerifyError::Invalid("token_format_invalid"));
            };

            let exp = exp
                .parse::<u64>()
                .map_err(|_| TokenVerifyError::Invalid("token_exp_invalid"))?;

            if exp <= unix_timestamp_seconds() {
                return Err(TokenVerifyError::Expired);
            }

            Ok(VerifiedToken {
                uid: uid.to_owned(),
                email: Some(format!("{uid}@example.com")),
                email_verified: true,
                display_name: Some(uid.to_owned()),
                expires_at_epoch: exp,
            })
        }
    }

    #[async_trait]
    impl Authorizer for StaticAllowAllAuthorizer {
        async fn check(&self, _input: &AuthzCheckInput) -> Result<(), AuthzError> {
            Ok(())
        }
    }

    #[async_trait]
    impl Authorizer for StaticDenyAuthorizer {
        async fn check(&self, _input: &AuthzCheckInput) -> Result<(), AuthzError> {
            Err(AuthzError::denied("test_authz_denied"))
        }
    }

    #[async_trait]
    impl Authorizer for StaticUnavailableAuthorizer {
        async fn check(&self, _input: &AuthzCheckInput) -> Result<(), AuthzError> {
            Err(AuthzError::unavailable("test_authz_unavailable"))
        }
    }

    #[async_trait]
    impl Authorizer for WsTextDeniedAuthorizer {
        async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
            match (&input.resource, input.action) {
                (AuthzResource::Session, AuthzAction::Connect) => Ok(()),
                (AuthzResource::RestPath { path }, AuthzAction::View) if path == "/ws/stream" => {
                    Err(AuthzError::denied("ws_text_denied"))
                }
                _ => Ok(()),
            }
        }
    }

    #[async_trait]
    impl Authorizer for WsTextUnavailableAuthorizer {
        async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
            match (&input.resource, input.action) {
                (AuthzResource::Session, AuthzAction::Connect) => Ok(()),
                (AuthzResource::RestPath { path }, AuthzAction::View) if path == "/ws/stream" => {
                    Err(AuthzError::unavailable("ws_text_unavailable"))
                }
                _ => Ok(()),
            }
        }
    }

    #[async_trait]
    impl Authorizer for RoleScenarioAuthorizer {
        async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
            match (&input.resource, input.action) {
                (AuthzResource::Guild { .. }, AuthzAction::Manage) => {
                    if input.principal_id.0 == 9001 || input.principal_id.0 == 9002 {
                        Ok(())
                    } else {
                        Err(AuthzError::denied("guild_manage_denied"))
                    }
                }
                (AuthzResource::Guild { .. }, AuthzAction::View) => {
                    if input.principal_id.0 == 9001
                        || input.principal_id.0 == 9002
                        || input.principal_id.0 == 9003
                    {
                        Ok(())
                    } else {
                        Err(AuthzError::denied("guild_view_denied"))
                    }
                }
                (AuthzResource::GuildChannel { .. }, AuthzAction::View | AuthzAction::Post) => {
                    if input.principal_id.0 == 9001
                        || input.principal_id.0 == 9002
                        || input.principal_id.0 == 9003
                    {
                        Ok(())
                    } else {
                        Err(AuthzError::denied("guild_channel_access_denied"))
                    }
                }
                (AuthzResource::Channel { .. }, AuthzAction::View | AuthzAction::Post) => {
                    if input.principal_id.0 == 9001
                        || input.principal_id.0 == 9002
                        || input.principal_id.0 == 9003
                    {
                        Ok(())
                    } else {
                        Err(AuthzError::denied("dm_channel_access_denied"))
                    }
                }
                _ => Err(AuthzError::denied("unsupported_role_scenario")),
            }
        }
    }

    #[async_trait]
    impl GuildChannelService for StaticGuildChannelService {
        async fn list_guilds(
            &self,
            principal_id: PrincipalId,
        ) -> Result<Vec<GuildSummary>, GuildChannelError> {
            if principal_id.0 != 1001 {
                return Ok(vec![]);
            }

            Ok(vec![GuildSummary {
                guild_id: 2001,
                name: "LinkLynx Developers".to_owned(),
                icon_key: None,
                joined_at: "2026-03-03T00:00:00Z".to_owned(),
            }])
        }

        async fn create_guild(
            &self,
            principal_id: PrincipalId,
            name: String,
        ) -> Result<CreatedGuild, GuildChannelError> {
            let normalized = name.trim();
            if normalized.is_empty() {
                return Err(GuildChannelError::validation("guild_name_required"));
            }

            Ok(CreatedGuild {
                guild_id: 2002,
                name: normalized.to_owned(),
                icon_key: None,
                owner_id: principal_id.0,
            })
        }

        async fn update_guild(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            patch: GuildPatchInput,
        ) -> Result<CreatedGuild, GuildChannelError> {
            if guild_id != 2001 {
                return Err(GuildChannelError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(GuildChannelError::forbidden("guild_manage_permission_required"));
            }
            if patch.is_empty() {
                return Err(GuildChannelError::validation("guild_patch_empty"));
            }

            let mut guild = CreatedGuild {
                guild_id,
                name: "LinkLynx Developers".to_owned(),
                icon_key: Some("icons/original.png".to_owned()),
                owner_id: 1001,
            };

            if let Some(name) = patch.name {
                let normalized = name.trim();
                if normalized.is_empty() {
                    return Err(GuildChannelError::validation("guild_name_required"));
                }
                if normalized.chars().count() > 100 {
                    return Err(GuildChannelError::validation("guild_name_too_long"));
                }
                guild.name = normalized.to_owned();
            }

            if let Some(icon_key) = patch.icon_key {
                guild.icon_key = icon_key.and_then(|value| {
                    let normalized = value.trim().to_owned();
                    if normalized.is_empty() {
                        None
                    } else {
                        Some(normalized)
                    }
                });
            }

            Ok(guild)
        }

        async fn delete_guild(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
        ) -> Result<(), GuildChannelError> {
            if guild_id != 2001 {
                return Err(GuildChannelError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(GuildChannelError::forbidden("guild_manage_permission_required"));
            }

            Ok(())
        }

        async fn list_guild_channels(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
        ) -> Result<Vec<ChannelSummary>, GuildChannelError> {
            if guild_id != 2001 {
                return Err(GuildChannelError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(GuildChannelError::forbidden("guild_membership_required"));
            }

            Ok(vec![
                ChannelSummary {
                    channel_id: 3001,
                    guild_id,
                    name: "general".to_owned(),
                    created_at: "2026-03-03T00:00:00Z".to_owned(),
                },
                ChannelSummary {
                    channel_id: 3002,
                    guild_id,
                    name: "random".to_owned(),
                    created_at: "2026-03-03T00:00:30Z".to_owned(),
                },
            ])
        }

        async fn create_guild_channel(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            name: String,
        ) -> Result<CreatedChannel, GuildChannelError> {
            if guild_id != 2001 {
                return Err(GuildChannelError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(GuildChannelError::forbidden("guild_membership_required"));
            }

            let normalized = name.trim();
            if normalized.is_empty() {
                return Err(GuildChannelError::validation("channel_name_required"));
            }

            Ok(CreatedChannel {
                channel_id: 3003,
                guild_id,
                name: normalized.to_owned(),
                created_at: "2026-03-03T00:01:00Z".to_owned(),
            })
        }

        async fn update_guild_channel(
            &self,
            principal_id: PrincipalId,
            channel_id: i64,
            patch: ChannelPatchInput,
        ) -> Result<ChannelSummary, GuildChannelError> {
            if channel_id != 3001 {
                return Err(GuildChannelError::channel_not_found("channel_not_found"));
            }
            if principal_id.0 == 1003 {
                return Err(GuildChannelError::forbidden("channel_manage_permission_required"));
            }
            if principal_id.0 != 1001 {
                return Err(GuildChannelError::forbidden("guild_membership_required"));
            }

            let normalized = patch.name.trim();
            if normalized.is_empty() {
                return Err(GuildChannelError::validation("channel_name_required"));
            }
            if normalized.chars().count() > 100 {
                return Err(GuildChannelError::validation("channel_name_too_long"));
            }

            Ok(ChannelSummary {
                channel_id,
                guild_id: 2001,
                name: normalized.to_owned(),
                created_at: "2026-03-03T00:00:00Z".to_owned(),
            })
        }

        async fn delete_guild_channel(
            &self,
            principal_id: PrincipalId,
            channel_id: i64,
        ) -> Result<(), GuildChannelError> {
            if channel_id != 3001 {
                return Err(GuildChannelError::channel_not_found("channel_not_found"));
            }
            if principal_id.0 == 1003 {
                return Err(GuildChannelError::forbidden("channel_manage_permission_required"));
            }
            if principal_id.0 != 1001 {
                return Err(GuildChannelError::forbidden("guild_membership_required"));
            }

            Ok(())
        }
    }

    #[async_trait]
    impl ProfileService for StaticProfileService {
        async fn get_profile(&self, principal_id: PrincipalId) -> Result<ProfileSettings, ProfileError> {
            if principal_id.0 != 1001 {
                return Err(ProfileError::not_found("user_not_found"));
            }

            Ok(ProfileSettings {
                display_name: "Alice".to_owned(),
                status_text: Some("Ready".to_owned()),
                avatar_key: Some("avatars/alice.png".to_owned()),
            })
        }

        async fn update_profile(
            &self,
            principal_id: PrincipalId,
            patch: ProfilePatchInput,
        ) -> Result<ProfileSettings, ProfileError> {
            if principal_id.0 != 1001 {
                return Err(ProfileError::not_found("user_not_found"));
            }

            if patch.is_empty() {
                return Err(ProfileError::validation("profile_patch_empty"));
            }

            let mut profile = ProfileSettings {
                display_name: "Alice".to_owned(),
                status_text: Some("Ready".to_owned()),
                avatar_key: Some("avatars/alice.png".to_owned()),
            };

            if let Some(display_name) = patch.display_name {
                let normalized = display_name.trim();
                if normalized.is_empty() || normalized.chars().count() > 32 {
                    return Err(ProfileError::validation("display_name_invalid"));
                }
                profile.display_name = normalized.to_owned();
            }

            if let Some(status_text) = patch.status_text {
                profile.status_text = status_text.and_then(|value| {
                    let trimmed = value.trim().to_owned();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some(trimmed)
                    }
                });
            }

            if let Some(avatar_key) = patch.avatar_key {
                let normalized = avatar_key.and_then(|value| {
                    let trimmed = value.trim().to_owned();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some(trimmed)
                    }
                });

                if let Some(value) = &normalized {
                    let valid_format = value.bytes().all(|byte| {
                        byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'_' | b'-' | b'.')
                    });
                    if !valid_format {
                        return Err(ProfileError::validation("avatar_key_invalid_format"));
                    }
                }

                profile.avatar_key = normalized;
            }

            Ok(profile)
        }
    }

    #[async_trait]
    impl ProfileService for StaticUnavailableProfileService {
        async fn get_profile(
            &self,
            _principal_id: PrincipalId,
        ) -> Result<ProfileSettings, ProfileError> {
            Err(ProfileError::dependency_unavailable(
                "profile_store_temporarily_unavailable",
            ))
        }

        async fn update_profile(
            &self,
            _principal_id: PrincipalId,
            _patch: ProfilePatchInput,
        ) -> Result<ProfileSettings, ProfileError> {
            Err(ProfileError::dependency_unavailable(
                "profile_store_temporarily_unavailable",
            ))
        }
    }

    #[async_trait]
    impl ModerationService for StaticModerationService {
        async fn create_report(
            &self,
            principal_id: PrincipalId,
            input: CreateModerationReportInput,
        ) -> Result<ModerationReport, ModerationError> {
            if input.guild_id != 2001 {
                return Err(ModerationError::not_found("guild_not_found"));
            }
            if input.target_id <= 0 {
                return Err(ModerationError::validation("target_id_must_be_positive"));
            }
            let reason = input.reason.trim();
            if reason.is_empty() {
                return Err(ModerationError::validation("report_reason_required"));
            }

            Ok(ModerationReport {
                report_id: 4001,
                guild_id: 2001,
                reporter_id: principal_id.0,
                target_type: input.target_type,
                target_id: input.target_id,
                reason: reason.to_owned(),
                status: ModerationReportStatus::Open,
                resolved_by: None,
                resolved_at: None,
                created_at: "2026-03-05T00:00:00Z".to_owned(),
                updated_at: "2026-03-05T00:00:00Z".to_owned(),
            })
        }

        async fn create_mute(
            &self,
            principal_id: PrincipalId,
            input: CreateModerationMuteInput,
        ) -> Result<moderation::ModerationMute, ModerationError> {
            if input.guild_id != 2001 {
                return Err(ModerationError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(ModerationError::forbidden("moderation_role_required"));
            }
            if input.target_user_id <= 0 {
                return Err(ModerationError::validation("target_user_id_must_be_positive"));
            }
            let reason = input.reason.trim();
            if reason.is_empty() {
                return Err(ModerationError::validation("mute_reason_required"));
            }

            Ok(moderation::ModerationMute {
                mute_id: 5001,
                guild_id: 2001,
                target_user_id: input.target_user_id,
                reason: reason.to_owned(),
                created_by: principal_id.0,
                expires_at: input.expires_at,
                created_at: "2026-03-05T00:00:00Z".to_owned(),
            })
        }

        async fn list_reports(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
        ) -> Result<Vec<ModerationReport>, ModerationError> {
            if guild_id != 2001 {
                return Err(ModerationError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(ModerationError::forbidden("moderation_role_required"));
            }

            Ok(vec![ModerationReport {
                report_id: 4001,
                guild_id,
                reporter_id: 1002,
                target_type: ModerationTargetType::Message,
                target_id: 9001,
                reason: "spam".to_owned(),
                status: ModerationReportStatus::Open,
                resolved_by: None,
                resolved_at: None,
                created_at: "2026-03-05T00:00:00Z".to_owned(),
                updated_at: "2026-03-05T00:00:00Z".to_owned(),
            }])
        }

        async fn get_report(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            report_id: i64,
        ) -> Result<ModerationReport, ModerationError> {
            if guild_id != 2001 {
                return Err(ModerationError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(ModerationError::forbidden("moderation_role_required"));
            }
            if report_id != 4001 {
                return Err(ModerationError::not_found("report_not_found"));
            }

            Ok(ModerationReport {
                report_id,
                guild_id,
                reporter_id: 1002,
                target_type: ModerationTargetType::Message,
                target_id: 9001,
                reason: "spam".to_owned(),
                status: ModerationReportStatus::Open,
                resolved_by: None,
                resolved_at: None,
                created_at: "2026-03-05T00:00:00Z".to_owned(),
                updated_at: "2026-03-05T00:00:00Z".to_owned(),
            })
        }

        async fn resolve_report(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            report_id: i64,
        ) -> Result<ModerationReport, ModerationError> {
            if guild_id != 2001 {
                return Err(ModerationError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(ModerationError::forbidden("moderation_role_required"));
            }
            if report_id != 4001 {
                return Err(ModerationError::not_found("report_not_found"));
            }

            Ok(ModerationReport {
                report_id,
                guild_id,
                reporter_id: 1002,
                target_type: ModerationTargetType::Message,
                target_id: 9001,
                reason: "spam".to_owned(),
                status: ModerationReportStatus::Resolved,
                resolved_by: Some(principal_id.0),
                resolved_at: Some("2026-03-05T00:01:00Z".to_owned()),
                created_at: "2026-03-05T00:00:00Z".to_owned(),
                updated_at: "2026-03-05T00:01:00Z".to_owned(),
            })
        }

        async fn reopen_report(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            report_id: i64,
        ) -> Result<ModerationReport, ModerationError> {
            if guild_id != 2001 {
                return Err(ModerationError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(ModerationError::forbidden("moderation_role_required"));
            }
            if report_id != 4001 {
                return Err(ModerationError::not_found("report_not_found"));
            }

            Ok(ModerationReport {
                report_id,
                guild_id,
                reporter_id: 1002,
                target_type: ModerationTargetType::Message,
                target_id: 9001,
                reason: "spam".to_owned(),
                status: ModerationReportStatus::Open,
                resolved_by: None,
                resolved_at: None,
                created_at: "2026-03-05T00:00:00Z".to_owned(),
                updated_at: "2026-03-05T00:02:00Z".to_owned(),
            })
        }
    }

    #[async_trait]
    impl InviteService for StaticInviteService {
        async fn verify_public_invite(
            &self,
            invite_code: String,
        ) -> Result<PublicInviteLookup, InviteError> {
            let normalized_invite_code = invite_code.trim().to_owned();
            if normalized_invite_code.is_empty() {
                return Err(InviteError::validation("invite_code_required"));
            }

            let guild = PublicInviteGuild {
                guild_id: 2001,
                name: "LinkLynx Developers".to_owned(),
                icon_key: None,
            };

            match normalized_invite_code.as_str() {
                "DEVJOIN2026" => Ok(PublicInviteLookup {
                    status: PublicInviteStatus::Valid,
                    invite_code: normalized_invite_code,
                    guild: Some(guild),
                    expires_at: Some("2026-03-21T00:00:00Z".to_owned()),
                    uses: Some(2),
                    max_uses: Some(100),
                }),
                "EXPIRED2026" => Ok(PublicInviteLookup {
                    status: PublicInviteStatus::Expired,
                    invite_code: normalized_invite_code,
                    guild: Some(guild),
                    expires_at: Some("2026-03-01T00:00:00Z".to_owned()),
                    uses: Some(10),
                    max_uses: Some(10),
                }),
                "DISABLED2026" => Ok(PublicInviteLookup {
                    status: PublicInviteStatus::Invalid,
                    invite_code: normalized_invite_code,
                    guild: Some(guild),
                    expires_at: Some("2026-03-21T00:00:00Z".to_owned()),
                    uses: Some(3),
                    max_uses: Some(10),
                }),
                _ => Ok(PublicInviteLookup {
                    status: PublicInviteStatus::Invalid,
                    invite_code: normalized_invite_code,
                    guild: None,
                    expires_at: None,
                    uses: None,
                    max_uses: None,
                }),
            }
        }
    }

    #[async_trait]
    impl InviteService for StaticUnavailableInviteService {
        async fn verify_public_invite(
            &self,
            _invite_code: String,
        ) -> Result<PublicInviteLookup, InviteError> {
            Err(InviteError::dependency_unavailable(
                "invite_store_unconfigured",
            ))
        }
    }

    async fn app_for_test() -> Router {
        let state = state_for_test_with_services(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticProfileService),
            Arc::new(StaticInviteService),
        )
        .await;
        app_with_state(state)
    }

    async fn app_for_test_with_authorizer(authorizer: Arc<dyn Authorizer>) -> Router {
        let state = state_for_test_with_services(
            authorizer,
            Arc::new(StaticProfileService),
            Arc::new(StaticInviteService),
        )
        .await;
        app_with_state(state)
    }

    async fn state_for_test_with_authorizer(authorizer: Arc<dyn Authorizer>) -> AppState {
        state_for_test_with_services(
            authorizer,
            Arc::new(StaticProfileService),
            Arc::new(StaticInviteService),
        )
        .await
    }

    async fn state_for_test_with_services(
        authorizer: Arc<dyn Authorizer>,
        profile_service: Arc<dyn ProfileService>,
        invite_service: Arc<dyn InviteService>,
    ) -> AppState {
        let metrics = Arc::new(AuthMetrics::default());
        let verifier: Arc<dyn TokenVerifier> = Arc::new(StaticTokenVerifier);

        let store = Arc::new(InMemoryPrincipalStore::default());
        store.insert("firebase", "u-1", PrincipalId(1001)).await;
        store.insert("firebase", "u-3", PrincipalId(1003)).await;
        store.insert("firebase", "u-owner", PrincipalId(9001)).await;
        store.insert("firebase", "u-admin", PrincipalId(9002)).await;
        store.insert("firebase", "u-member", PrincipalId(9003)).await;
        let store_resolver: Arc<dyn PrincipalStore> = store.clone();
        let provisioner: Arc<dyn PrincipalProvisioner> = store.clone();

        let resolver: Arc<dyn PrincipalResolver> = Arc::new(CachingPrincipalResolver::new(
            "firebase".to_owned(),
            Arc::new(InMemoryPrincipalCache::default()),
            store_resolver,
            provisioner,
            Duration::from_secs(120),
            Arc::clone(&metrics),
        ));

        let auth_service = Arc::new(AuthService::new(verifier, resolver, metrics));
        AppState {
            auth_service,
            authorizer,
            authz_metrics: Arc::new(AuthzMetrics::default()),
            guild_channel_service: Arc::new(StaticGuildChannelService),
            invite_service,
            moderation_service: Arc::new(StaticModerationService),
            profile_service,
            ws_reauth_grace: Duration::from_secs(30),
            ws_ticket_ttl: Duration::from_secs(60),
            auth_identify_timeout: Duration::from_secs(5),
            ws_ticket_store: Arc::new(WsTicketStore::default()),
            ws_ticket_rate_limiter: Arc::new(FixedWindowRateLimiter::new(
                20,
                Duration::from_secs(60),
            )),
            ws_identify_rate_limiter: Arc::new(FixedWindowRateLimiter::new(
                60,
                Duration::from_secs(60),
            )),
            ws_origin_allowlist: Arc::new(WsOriginAllowlist::new(HashSet::from([
                "http://localhost:3000".to_owned(),
                "http://127.0.0.1:3000".to_owned(),
            ]))),
            rest_rate_limit_service: Arc::new(RestRateLimitService::new(
                RestRateLimitConfig::default(),
            )),
        }
    }

    async fn app_for_test_with_authorizer_and_profile(
        authorizer: Arc<dyn Authorizer>,
        profile_service: Arc<dyn ProfileService>,
    ) -> Router {
        let state =
            state_for_test_with_services(authorizer, profile_service, Arc::new(StaticInviteService))
                .await;
        app_with_state(state)
    }

    async fn app_for_test_with_invite_service(invite_service: Arc<dyn InviteService>) -> Router {
        let state = state_for_test_with_services(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticProfileService),
            invite_service,
        )
        .await;
        app_with_state(state)
    }

    async fn connect_test_ws(authorizer: Arc<dyn Authorizer>) -> (TestWsStream, JoinHandle<()>) {
        let app = app_for_test_with_authorizer(authorizer).await;
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let mut request = format!("ws://{address}/ws").into_client_request().unwrap();
        request
            .headers_mut()
            .insert(ORIGIN, "http://localhost:3000".parse().unwrap());
        request.headers_mut().insert(
            AUTHORIZATION,
            format!("Bearer {token}").parse().unwrap(),
        );

        let (socket, _) = connect_async(request).await.unwrap();
        (socket, server)
    }

    async fn parse_principal_id_from_response(response: Response) -> i64 {
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        json["principal_id"].as_i64().unwrap()
    }

    #[tokio::test]
    async fn root_returns_server_name() {
        let app = app_for_test().await;
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        assert_eq!(body.as_ref(), b"LinkLynx API Server");
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        assert_eq!(body.as_ref(), b"OK");
    }

    #[tokio::test]
    async fn public_invite_endpoint_is_available_without_authentication() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/invites/DEVJOIN2026")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["invite"]["status"], "valid");
        assert_eq!(json["invite"]["guild"]["guild_id"], 2001);
    }

    #[tokio::test]
    async fn public_invite_endpoint_returns_expired_status() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/invites/EXPIRED2026")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["invite"]["status"], "expired");
    }

    #[tokio::test]
    async fn public_invite_endpoint_returns_invalid_status_for_missing_code() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/invites/UNKNOWN2026")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["invite"]["status"], "invalid");
        assert!(json["invite"]["guild"].is_null());
    }

    #[tokio::test]
    async fn public_invite_endpoint_returns_service_unavailable_when_invite_service_fails() {
        let app = app_for_test_with_invite_service(Arc::new(StaticUnavailableInviteService)).await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/invites/DEVJOIN2026")
                    .header("x-request-id", "invite-unavailable-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "INVITE_UNAVAILABLE");
        assert_eq!(json["request_id"], "invite-unavailable-test");
    }

    #[tokio::test]
    async fn public_invite_endpoint_returns_retry_after_when_rate_limited() {
        let app = app_for_test().await;
        let mut last_response = None;

        for _ in 0..11 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .uri("/v1/invites/DEVJOIN2026")
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap(),
            );
        }

        let response = last_response.unwrap();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            response
                .headers()
                .get(RETRY_AFTER)
                .and_then(|value| value.to_str().ok()),
            Some("60")
        );
    }

    #[tokio::test]
    async fn public_invite_endpoint_ignores_spoofed_forwarded_for_headers_for_rate_limit() {
        let app = app_for_test().await;
        let mut last_response = None;

        for index in 0..11 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .uri(format!("/v1/invites/SPOOFED{index}"))
                            .header("x-forwarded-for", format!("203.0.113.{index}"))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap(),
            );
        }

        let response = last_response.unwrap();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[tokio::test]
    async fn public_invite_endpoint_rate_limits_across_codes_without_headers() {
        let app = app_for_test().await;
        let mut last_response = None;

        for index in 0..11 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .uri(format!("/v1/invites/CODE{index}"))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap(),
            );
        }

        let response = last_response.unwrap();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[tokio::test]
    async fn public_invite_endpoint_fail_closes_when_ratelimit_degraded() {
        let state = state_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        state.rest_rate_limit_service.set_degraded_for_test(true).await;
        let app = app_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/invites/DEVJOIN2026")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            response
                .headers()
                .get(RETRY_AFTER)
                .and_then(|value| value.to_str().ok()),
            Some("60")
        );
    }

    #[tokio::test]
    async fn protected_endpoint_rejects_missing_token() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn auth_metrics_endpoint_rejects_missing_token() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/auth/metrics")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn auth_metrics_endpoint_rejects_invalid_token() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/auth/metrics")
                    .header("authorization", "Bearer invalid-token")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn auth_metrics_endpoint_rejects_expired_token() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds().saturating_sub(1));
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/auth/metrics")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn auth_metrics_endpoint_accepts_valid_token() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/auth/metrics")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert!(json.get("token_verify_success_total").is_some());
        assert!(json.get("principal_cache_hit_ratio").is_some());
    }

    #[tokio::test]
    async fn internal_authz_metrics_endpoint_rejects_missing_token() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn internal_authz_metrics_endpoint_accepts_valid_token() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert!(json.get("allow_total").is_some());
        assert!(json.get("deny_total").is_some());
        assert!(json.get("unavailable_total").is_some());
    }

    #[tokio::test]
    async fn internal_authz_metrics_endpoint_returns_forbidden_when_authz_denied() {
        let app = app_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "internal-authz-metrics-denied")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
        assert_eq!(json["request_id"], "internal-authz-metrics-denied");
    }

    #[tokio::test]
    async fn internal_authz_metrics_endpoint_returns_unavailable_when_authz_unavailable() {
        let app = app_for_test_with_authorizer(Arc::new(StaticUnavailableAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "internal-authz-metrics-unavailable")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_UNAVAILABLE");
        assert_eq!(json["request_id"], "internal-authz-metrics-unavailable");
    }

    #[tokio::test]
    async fn ws_stream_access_denies_when_authorizer_denies() {
        let state = state_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let authenticated = AuthenticatedPrincipal {
            principal_id: PrincipalId(9003),
            firebase_uid: "u-member".to_owned(),
            expires_at_epoch: unix_timestamp_seconds() + 300,
        };

        let error = authorize_ws_stream_access(&state, &authenticated, "ws-test")
            .await
            .unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::Denied);
    }

    #[tokio::test]
    async fn ws_stream_access_allows_when_authorizer_allows() {
        let state = state_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        let authenticated = AuthenticatedPrincipal {
            principal_id: PrincipalId(9001),
            firebase_uid: "u-owner".to_owned(),
            expires_at_epoch: unix_timestamp_seconds() + 300,
        };

        assert!(authorize_ws_stream_access(&state, &authenticated, "ws-test")
            .await
            .is_ok());
    }

    #[tokio::test]
    async fn protected_endpoint_accepts_valid_token() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "test-req-id")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();

        assert_eq!(json["ok"], true);
        assert_eq!(json["request_id"], "test-req-id");
        assert_eq!(json["principal_id"], 1001);
        assert_eq!(json["firebase_uid"], "u-1");
    }

    #[tokio::test]
    async fn protected_endpoint_provisions_missing_mapping() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let first_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(first_response.status(), StatusCode::OK);
        let first_principal_id = parse_principal_id_from_response(first_response).await;

        let second_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(second_response.status(), StatusCode::OK);
        let second_principal_id = parse_principal_id_from_response(second_response).await;

        assert_eq!(first_principal_id, second_principal_id);
    }

    #[tokio::test]
    async fn protected_endpoint_concurrent_retry_reuses_same_principal() {
        let app = app_for_test().await;
        let token = format!("u-concurrent:{}", unix_timestamp_seconds() + 300);

        let mut handles = Vec::new();
        for _ in 0..6 {
            let app_clone = app.clone();
            let token_clone = token.clone();
            handles.push(tokio::spawn(async move {
                app_clone
                    .oneshot(
                        Request::builder()
                            .uri("/protected/ping")
                            .header("authorization", format!("Bearer {token_clone}"))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap()
            }));
        }

        let mut principal_ids = Vec::new();
        for handle in handles {
            let response = handle.await.unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            principal_ids.push(parse_principal_id_from_response(response).await);
        }

        let expected = principal_ids.first().copied().unwrap();
        assert!(
            principal_ids.iter().all(|principal_id| *principal_id == expected),
            "all concurrent retries must resolve to the same principal_id"
        );
    }

    #[tokio::test]
    async fn protected_endpoint_returns_forbidden_when_authz_denied() {
        let app = app_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "authz-denied-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
        assert_eq!(json["request_id"], "authz-denied-test");
    }

    #[tokio::test]
    async fn protected_endpoint_returns_unavailable_when_authz_unavailable() {
        let app = app_for_test_with_authorizer(Arc::new(StaticUnavailableAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "authz-unavailable-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_UNAVAILABLE");
        assert_eq!(json["request_id"], "authz-unavailable-test");
    }

    #[tokio::test]
    async fn list_guilds_returns_member_scoped_result() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["guilds"][0]["guild_id"], 2001);
        assert_eq!(json["guilds"][0]["name"], "LinkLynx Developers");
    }

    #[tokio::test]
    async fn list_guild_channels_returns_forbidden_for_non_member() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/2001/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "non-member-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
        assert_eq!(json["request_id"], "non-member-test");
    }

    #[tokio::test]
    async fn list_guild_channels_returns_not_found_for_unknown_guild() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/9999/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "GUILD_NOT_FOUND");
    }

    #[tokio::test]
    async fn list_guild_channels_rejects_non_numeric_guild_id() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/abc/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn list_guild_channels_rejects_non_positive_guild_id() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/0/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_guild_channel_rejects_malformed_json() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"oops""#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_guild_rejects_blank_name() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"   "}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_guild_returns_created() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"My Guild"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["guild"]["guild_id"], 2002);
        assert_eq!(json["guild"]["name"], "My Guild");
        assert_eq!(json["guild"]["owner_id"], 1001);
    }

    #[tokio::test]
    async fn patch_guild_updates_name_for_authorized_principal() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/guilds/2001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"  New Guild Name  "}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["guild"]["guild_id"], 2001);
        assert_eq!(json["guild"]["name"], "New Guild Name");
        assert_eq!(json["guild"]["owner_id"], 1001);
    }

    #[tokio::test]
    async fn patch_guild_returns_forbidden_for_non_manager() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/guilds/2001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .header("x-request-id", "guild-patch-forbidden-test")
                    .body(Body::from(r#"{"name":"test"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
        assert_eq!(json["request_id"], "guild-patch-forbidden-test");
    }

    #[tokio::test]
    async fn patch_guild_rejects_empty_payload() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/guilds/2001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn patch_guild_rejects_too_long_name() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let too_long_name = "a".repeat(101);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/guilds/2001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(format!(r#"{{"name":"{too_long_name}"}}"#)))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn patch_guild_updates_icon_key_for_authorized_principal() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/guilds/2001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"icon_key":"  icons/new.png  "}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["guild"]["guild_id"], 2001);
        assert_eq!(json["guild"]["icon_key"], "icons/new.png");
    }

    #[tokio::test]
    async fn patch_guild_clears_icon_key_when_null_is_provided() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/guilds/2001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"icon_key":null}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["guild"]["guild_id"], 2001);
        assert!(json["guild"]["icon_key"].is_null());
    }

    #[tokio::test]
    async fn patch_guild_rejects_invalid_icon_key_type() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/guilds/2001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"icon_key":123}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn delete_guild_returns_no_content_for_authorized_principal() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/guilds/2001")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        assert!(body.is_empty());
    }

    #[tokio::test]
    async fn delete_guild_returns_forbidden_for_non_manager() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/guilds/2001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "guild-delete-forbidden-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
        assert_eq!(json["request_id"], "guild-delete-forbidden-test");
    }

    #[tokio::test]
    async fn delete_guild_returns_not_found_for_unknown_guild() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/guilds/9999")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "GUILD_NOT_FOUND");
    }

    #[tokio::test]
    async fn delete_guild_rejects_non_numeric_guild_id() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/guilds/abc")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn delete_guild_rejects_non_positive_guild_id() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/guilds/0")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_guild_channel_returns_created_for_member() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"release"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["channel"]["guild_id"], 2001);
        assert_eq!(json["channel"]["name"], "release");
    }

    #[tokio::test]
    async fn patch_guild_channel_returns_updated_for_manage_member() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/channels/3001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"  release-notes  "}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["channel"]["channel_id"], 3001);
        assert_eq!(json["channel"]["name"], "release-notes");
    }

    #[tokio::test]
    async fn patch_guild_channel_accepts_name_at_99_chars() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let name = "a".repeat(99);
        let payload = format!(r#"{{"name":"{name}"}}"#);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/channels/3001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(payload))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["channel"]["name"], name);
    }

    #[tokio::test]
    async fn patch_guild_channel_accepts_name_at_100_chars() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let name = "a".repeat(100);
        let payload = format!(r#"{{"name":"{name}"}}"#);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/channels/3001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(payload))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["channel"]["name"], name);
    }

    #[tokio::test]
    async fn patch_guild_channel_rejects_name_over_100_chars() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let name = "a".repeat(101);
        let payload = format!(r#"{{"name":"{name}"}}"#);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/channels/3001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(payload))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn patch_guild_channel_returns_forbidden_for_non_member() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/channels/3001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .header("x-request-id", "patch-non-member-test")
                    .body(Body::from(r#"{"name":"release-notes"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
        assert_eq!(json["request_id"], "patch-non-member-test");
    }

    #[tokio::test]
    async fn patch_guild_channel_returns_forbidden_for_insufficient_permission() {
        let app = app_for_test().await;
        let token = format!("u-3:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/channels/3001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"release-notes"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
    }

    #[tokio::test]
    async fn patch_guild_channel_returns_not_found_for_unknown_channel() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/channels/9999")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"release-notes"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "CHANNEL_NOT_FOUND");
    }

    #[tokio::test]
    async fn patch_guild_channel_rejects_non_numeric_channel_id() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/channels/abc")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"release-notes"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn patch_guild_channel_rejects_non_positive_channel_id() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/channels/0")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"release-notes"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn patch_guild_channel_rejects_payload_with_unknown_field() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/channels/3001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"release-notes","topic":"x"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn delete_guild_channel_returns_no_content_for_manage_member() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/channels/3001")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        assert!(body.is_empty());
    }

    #[tokio::test]
    async fn delete_guild_channel_returns_forbidden_for_non_member() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/channels/3001")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "delete-non-member-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
        assert_eq!(json["request_id"], "delete-non-member-test");
    }

    #[tokio::test]
    async fn delete_guild_channel_returns_forbidden_for_insufficient_permission() {
        let app = app_for_test().await;
        let token = format!("u-3:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/channels/3001")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
    }

    #[tokio::test]
    async fn delete_guild_channel_returns_not_found_for_unknown_channel() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/channels/9999")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "CHANNEL_NOT_FOUND");
    }

    #[tokio::test]
    async fn delete_guild_channel_rejects_non_numeric_channel_id() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/channels/abc")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn delete_guild_channel_rejects_non_positive_channel_id() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/channels/0")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_moderation_report_returns_created() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/moderation/reports")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"target_type":"message","target_id":9001,"reason":"spam"}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["report"]["report_id"], 4001);
        assert_eq!(json["report"]["status"], "open");
        assert_eq!(json["report"]["target_type"], "message");
    }

    #[tokio::test]
    async fn list_moderation_reports_returns_forbidden_for_non_moderator() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/2001/moderation/reports")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "moderation-forbidden-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
        assert_eq!(json["request_id"], "moderation-forbidden-test");
    }

    #[tokio::test]
    async fn resolve_moderation_report_returns_resolved_status() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/moderation/reports/4001/resolve")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["report"]["status"], "resolved");
        assert_eq!(json["report"]["resolved_by"], 1001);
    }

    #[tokio::test]
    async fn reopen_moderation_report_returns_open_status() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/moderation/reports/4001/reopen")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["report"]["status"], "open");
        assert_eq!(json["report"]["resolved_by"], serde_json::Value::Null);
    }

    #[tokio::test]
    async fn create_moderation_mute_returns_created() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/moderation/mutes")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"target_user_id":1002,"reason":"abuse","expires_at":"2026-04-01T00:00:00Z"}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["mute"]["mute_id"], 5001);
        assert_eq!(json["mute"]["target_user_id"], 1002);
    }

    #[tokio::test]
    async fn ws_ticket_endpoint_returns_ticket_for_authenticated_request() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/auth/ws-ticket")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert!(json["ticket"].as_str().is_some_and(|value| !value.is_empty()));
        assert!(json["expiresAt"].as_str().is_some_and(|value| !value.is_empty()));
    }

    #[tokio::test]
    async fn ws_ticket_endpoint_rejects_missing_token() {
        let app = app_for_test().await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/auth/ws-ticket")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn ws_text_message_echoes_for_authorized_principal() {
        let (mut socket, server) = connect_test_ws(Arc::new(StaticAllowAllAuthorizer)).await;

        socket
            .send(WsClientMessage::Text("hello".to_owned().into()))
            .await
            .unwrap();

        let response = timeout(Duration::from_secs(2), socket.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        match response {
            WsClientMessage::Text(text) => assert_eq!(text.to_string(), "hello"),
            other => panic!("expected echoed text frame, got {other:?}"),
        }

        let _ = socket.close(None).await;
        server.abort();
    }

    #[tokio::test]
    async fn ws_text_message_returns_1008_when_authz_denied() {
        let (mut socket, server) = connect_test_ws(Arc::new(WsTextDeniedAuthorizer)).await;

        socket
            .send(WsClientMessage::Text("blocked".to_owned().into()))
            .await
            .unwrap();

        let response = timeout(Duration::from_secs(2), socket.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        match response {
            WsClientMessage::Close(Some(frame)) => {
                assert_eq!(frame.code, CloseCode::Policy);
                assert_eq!(frame.reason, "AUTHZ_DENIED");
            }
            other => panic!("expected close frame for denied WS text, got {other:?}"),
        }

        server.abort();
    }

    #[tokio::test]
    async fn ws_text_message_returns_1011_when_authz_unavailable() {
        let (mut socket, server) = connect_test_ws(Arc::new(WsTextUnavailableAuthorizer)).await;

        socket
            .send(WsClientMessage::Text("retry".to_owned().into()))
            .await
            .unwrap();

        let response = timeout(Duration::from_secs(2), socket.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        match response {
            WsClientMessage::Close(Some(frame)) => {
                assert_eq!(frame.code, CloseCode::Error);
                assert_eq!(frame.reason, "AUTHZ_UNAVAILABLE");
            }
            other => panic!("expected close frame for unavailable WS text, got {other:?}"),
        }

        server.abort();
    }

    #[tokio::test]
    async fn get_my_profile_returns_profile() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["profile"]["display_name"], "Alice");
        assert_eq!(json["profile"]["status_text"], "Ready");
        assert_eq!(json["profile"]["avatar_key"], "avatars/alice.png");
    }

    #[tokio::test]
    async fn patch_my_profile_updates_display_name() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"display_name":"  New Name  "}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["profile"]["display_name"], "New Name");
    }

    #[tokio::test]
    async fn patch_my_profile_clears_status_text_with_blank_input() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"status_text":"   "}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["profile"]["status_text"], serde_json::Value::Null);
    }

    #[tokio::test]
    async fn patch_my_profile_rejects_empty_payload() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn patch_my_profile_rejects_invalid_avatar_key_format() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"avatar_key":"bad key"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn patch_my_profile_rejects_null_display_name() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"display_name":null,"status_text":"hello"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn get_my_profile_returns_not_found_for_missing_user() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "USER_NOT_FOUND");
    }

    #[tokio::test]
    async fn get_my_profile_returns_unavailable_when_dependency_unavailable() {
        let app = app_for_test_with_authorizer_and_profile(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticUnavailableProfileService),
        )
        .await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "profile-unavailable-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "PROFILE_UNAVAILABLE");
        assert_eq!(json["request_id"], "profile-unavailable-test");
    }

    #[tokio::test]
    async fn invite_dm_moderation_endpoints_apply_role_based_allow_and_deny() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;

        let owner_token = format!("u-owner:{}", unix_timestamp_seconds() + 300);
        let owner_invite_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/10/invites/invite-abc")
                    .header("authorization", format!("Bearer {owner_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(owner_invite_response.status(), StatusCode::OK);

        let member_token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let member_dm_get_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/dms/55/messages")
                    .header("authorization", format!("Bearer {member_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(member_dm_get_response.status(), StatusCode::OK);

        let member_dm_post_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/dms/55/messages")
                    .header("authorization", format!("Bearer {member_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(member_dm_post_response.status(), StatusCode::OK);

        let member_moderation_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/10/members/9003")
                    .header("authorization", format!("Bearer {member_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(member_moderation_response.status(), StatusCode::FORBIDDEN);

        let admin_token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let admin_moderation_response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/10/members/9003")
                    .header("authorization", format!("Bearer {admin_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(admin_moderation_response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn moderation_endpoint_returns_unavailable_when_authz_unavailable() {
        let app = app_for_test_with_authorizer(Arc::new(StaticUnavailableAuthorizer)).await;
        let token = format!("u-owner:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/10/members/9003")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "moderation-authz-unavailable-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_UNAVAILABLE");
        assert_eq!(json["request_id"], "moderation-authz-unavailable-test");
    }

    #[tokio::test]
    async fn invite_endpoint_returns_retry_after_when_rate_limited() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-owner:{}", unix_timestamp_seconds() + 300);
        let mut last_response = None;

        for _ in 0..11 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .uri("/v1/guilds/10/invites/invite-abc")
                            .header("authorization", format!("Bearer {token}"))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap(),
            );
        }

        let response = last_response.unwrap();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            response
                .headers()
                .get(RETRY_AFTER)
                .and_then(|value| value.to_str().ok()),
            Some("60")
        );
    }

    #[tokio::test]
    async fn moderation_endpoint_fail_closes_when_ratelimit_degraded() {
        let state = state_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        state.rest_rate_limit_service.set_degraded_for_test(true).await;
        let app = app_with_state(state);
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);

        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/10/members/9003")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            response
                .headers()
                .get(RETRY_AFTER)
                .and_then(|value| value.to_str().ok()),
            Some("60")
        );
    }

    #[tokio::test]
    async fn message_create_continues_with_l1_when_ratelimit_degraded() {
        let state = state_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        state.rest_rate_limit_service.set_degraded_for_test(true).await;
        let app = app_with_state(state);
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let first_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/dms/55/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(first_response.status(), StatusCode::OK);

        let mut last_response = None;

        for _ in 0..30 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .method("POST")
                            .uri("/v1/dms/55/messages")
                            .header("authorization", format!("Bearer {token}"))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap(),
            );
        }

        let response = last_response.unwrap();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            response
                .headers()
                .get(RETRY_AFTER)
                .and_then(|value| value.to_str().ok()),
            Some("60")
        );
    }

    #[test]
    fn rest_authz_resource_maps_invite_dm_and_moderation_paths() {
        match rest_authz_resource_from_path("/v1/guilds/10/invites/invite-abc") {
            AuthzResource::Guild { guild_id } => assert_eq!(guild_id, 10),
            _ => panic!("invite path should map to guild resource"),
        }

        match rest_authz_resource_from_path("/v1/dms/55/messages") {
            AuthzResource::Channel { channel_id } => assert_eq!(channel_id, 55),
            _ => panic!("dm path should map to channel resource"),
        }

        match rest_authz_resource_from_path("/v1/moderation/guilds/10/members/9003") {
            AuthzResource::Guild { guild_id } => assert_eq!(guild_id, 10),
            _ => panic!("moderation path should map to guild resource"),
        }

        match rest_authz_resource_from_path("/guilds/10") {
            AuthzResource::Guild { guild_id } => assert_eq!(guild_id, 10),
            _ => panic!("non-v1 guild path should map to guild resource"),
        }
    }

    #[test]
    fn rest_authz_action_maps_internal_cache_invalidation_post_to_view() {
        assert!(matches!(
            rest_authz_action_for_request(&Method::POST, "/internal/authz/cache/invalidate"),
            AuthzAction::View
        ));
        assert!(matches!(
            rest_authz_action_for_request(&Method::POST, "/v1/dms/55/messages"),
            AuthzAction::Post
        ));
    }

    #[test]
    fn parse_reauth_id_token_extracts_token() {
        let text = r#"{"type":"auth.reauthenticate","d":{"idToken":"next-token"}}"#;
        assert_eq!(parse_reauth_id_token(text), Some("next-token".to_owned()));
    }

    #[test]
    fn parse_reauth_id_token_ignores_non_reauth_messages() {
        let text = r#"{"type":"message.create","body":"hi"}"#;
        assert_eq!(parse_reauth_id_token(text), None);
    }

    #[test]
    fn parse_identify_payload_extracts_ticket() {
        let text = r#"{"type":"auth.identify","d":{"method":"ticket","ticket":"abc"}}"#;
        let payload = parse_identify_payload(text).unwrap();

        assert_eq!(payload.method, "ticket");
        assert_eq!(payload.ticket, "abc");
    }
}
