#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::test_support::{
        bucket_from_created_at, build_live_message_service, connect_integration_database,
        connect_integration_scylla, count_scylla_messages, insert_scylla_message,
        next_integration_id_block, query_last_message, seed_guild_member, seed_guild_text_channel,
        seed_user, upsert_channel_last_message, SeedMessageRow,
    };
    use crate::ratelimit::RestRateLimitConfig;
    use async_trait::async_trait;
    use auth::{
        CachingPrincipalResolver, InMemoryPrincipalCache, InMemoryPrincipalStore,
        PrincipalProvisioner, PrincipalResolver, PrincipalStore, TokenVerifier, TokenVerifyError,
        VerifiedToken,
    };
    use authz::{
        Authorizer, AuthzAction, AuthzCheckInput, AuthzError, AuthzErrorKind, AuthzResource,
    };
    use axum::{
        body::to_bytes,
        http::{
            header::{
                ACCESS_CONTROL_REQUEST_HEADERS, ACCESS_CONTROL_REQUEST_METHOD, AUTHORIZATION,
                ORIGIN, RETRY_AFTER,
            },
            Method, StatusCode,
        },
    };
    use dm::{DmChannelSummary, DmError, DmRecipientSummary, DmService};
    use futures_util::{SinkExt, StreamExt};
    use guild_channel::{
        ChannelPatchInput, ChannelSummary, CreatedChannel, CreatedGuild, GuildChannelError,
        GuildChannelService, GuildPatchInput, GuildSummary, PostgresGuildChannelService,
    };
    use invite::{
        CreateInviteInput, CreatedInvite, GuildInviteSummary, InviteChannelSummary,
        InviteCreatorSummary, InviteError, InviteJoinResult, InviteJoinStatus, InviteService,
        PublicInviteGuild, PublicInviteLookup, PublicInviteStatus,
    };
    use linklynx_message_api::{
        CreateGuildChannelMessageRequestV1, CreateGuildChannelMessageResponseV1,
        DeleteGuildChannelMessageRequestV1, EditGuildChannelMessageRequestV1,
        ListGuildChannelMessagesQueryV1, ListGuildChannelMessagesResponseV1, MessageCursorKeyV1,
        MessageItemV1, UpdateGuildChannelMessageResponseV1,
    };
    use linklynx_protocol_ws::{
        ClientMessageFrameV1, DmChannelSubscriptionTargetV1, DmMessageSubscriptionStateV1,
        GuildChannelSubscriptionTargetV1, MessageSubscriptionStateV1, ServerMessageFrameV1,
    };
    use linklynx_shared::PrincipalId;
    use message::{CreateGuildChannelMessageExecution, MessageError, MessageService};
    use moderation::{
        CreateModerationMuteInput, CreateModerationReportInput, ModerationError, ModerationReport,
        ModerationReportStatus, ModerationService, ModerationTargetType,
        UnavailableModerationService,
    };
    use profile::ProfileTheme;
    use profile::{
        validate_profile_media_object_key, ProfileError, ProfileMediaDownload, ProfileMediaService,
        ProfileMediaTarget, ProfileMediaUpload, ProfileMediaUploadInput, ProfilePatchInput,
        ProfileService, ProfileSettings,
    };
    use scylla_health::{ScyllaHealthReport, ScyllaHealthReporter};
    use user_directory::{
        GuildMemberDirectoryEntry, GuildRoleDirectoryEntry, UserDirectoryError,
        UserDirectoryService, UserProfileDirectoryEntry,
    };
    use std::{
        collections::{HashMap, HashSet},
        net::SocketAddr,
        sync::atomic::{AtomicBool, Ordering},
    };
    use tokio::{
        net::{TcpListener, TcpStream},
        sync::Mutex,
        task::JoinHandle,
        time::timeout,
    };
    use tokio_tungstenite::{
        connect_async,
        tungstenite::{
            client::IntoClientRequest, protocol::frame::coding::CloseCode,
            Message as WsClientMessage,
        },
        MaybeTlsStream, WebSocketStream,
    };
    use tower::ServiceExt;

    const MAX_RESPONSE_BYTES: usize = 16 * 1024;
    const TEST_INTERNAL_OPS_SECRET: &str = "test-internal-secret";
    const TEST_PUBLIC_INVITE_TRUSTED_PROXY_SECRET: &str = "test-public-invite-proxy-secret";

    struct StaticTokenVerifier;
    struct UnavailableTokenVerifier;
    struct StaticAllowAllAuthorizer;
    struct StaticDenyAuthorizer;
    struct StaticUnavailableAuthorizer;
    struct StreamAllowedGuildChannelDeniedAuthorizer;
    struct StreamDeniedGuildChannelAllowedAuthorizer;
    struct StreamAllowedGuildChannelUnavailableAuthorizer;
    struct StreamUnavailableGuildChannelAllowedAuthorizer;
    struct WsTextDeniedAuthorizer;
    struct WsTextUnavailableAuthorizer;
    struct ToggleGuildChannelAuthorizer {
        allow_channel: AtomicBool,
    }
    struct PermissionSnapshotUnavailableAuthorizer;
    struct StaticGuildChannelService;
    struct StaticDmService;
    struct StaticMessageService;
    struct StaticNotFoundMessageService;
    struct StaticUnavailableMessageService;
    struct StaticModerationService;
    struct StaticProfileService;
    struct StaticUnavailableProfileService;
    struct StaticProfileMediaService;
    struct StaticUnavailableProfileMediaService;
    struct StaticInviteService;
    struct StaticUnavailableInviteService;
    struct RoleScenarioAuthorizer;
    struct StaticUserDirectoryService;
    struct StaticScyllaHealthReporter {
        report: ScyllaHealthReport,
    }

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
    impl TokenVerifier for UnavailableTokenVerifier {
        async fn verify(&self, _token: &str) -> Result<VerifiedToken, TokenVerifyError> {
            Err(TokenVerifyError::DependencyUnavailable(
                "test_auth_dependency_unavailable".to_owned(),
            ))
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
    impl Authorizer for StreamAllowedGuildChannelDeniedAuthorizer {
        async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
            match (&input.resource, input.action) {
                (AuthzResource::RestPath { path }, AuthzAction::View) if path == "/ws/stream" => {
                    Ok(())
                }
                (
                    AuthzResource::GuildChannel {
                        guild_id,
                        channel_id,
                    },
                    AuthzAction::View,
                ) if *guild_id == 10 && *channel_id == 20 => {
                    Err(AuthzError::denied("guild_channel_access_denied"))
                }
                _ => Err(AuthzError::denied("unsupported_stream_channel_scenario")),
            }
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
    impl Authorizer for StreamDeniedGuildChannelAllowedAuthorizer {
        async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
            match (&input.resource, input.action) {
                (AuthzResource::RestPath { path }, AuthzAction::View) if path == "/ws/stream" => {
                    Err(AuthzError::denied("ws_stream_access_denied"))
                }
                (
                    AuthzResource::GuildChannel {
                        guild_id,
                        channel_id,
                    },
                    AuthzAction::View,
                ) if *guild_id == 10 && *channel_id == 20 => Ok(()),
                _ => Err(AuthzError::denied("unsupported_stream_channel_scenario")),
            }
        }
    }

    #[async_trait]
    impl Authorizer for StreamAllowedGuildChannelUnavailableAuthorizer {
        async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
            match (&input.resource, input.action) {
                (AuthzResource::RestPath { path }, AuthzAction::View) if path == "/ws/stream" => {
                    Ok(())
                }
                (
                    AuthzResource::GuildChannel {
                        guild_id,
                        channel_id,
                    },
                    AuthzAction::View,
                ) if *guild_id == 10 && *channel_id == 20 => {
                    Err(AuthzError::unavailable("guild_channel_access_unavailable"))
                }
                _ => Err(AuthzError::denied("unsupported_stream_channel_scenario")),
            }
        }
    }

    #[async_trait]
    impl Authorizer for StreamUnavailableGuildChannelAllowedAuthorizer {
        async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
            match (&input.resource, input.action) {
                (AuthzResource::RestPath { path }, AuthzAction::View) if path == "/ws/stream" => {
                    Err(AuthzError::unavailable("ws_stream_access_unavailable"))
                }
                (
                    AuthzResource::GuildChannel {
                        guild_id,
                        channel_id,
                    },
                    AuthzAction::View,
                ) if *guild_id == 10 && *channel_id == 20 => Ok(()),
                _ => Err(AuthzError::denied("unsupported_stream_channel_scenario")),
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

    impl ToggleGuildChannelAuthorizer {
        fn new(allow_channel: bool) -> Self {
            Self {
                allow_channel: AtomicBool::new(allow_channel),
            }
        }

        fn set_allow_channel(&self, allow_channel: bool) {
            self.allow_channel.store(allow_channel, Ordering::Relaxed);
        }
    }

    #[async_trait]
    impl Authorizer for ToggleGuildChannelAuthorizer {
        async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
            match (&input.resource, input.action) {
                (AuthzResource::Session, AuthzAction::Connect) => Ok(()),
                (AuthzResource::RestPath { path }, AuthzAction::View) if path == "/ws/stream" => {
                    Ok(())
                }
                (
                    AuthzResource::GuildChannel {
                        guild_id,
                        channel_id,
                    },
                    AuthzAction::View,
                ) if *guild_id == 10 && *channel_id == 20 => {
                    if self.allow_channel.load(Ordering::Relaxed) {
                        Ok(())
                    } else {
                        Err(AuthzError::denied("guild_channel_access_revoked"))
                    }
                }
                _ => Err(AuthzError::denied("unsupported_toggle_authorizer_scenario")),
            }
        }
    }

    #[async_trait]
    impl Authorizer for PermissionSnapshotUnavailableAuthorizer {
        async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
            match (&input.resource, input.action) {
                (AuthzResource::Guild { .. }, AuthzAction::View) => Ok(()),
                (AuthzResource::Guild { .. }, AuthzAction::Manage) => {
                    Err(AuthzError::unavailable("permission_snapshot_unavailable"))
                }
                _ => Err(AuthzError::denied(
                    "unsupported_permission_snapshot_scenario",
                )),
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
    impl ScyllaHealthReporter for StaticScyllaHealthReporter {
        async fn report(&self) -> ScyllaHealthReport {
            self.report.clone()
        }
    }

    #[async_trait]
    impl MessageService for StaticMessageService {
        async fn list_guild_channel_messages(
            &self,
            guild_id: i64,
            channel_id: i64,
            query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
            linklynx_message_api::paginate_messages(&message_fixture(guild_id, channel_id), &query)
                .map_err(MessageError::from)
        }

        async fn create_guild_channel_message(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            channel_id: i64,
            _idempotency_key: Option<&str>,
            request: CreateGuildChannelMessageRequestV1,
        ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
            linklynx_message_api::validate_create_request(&request).map_err(MessageError::from)?;

            Ok(CreateGuildChannelMessageExecution {
                response: CreateGuildChannelMessageResponseV1 {
                    message: create_message_fixture(
                        guild_id,
                        channel_id,
                        principal_id.0,
                        request.content,
                    ),
                },
                should_publish: true,
            })
        }

        async fn list_dm_channel_messages(
            &self,
            channel_id: i64,
            query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
            linklynx_message_api::paginate_messages(
                &message_fixture(channel_id, channel_id),
                &query,
            )
            .map_err(MessageError::from)
        }

        async fn create_dm_channel_message(
            &self,
            principal_id: PrincipalId,
            channel_id: i64,
            _idempotency_key: Option<&str>,
            request: CreateGuildChannelMessageRequestV1,
        ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
            linklynx_message_api::validate_create_request(&request).map_err(MessageError::from)?;

            Ok(CreateGuildChannelMessageExecution {
                response: CreateGuildChannelMessageResponseV1 {
                    message: create_message_fixture(
                        channel_id,
                        channel_id,
                        principal_id.0,
                        request.content,
                    ),
                },
                should_publish: true,
            })
        }

        async fn edit_guild_channel_message(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            channel_id: i64,
            message_id: i64,
            request: EditGuildChannelMessageRequestV1,
        ) -> Result<UpdateGuildChannelMessageResponseV1, MessageError> {
            linklynx_message_api::validate_edit_request(&request).map_err(MessageError::from)?;

            Ok(UpdateGuildChannelMessageResponseV1 {
                message: MessageItemV1 {
                    message_id,
                    guild_id,
                    channel_id,
                    author_id: principal_id.0,
                    content: request.content,
                    created_at: "2026-03-07T10:00:00Z".to_owned(),
                    version: request.expected_version + 1,
                    edited_at: Some("2026-03-07T10:05:00Z".to_owned()),
                    is_deleted: false,
                },
            })
        }

        async fn delete_guild_channel_message(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            channel_id: i64,
            message_id: i64,
            request: DeleteGuildChannelMessageRequestV1,
        ) -> Result<UpdateGuildChannelMessageResponseV1, MessageError> {
            linklynx_message_api::validate_delete_request(&request).map_err(MessageError::from)?;

            Ok(UpdateGuildChannelMessageResponseV1 {
                message: MessageItemV1 {
                    message_id,
                    guild_id,
                    channel_id,
                    author_id: principal_id.0,
                    content: String::new(),
                    created_at: "2026-03-07T10:00:00Z".to_owned(),
                    version: request.expected_version + 1,
                    edited_at: Some("2026-03-07T10:05:00Z".to_owned()),
                    is_deleted: true,
                },
            })
        }
    }

    #[derive(Default)]
    struct StaticIdempotencyMessageService {
        state: Mutex<IdempotencyState>,
    }

    #[derive(Default)]
    struct IdempotencyState {
        next_message_id: i64,
        entries: HashMap<String, MessageItemV1>,
    }

    #[async_trait]
    impl MessageService for StaticIdempotencyMessageService {
        async fn list_guild_channel_messages(
            &self,
            _guild_id: i64,
            _channel_id: i64,
            _query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
            Ok(ListGuildChannelMessagesResponseV1 {
                items: vec![],
                next_before: None,
                next_after: None,
                has_more: false,
            })
        }

        async fn create_guild_channel_message(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            channel_id: i64,
            idempotency_key: Option<&str>,
            request: CreateGuildChannelMessageRequestV1,
        ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
            linklynx_message_api::validate_create_request(&request).map_err(MessageError::from)?;
            let mut state = self.state.lock().await;

            if let Some(key) = idempotency_key {
                if let Some(existing) = state.entries.get(key) {
                    if existing.content != request.content {
                        return Err(MessageError::validation(
                            "message_idempotency_payload_mismatch",
                        ));
                    }
                    return Ok(CreateGuildChannelMessageExecution {
                        response: CreateGuildChannelMessageResponseV1 {
                            message: existing.clone(),
                        },
                        should_publish: false,
                    });
                }
            }

            state.next_message_id += 1;
            let message = MessageItemV1 {
                message_id: 120_110 + state.next_message_id,
                guild_id,
                channel_id,
                author_id: principal_id.0,
                content: request.content,
                created_at: format!("2026-03-07T10:00:{:02}Z", state.next_message_id),
                version: 1,
                edited_at: None,
                is_deleted: false,
            };
            if let Some(key) = idempotency_key {
                state.entries.insert(key.to_owned(), message.clone());
            }
            state.entries.insert(
                format!("{channel_id}:{}", message.message_id),
                message.clone(),
            );

            Ok(CreateGuildChannelMessageExecution {
                response: CreateGuildChannelMessageResponseV1 { message },
                should_publish: true,
            })
        }

        async fn list_dm_channel_messages(
            &self,
            _channel_id: i64,
            _query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
            Ok(ListGuildChannelMessagesResponseV1 {
                items: vec![],
                next_before: None,
                next_after: None,
                has_more: false,
            })
        }

        async fn create_dm_channel_message(
            &self,
            principal_id: PrincipalId,
            channel_id: i64,
            idempotency_key: Option<&str>,
            request: CreateGuildChannelMessageRequestV1,
        ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
            self.create_guild_channel_message(
                principal_id,
                channel_id,
                channel_id,
                idempotency_key,
                request,
            )
            .await
        }

        async fn edit_guild_channel_message(
            &self,
            principal_id: PrincipalId,
            _guild_id: i64,
            channel_id: i64,
            message_id: i64,
            request: EditGuildChannelMessageRequestV1,
        ) -> Result<UpdateGuildChannelMessageResponseV1, MessageError> {
            linklynx_message_api::validate_edit_request(&request).map_err(MessageError::from)?;
            let mut state = self.state.lock().await;
            let key = format!("{channel_id}:{message_id}");
            let existing = state
                .entries
                .get(&key)
                .cloned()
                .ok_or_else(|| MessageError::message_not_found("message_not_found"))?;
            if existing.author_id != principal_id.0 {
                return Err(MessageError::authz_denied("message_mutation_forbidden"));
            }
            if existing.version != request.expected_version {
                return Err(MessageError::conflict("message_version_conflict"));
            }
            if existing.is_deleted {
                return Err(MessageError::conflict("message_deleted_conflict"));
            }

            let updated = MessageItemV1 {
                content: request.content,
                version: existing.version + 1,
                edited_at: Some("2026-03-07T10:05:00Z".to_owned()),
                ..existing
            };
            state.entries.insert(key, updated.clone());

            Ok(UpdateGuildChannelMessageResponseV1 { message: updated })
        }

        async fn delete_guild_channel_message(
            &self,
            principal_id: PrincipalId,
            _guild_id: i64,
            channel_id: i64,
            message_id: i64,
            request: DeleteGuildChannelMessageRequestV1,
        ) -> Result<UpdateGuildChannelMessageResponseV1, MessageError> {
            linklynx_message_api::validate_delete_request(&request).map_err(MessageError::from)?;
            let mut state = self.state.lock().await;
            let key = format!("{channel_id}:{message_id}");
            let existing = state
                .entries
                .get(&key)
                .cloned()
                .ok_or_else(|| MessageError::message_not_found("message_not_found"))?;
            if existing.author_id != principal_id.0 {
                return Err(MessageError::authz_denied("message_mutation_forbidden"));
            }
            if existing.version != request.expected_version {
                return Err(MessageError::conflict("message_version_conflict"));
            }
            if existing.is_deleted {
                return Err(MessageError::conflict("message_deleted_conflict"));
            }

            let deleted = MessageItemV1 {
                content: String::new(),
                version: existing.version + 1,
                edited_at: Some("2026-03-07T10:06:00Z".to_owned()),
                is_deleted: true,
                ..existing
            };
            state.entries.insert(key, deleted.clone());

            Ok(UpdateGuildChannelMessageResponseV1 { message: deleted })
        }
    }

    #[async_trait]
    impl MessageService for StaticUnavailableMessageService {
        async fn list_guild_channel_messages(
            &self,
            _guild_id: i64,
            _channel_id: i64,
            _query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
            Err(MessageError::dependency_unavailable(
                "message_body_store_unavailable",
            ))
        }

        async fn create_guild_channel_message(
            &self,
            _principal_id: PrincipalId,
            _guild_id: i64,
            _channel_id: i64,
            _idempotency_key: Option<&str>,
            _request: CreateGuildChannelMessageRequestV1,
        ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
            Err(MessageError::dependency_unavailable(
                "message_body_store_unavailable",
            ))
        }

        async fn list_dm_channel_messages(
            &self,
            _channel_id: i64,
            _query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
            Err(MessageError::dependency_unavailable(
                "message_body_store_unavailable",
            ))
        }

        async fn create_dm_channel_message(
            &self,
            _principal_id: PrincipalId,
            _channel_id: i64,
            _idempotency_key: Option<&str>,
            _request: CreateGuildChannelMessageRequestV1,
        ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
            Err(MessageError::dependency_unavailable(
                "message_body_store_unavailable",
            ))
        }

        async fn edit_guild_channel_message(
            &self,
            _principal_id: PrincipalId,
            _guild_id: i64,
            _channel_id: i64,
            _message_id: i64,
            _request: EditGuildChannelMessageRequestV1,
        ) -> Result<UpdateGuildChannelMessageResponseV1, MessageError> {
            Err(MessageError::dependency_unavailable(
                "message_body_store_unavailable",
            ))
        }

        async fn delete_guild_channel_message(
            &self,
            _principal_id: PrincipalId,
            _guild_id: i64,
            _channel_id: i64,
            _message_id: i64,
            _request: DeleteGuildChannelMessageRequestV1,
        ) -> Result<UpdateGuildChannelMessageResponseV1, MessageError> {
            Err(MessageError::dependency_unavailable(
                "message_body_store_unavailable",
            ))
        }
    }

    #[async_trait]
    impl MessageService for StaticNotFoundMessageService {
        async fn list_guild_channel_messages(
            &self,
            _guild_id: i64,
            _channel_id: i64,
            _query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
            Err(MessageError::channel_not_found("message_channel_not_found"))
        }

        async fn create_guild_channel_message(
            &self,
            _principal_id: PrincipalId,
            _guild_id: i64,
            _channel_id: i64,
            _idempotency_key: Option<&str>,
            _request: CreateGuildChannelMessageRequestV1,
        ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
            Err(MessageError::channel_not_found("message_channel_not_found"))
        }

        async fn list_dm_channel_messages(
            &self,
            _channel_id: i64,
            _query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
            Err(MessageError::channel_not_found("message_channel_not_found"))
        }

        async fn create_dm_channel_message(
            &self,
            _principal_id: PrincipalId,
            _channel_id: i64,
            _idempotency_key: Option<&str>,
            _request: CreateGuildChannelMessageRequestV1,
        ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
            Err(MessageError::channel_not_found("message_channel_not_found"))
        }

        async fn edit_guild_channel_message(
            &self,
            _principal_id: PrincipalId,
            _guild_id: i64,
            _channel_id: i64,
            _message_id: i64,
            _request: EditGuildChannelMessageRequestV1,
        ) -> Result<UpdateGuildChannelMessageResponseV1, MessageError> {
            Err(MessageError::message_not_found("message_not_found"))
        }

        async fn delete_guild_channel_message(
            &self,
            _principal_id: PrincipalId,
            _guild_id: i64,
            _channel_id: i64,
            _message_id: i64,
            _request: DeleteGuildChannelMessageRequestV1,
        ) -> Result<UpdateGuildChannelMessageResponseV1, MessageError> {
            Err(MessageError::message_not_found("message_not_found"))
        }
    }

    #[async_trait]
    impl DmService for StaticDmService {
        async fn list_dm_channels(
            &self,
            principal_id: PrincipalId,
        ) -> Result<Vec<DmChannelSummary>, DmError> {
            if principal_id.0 != 1001 {
                return Ok(vec![]);
            }
            Ok(vec![DmChannelSummary {
                channel_id: 55,
                created_at: "2026-03-07T10:00:00Z".to_owned(),
                last_message_id: Some(5001),
                recipient: DmRecipientSummary {
                    user_id: 1002,
                    display_name: "Bob".to_owned(),
                    avatar_key: Some("avatars/bob.png".to_owned()),
                },
            }])
        }

        async fn get_dm_channel(
            &self,
            principal_id: PrincipalId,
            channel_id: i64,
        ) -> Result<DmChannelSummary, DmError> {
            if principal_id.0 != 1001 {
                return Err(DmError::forbidden("dm_participant_required"));
            }
            if channel_id != 55 {
                return Err(DmError::not_found("dm_channel_not_found"));
            }
            Ok(DmChannelSummary {
                channel_id,
                created_at: "2026-03-07T10:00:00Z".to_owned(),
                last_message_id: Some(5001),
                recipient: DmRecipientSummary {
                    user_id: 1002,
                    display_name: "Bob".to_owned(),
                    avatar_key: Some("avatars/bob.png".to_owned()),
                },
            })
        }

        async fn open_or_create_dm(
            &self,
            principal_id: PrincipalId,
            recipient_id: i64,
        ) -> Result<DmChannelSummary, DmError> {
            if principal_id.0 == recipient_id {
                return Err(DmError::validation("dm_self_target_not_allowed"));
            }
            Ok(DmChannelSummary {
                channel_id: 55,
                created_at: "2026-03-07T10:00:00Z".to_owned(),
                last_message_id: Some(5001),
                recipient: DmRecipientSummary {
                    user_id: recipient_id,
                    display_name: "Bob".to_owned(),
                    avatar_key: Some("avatars/bob.png".to_owned()),
                },
            })
        }

        async fn list_dm_messages(
            &self,
            _principal_id: PrincipalId,
            channel_id: i64,
            query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, DmError> {
            linklynx_message_api::paginate_messages(
                &message_fixture(channel_id, channel_id),
                &query,
            )
            .map_err(|error| DmError::validation(error.reason_code()))
        }

        async fn create_dm_message(
            &self,
            principal_id: PrincipalId,
            channel_id: i64,
            _idempotency_key: Option<&str>,
            request: CreateGuildChannelMessageRequestV1,
        ) -> Result<CreateGuildChannelMessageExecution, DmError> {
            Ok(CreateGuildChannelMessageExecution {
                response: CreateGuildChannelMessageResponseV1 {
                    message: create_message_fixture(
                        channel_id,
                        channel_id,
                        principal_id.0,
                        request.content,
                    ),
                },
                should_publish: true,
            })
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
                return Err(GuildChannelError::forbidden(
                    "guild_manage_permission_required",
                ));
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
                return Err(GuildChannelError::forbidden(
                    "guild_manage_permission_required",
                ));
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
                    channel_id: 3090,
                    guild_id,
                    kind: guild_channel::ChannelKind::GuildCategory,
                    name: "times".to_owned(),
                    parent_id: None,
                    position: 0,
                    created_at: "2026-03-03T00:00:00Z".to_owned(),
                },
                ChannelSummary {
                    channel_id: 3001,
                    guild_id,
                    kind: guild_channel::ChannelKind::GuildText,
                    name: "general".to_owned(),
                    parent_id: None,
                    position: 1,
                    created_at: "2026-03-03T00:00:00Z".to_owned(),
                },
                ChannelSummary {
                    channel_id: 3091,
                    guild_id,
                    kind: guild_channel::ChannelKind::GuildText,
                    name: "times-abe".to_owned(),
                    parent_id: Some(3090),
                    position: 0,
                    created_at: "2026-03-03T00:00:15Z".to_owned(),
                },
                ChannelSummary {
                    channel_id: 3002,
                    guild_id,
                    kind: guild_channel::ChannelKind::GuildText,
                    name: "random".to_owned(),
                    parent_id: None,
                    position: 2,
                    created_at: "2026-03-03T00:00:30Z".to_owned(),
                },
            ])
        }

        async fn get_guild_channel_summary(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            channel_id: i64,
        ) -> Result<ChannelSummary, GuildChannelError> {
            if guild_id == 10 && principal_id.0 == 9003 {
                return match channel_id {
                    20 => Ok(ChannelSummary {
                        channel_id,
                        guild_id,
                        kind: guild_channel::ChannelKind::GuildText,
                        name: "contract".to_owned(),
                        parent_id: None,
                        position: 0,
                        created_at: "2026-03-03T00:00:00Z".to_owned(),
                    }),
                    21 => Ok(ChannelSummary {
                        channel_id,
                        guild_id,
                        kind: guild_channel::ChannelKind::GuildCategory,
                        name: "category".to_owned(),
                        parent_id: None,
                        position: 1,
                        created_at: "2026-03-03T00:00:30Z".to_owned(),
                    }),
                    _ => Err(GuildChannelError::channel_not_found("channel_not_found")),
                };
            }

            let channels = self.list_guild_channels(principal_id, guild_id).await?;
            channels
                .into_iter()
                .find(|channel| channel.channel_id == channel_id)
                .ok_or_else(|| GuildChannelError::channel_not_found("channel_not_found"))
        }

        async fn create_guild_channel(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            input: guild_channel::CreateChannelInput,
        ) -> Result<CreatedChannel, GuildChannelError> {
            if guild_id != 2001 {
                return Err(GuildChannelError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(GuildChannelError::forbidden(
                    "channel_manage_permission_required",
                ));
            }

            let normalized = input.name.trim();
            if normalized.is_empty() {
                return Err(GuildChannelError::validation("channel_name_required"));
            }
            if input.kind == guild_channel::ChannelKind::GuildCategory && input.parent_id.is_some()
            {
                return Err(GuildChannelError::validation("category_parent_not_allowed"));
            }

            match (input.kind, input.parent_id) {
                (guild_channel::ChannelKind::GuildCategory, None) => Ok(CreatedChannel {
                    channel_id: 3003,
                    guild_id,
                    kind: guild_channel::ChannelKind::GuildCategory,
                    name: normalized.to_owned(),
                    parent_id: None,
                    position: 3,
                    created_at: "2026-03-03T00:01:00Z".to_owned(),
                }),
                (guild_channel::ChannelKind::GuildText, None) => Ok(CreatedChannel {
                    channel_id: 3004,
                    guild_id,
                    kind: guild_channel::ChannelKind::GuildText,
                    name: normalized.to_owned(),
                    parent_id: None,
                    position: 4,
                    created_at: "2026-03-03T00:01:10Z".to_owned(),
                }),
                (guild_channel::ChannelKind::GuildText, Some(3090)) => Ok(CreatedChannel {
                    channel_id: 3005,
                    guild_id,
                    kind: guild_channel::ChannelKind::GuildText,
                    name: normalized.to_owned(),
                    parent_id: Some(3090),
                    position: 1,
                    created_at: "2026-03-03T00:01:20Z".to_owned(),
                }),
                (guild_channel::ChannelKind::GuildText, Some(9999)) => Err(
                    GuildChannelError::channel_not_found("parent_channel_not_found"),
                ),
                (guild_channel::ChannelKind::GuildText, Some(_)) => Err(
                    GuildChannelError::validation("parent_channel_must_be_category"),
                ),
                (guild_channel::ChannelKind::GuildCategory, Some(_)) => {
                    Err(GuildChannelError::validation("category_parent_not_allowed"))
                }
            }
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
                return Err(GuildChannelError::forbidden(
                    "channel_manage_permission_required",
                ));
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
                kind: guild_channel::ChannelKind::GuildText,
                name: normalized.to_owned(),
                parent_id: None,
                position: 0,
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
                return Err(GuildChannelError::forbidden(
                    "channel_manage_permission_required",
                ));
            }
            if principal_id.0 != 1001 {
                return Err(GuildChannelError::forbidden("guild_membership_required"));
            }

            Ok(())
        }
    }

    #[async_trait]
    impl ProfileService for StaticProfileService {
        async fn get_profile(
            &self,
            principal_id: PrincipalId,
        ) -> Result<ProfileSettings, ProfileError> {
            if principal_id.0 != 1001 {
                return Err(ProfileError::not_found("user_not_found"));
            }

            Ok(ProfileSettings {
                display_name: "Alice".to_owned(),
                status_text: Some("Ready".to_owned()),
                avatar_key: Some(
                    "v0/tenant/default/user/1001/profile/avatar/asset/550e8400-e29b-41d4-a716-446655440000/avatar.png"
                        .to_owned(),
                ),
                banner_key: Some(
                    "v0/tenant/default/user/1001/profile/banner/asset/550e8400-e29b-41d4-a716-446655440001/banner.png"
                        .to_owned(),
                ),
                theme: ProfileTheme::Dark,
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
                avatar_key: Some(
                    "v0/tenant/default/user/1001/profile/avatar/asset/550e8400-e29b-41d4-a716-446655440000/avatar.png"
                        .to_owned(),
                ),
                banner_key: Some(
                    "v0/tenant/default/user/1001/profile/banner/asset/550e8400-e29b-41d4-a716-446655440001/banner.png"
                        .to_owned(),
                ),
                theme: ProfileTheme::Dark,
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
                    validate_profile_media_object_key(
                        value,
                        principal_id,
                        ProfileMediaTarget::Avatar,
                        "avatar_key",
                    )?;
                }

                profile.avatar_key = normalized;
            }

            if let Some(banner_key) = patch.banner_key {
                let normalized = banner_key.and_then(|value| {
                    let trimmed = value.trim().to_owned();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some(trimmed)
                    }
                });

                if let Some(value) = &normalized {
                    validate_profile_media_object_key(
                        value,
                        principal_id,
                        ProfileMediaTarget::Banner,
                        "banner_key",
                    )?;
                }

                profile.banner_key = normalized;
            }

            if let Some(theme) = patch.theme {
                profile.theme = match theme.trim() {
                    "dark" => ProfileTheme::Dark,
                    "light" => ProfileTheme::Light,
                    _ => return Err(ProfileError::validation("theme_invalid_value")),
                };
            }

            Ok(profile)
        }
    }

    #[async_trait]
    impl UserDirectoryService for StaticUserDirectoryService {
        async fn list_guild_members(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
        ) -> Result<Vec<GuildMemberDirectoryEntry>, UserDirectoryError> {
            if guild_id != 2001 {
                return Err(UserDirectoryError::guild_not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 && principal_id.0 != 1003 {
                return Err(UserDirectoryError::forbidden("guild_membership_required"));
            }

            Ok(vec![
                GuildMemberDirectoryEntry {
                    user_id: 1001,
                    display_name: "Alice".to_owned(),
                    avatar_key: None,
                    status_text: Some("Ready".to_owned()),
                    nickname: Some("alice-owner".to_owned()),
                    joined_at: "2026-03-01T00:00:00Z".to_owned(),
                    role_keys: vec!["owner".to_owned()],
                },
                GuildMemberDirectoryEntry {
                    user_id: 1003,
                    display_name: "Carol".to_owned(),
                    avatar_key: None,
                    status_text: Some("Reviewing".to_owned()),
                    nickname: None,
                    joined_at: "2026-03-02T00:00:00Z".to_owned(),
                    role_keys: vec!["member".to_owned()],
                },
            ])
        }

        async fn list_guild_roles(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
        ) -> Result<Vec<GuildRoleDirectoryEntry>, UserDirectoryError> {
            if guild_id != 2001 {
                return Err(UserDirectoryError::guild_not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 && principal_id.0 != 1003 {
                return Err(UserDirectoryError::forbidden("guild_membership_required"));
            }

            Ok(vec![
                GuildRoleDirectoryEntry {
                    role_key: "owner".to_owned(),
                    name: "Owner".to_owned(),
                    priority: 300,
                    allow_manage: true,
                    member_count: 1,
                },
                GuildRoleDirectoryEntry {
                    role_key: "member".to_owned(),
                    name: "Member".to_owned(),
                    priority: 100,
                    allow_manage: false,
                    member_count: 1,
                },
            ])
        }

        async fn get_user_profile(
            &self,
            principal_id: PrincipalId,
            user_id: i64,
        ) -> Result<UserProfileDirectoryEntry, UserDirectoryError> {
            if user_id == 9999 {
                return Err(UserDirectoryError::user_not_found("user_not_found"));
            }
            if principal_id.0 != user_id && principal_id.0 != 1001 && principal_id.0 != 1003 {
                return Err(UserDirectoryError::forbidden("shared_guild_required"));
            }

            Ok(UserProfileDirectoryEntry {
                user_id,
                display_name: if user_id == 1003 {
                    "Carol".to_owned()
                } else {
                    "Alice".to_owned()
                },
                status_text: Some("Ready".to_owned()),
                avatar_key: None,
                banner_key: None,
                created_at: "2026-03-01T00:00:00Z".to_owned(),
            })
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
    impl ProfileMediaService for StaticProfileMediaService {
        async fn issue_upload_url(
            &self,
            principal_id: PrincipalId,
            input: ProfileMediaUploadInput,
        ) -> Result<ProfileMediaUpload, ProfileError> {
            if principal_id.0 != 1001 {
                return Err(ProfileError::not_found("user_not_found"));
            }

            Ok(ProfileMediaUpload {
                target: input.target,
                object_key: format!(
                    "v0/tenant/default/user/{}/profile/{}/asset/550e8400-e29b-41d4-a716-446655440010/{}",
                    principal_id.0,
                    input.target.as_key_segment(),
                    input.filename.trim()
                ),
                upload_url: format!(
                    "https://storage.googleapis.com/profile-media/{}-upload",
                    input.target.as_key_segment()
                ),
                expires_at: "2026-03-08T12:00:00Z".to_owned(),
                method: "PUT".to_owned(),
                required_headers: std::collections::BTreeMap::from([(
                    "content-type".to_owned(),
                    input.content_type,
                )]),
            })
        }

        async fn issue_download_url(
            &self,
            principal_id: PrincipalId,
            target: ProfileMediaTarget,
        ) -> Result<ProfileMediaDownload, ProfileError> {
            if principal_id.0 != 1001 {
                return Err(ProfileError::not_found("user_not_found"));
            }

            Ok(ProfileMediaDownload {
                target,
                object_key: format!(
                    "v0/tenant/default/user/{}/profile/{}/asset/550e8400-e29b-41d4-a716-446655440011/file.png",
                    principal_id.0,
                    target.as_key_segment()
                ),
                download_url: format!(
                    "https://storage.googleapis.com/profile-media/{}-download",
                    target.as_key_segment()
                ),
                expires_at: "2026-03-08T12:00:00Z".to_owned(),
            })
        }
    }

    #[async_trait]
    impl ProfileMediaService for StaticUnavailableProfileMediaService {
        async fn issue_upload_url(
            &self,
            _principal_id: PrincipalId,
            _input: ProfileMediaUploadInput,
        ) -> Result<ProfileMediaUpload, ProfileError> {
            Err(ProfileError::media_dependency_unavailable(
                "profile_media_service_temporarily_unavailable",
            ))
        }

        async fn issue_download_url(
            &self,
            _principal_id: PrincipalId,
            _target: ProfileMediaTarget,
        ) -> Result<ProfileMediaDownload, ProfileError> {
            Err(ProfileError::media_dependency_unavailable(
                "profile_media_service_temporarily_unavailable",
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
            if principal_id.0 != 1001 && principal_id.0 != 9001 && principal_id.0 != 9002 {
                return Err(ModerationError::forbidden("moderation_role_required"));
            }
            if input.target_user_id <= 0 {
                return Err(ModerationError::validation(
                    "target_user_id_must_be_positive",
                ));
            }
            if input.target_user_id == 4040 {
                return Err(ModerationError::not_found("member_not_found"));
            }
            if input.target_user_id == 5003 {
                return Err(ModerationError::dependency_unavailable(
                    "moderation_store_temporarily_unavailable",
                ));
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
        async fn list_invites(
            &self,
            _principal_id: PrincipalId,
            guild_id: i64,
            channel_id: Option<i64>,
        ) -> Result<Vec<GuildInviteSummary>, InviteError> {
            if guild_id != 2001 {
                return Err(InviteError::not_found("guild_not_found"));
            }

            let invites = vec![
                GuildInviteSummary {
                    invite_code: "DEVJOIN2026".to_owned(),
                    channel: Some(InviteChannelSummary {
                        channel_id: 3001,
                        name: "general".to_owned(),
                    }),
                    creator: Some(InviteCreatorSummary {
                        user_id: 1001,
                        display_name: "Alice".to_owned(),
                    }),
                    expires_at: Some("2026-03-21T00:00:00Z".to_owned()),
                    uses: 3,
                    max_uses: Some(100),
                    created_at: "2026-03-14T00:00:00Z".to_owned(),
                },
                GuildInviteSummary {
                    invite_code: "OPENJOIN2026".to_owned(),
                    channel: Some(InviteChannelSummary {
                        channel_id: 3002,
                        name: "random".to_owned(),
                    }),
                    creator: None,
                    expires_at: None,
                    uses: 0,
                    max_uses: None,
                    created_at: "2026-03-13T00:00:00Z".to_owned(),
                },
            ];

            Ok(match channel_id {
                Some(channel_id) => invites
                    .into_iter()
                    .filter(|invite| invite.channel.as_ref().map(|channel| channel.channel_id) == Some(channel_id))
                    .collect(),
                None => invites,
            })
        }

        async fn create_invite(
            &self,
            _principal_id: PrincipalId,
            guild_id: i64,
            input: CreateInviteInput,
        ) -> Result<CreatedInvite, InviteError> {
            if guild_id != 2001 {
                return Err(InviteError::not_found("guild_not_found"));
            }
            if input.channel_id != 3001 {
                return Err(InviteError::channel_not_found("invite_channel_not_found"));
            }
            if input.max_age_seconds == Some(0) || input.max_uses == Some(0) {
                return Err(InviteError::validation("invite_limits_invalid"));
            }

            Ok(CreatedInvite {
                invite_code: "DEVCREATE2026".to_owned(),
                guild: PublicInviteGuild {
                    guild_id,
                    name: "LinkLynx Guild".to_owned(),
                    icon_key: None,
                },
                channel: InviteChannelSummary {
                    channel_id: input.channel_id,
                    name: "general".to_owned(),
                },
                expires_at: Some("2026-03-21T00:00:00Z".to_owned()),
                uses: 0,
                max_uses: input.max_uses,
            })
        }

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
                name: "LinkLynx Guild".to_owned(),
                icon_key: None,
            };

            match normalized_invite_code.as_str() {
                "DEVJOIN2026" => Ok(PublicInviteLookup {
                    status: PublicInviteStatus::Valid,
                    invite_code: normalized_invite_code,
                    guild: Some(guild),
                    channel: Some(InviteChannelSummary {
                        channel_id: 3001,
                        name: "general".to_owned(),
                    }),
                    expires_at: Some("2026-03-21T00:00:00Z".to_owned()),
                    uses: Some(3),
                    max_uses: Some(100),
                }),
                "EXPIRED2026" => Ok(PublicInviteLookup {
                    status: PublicInviteStatus::Expired,
                    invite_code: normalized_invite_code,
                    guild: Some(guild),
                    channel: Some(InviteChannelSummary {
                        channel_id: 3001,
                        name: "general".to_owned(),
                    }),
                    expires_at: Some("2026-03-01T00:00:00Z".to_owned()),
                    uses: Some(10),
                    max_uses: Some(10),
                }),
                "DISABLED2026" => Ok(PublicInviteLookup {
                    status: PublicInviteStatus::Invalid,
                    invite_code: normalized_invite_code,
                    guild: Some(guild),
                    channel: Some(InviteChannelSummary {
                        channel_id: 3001,
                        name: "general".to_owned(),
                    }),
                    expires_at: Some("2026-03-21T00:00:00Z".to_owned()),
                    uses: Some(3),
                    max_uses: Some(10),
                }),
                _ => Ok(PublicInviteLookup {
                    status: PublicInviteStatus::Invalid,
                    invite_code: normalized_invite_code,
                    guild: None,
                    channel: None,
                    expires_at: None,
                    uses: None,
                    max_uses: None,
                }),
            }
        }

        async fn join_invite(
            &self,
            _principal_id: PrincipalId,
            invite_code: String,
        ) -> Result<InviteJoinResult, InviteError> {
            let normalized_invite_code = invite_code.trim().to_owned();
            if normalized_invite_code.is_empty() {
                return Err(InviteError::validation("invite_code_required"));
            }

            match normalized_invite_code.as_str() {
                "DEVJOIN2026" => Ok(InviteJoinResult {
                    invite_code: normalized_invite_code,
                    guild_id: 2001,
                    channel: Some(InviteChannelSummary {
                        channel_id: 3001,
                        name: "general".to_owned(),
                    }),
                    status: InviteJoinStatus::Joined,
                }),
                "ALREADY2026" => Ok(InviteJoinResult {
                    invite_code: normalized_invite_code,
                    guild_id: 2001,
                    channel: Some(InviteChannelSummary {
                        channel_id: 3001,
                        name: "general".to_owned(),
                    }),
                    status: InviteJoinStatus::AlreadyMember,
                }),
                "EXPIRED2026" => Err(InviteError::expired_invite("invite_expired")),
                _ => Err(InviteError::invalid_invite("invite_invalid")),
            }
        }

        async fn revoke_invite(
            &self,
            _principal_id: PrincipalId,
            guild_id: i64,
            channel_id: Option<i64>,
            invite_code: String,
        ) -> Result<(), InviteError> {
            if guild_id != 2001 {
                return Err(InviteError::not_found("guild_not_found"));
            }
            if channel_id.is_some() && channel_id != Some(3001) {
                return Err(InviteError::invite_not_found("invite_not_found"));
            }

            match invite_code.trim() {
                "DEVJOIN2026" => Ok(()),
                "DISABLED2026" => Err(InviteError::invalid_invite("invite_invalid")),
                _ => Err(InviteError::invite_not_found("invite_not_found")),
            }
        }
    }

    #[async_trait]
    impl InviteService for StaticUnavailableInviteService {
        async fn list_invites(
            &self,
            _principal_id: PrincipalId,
            _guild_id: i64,
            _channel_id: Option<i64>,
        ) -> Result<Vec<GuildInviteSummary>, InviteError> {
            Err(InviteError::dependency_unavailable(
                "invite_store_unconfigured",
            ))
        }

        async fn create_invite(
            &self,
            _principal_id: PrincipalId,
            _guild_id: i64,
            _input: CreateInviteInput,
        ) -> Result<CreatedInvite, InviteError> {
            Err(InviteError::dependency_unavailable(
                "invite_store_unconfigured",
            ))
        }

        async fn verify_public_invite(
            &self,
            _invite_code: String,
        ) -> Result<PublicInviteLookup, InviteError> {
            Err(InviteError::dependency_unavailable(
                "invite_store_unconfigured",
            ))
        }

        async fn join_invite(
            &self,
            _principal_id: PrincipalId,
            _invite_code: String,
        ) -> Result<InviteJoinResult, InviteError> {
            Err(InviteError::dependency_unavailable(
                "invite_store_unconfigured",
            ))
        }

        async fn revoke_invite(
            &self,
            _principal_id: PrincipalId,
            _guild_id: i64,
            _channel_id: Option<i64>,
            _invite_code: String,
        ) -> Result<(), InviteError> {
            Err(InviteError::dependency_unavailable(
                "invite_store_unconfigured",
            ))
        }
    }

    async fn app_for_test() -> Router {
        let state = state_for_test_with_authorizer_and_profile_and_invite(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticProfileService),
            Arc::new(StaticInviteService),
            Arc::new(StaticModerationService),
        )
        .await;
        app_with_state(state)
    }

    async fn app_for_test_with_scylla_report(report: ScyllaHealthReport) -> Router {
        let state = state_for_test_with_authorizer_profile_media_invite_and_scylla(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticProfileService),
            Arc::new(StaticProfileMediaService),
            Arc::new(StaticInviteService),
            Arc::new(StaticScyllaHealthReporter { report }),
            Arc::new(StaticModerationService),
        )
        .await;
        app_with_state(state)
    }

    async fn app_for_test_with_authorizer(authorizer: Arc<dyn Authorizer>) -> Router {
        let state = state_for_test_with_authorizer_and_profile_and_invite(
            authorizer,
            Arc::new(StaticProfileService),
            Arc::new(StaticInviteService),
            Arc::new(StaticModerationService),
        )
        .await;
        app_with_state(state)
    }

    async fn app_for_test_with_authorizer_and_internal_ops_guard(
        authorizer: Arc<dyn Authorizer>,
        internal_ops_guard: InternalOpsGuard,
    ) -> Router {
        let mut state = state_for_test_with_authorizer(authorizer).await;
        state.internal_ops_guard = Arc::new(internal_ops_guard);
        app_with_state(state)
    }

    async fn app_for_test_with_public_invite_trusted_proxy_secret(
        shared_secret: &str,
    ) -> Router {
        let mut state = state_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        state.public_invite_trusted_proxy_shared_secret = Some(shared_secret.to_owned());
        app_with_state(state)
    }

    async fn app_for_test_with_authorizer_and_ws_identify_limit(
        authorizer: Arc<dyn Authorizer>,
        max_requests: u32,
    ) -> Router {
        let mut state = state_for_test_with_authorizer(authorizer).await;
        state.ws_identify_rate_limiter = Arc::new(FixedWindowRateLimiter::new(
            max_requests,
            Duration::from_secs(60),
        ));
        app_with_state(state)
    }

    async fn app_for_test_with_authorizer_and_moderation_service(
        authorizer: Arc<dyn Authorizer>,
        moderation_service: Arc<dyn ModerationService>,
    ) -> Router {
        let state = state_for_test_with_authorizer_and_profile_and_invite(
            authorizer,
            Arc::new(StaticProfileService),
            Arc::new(StaticInviteService),
            moderation_service,
        )
        .await;
        app_with_state(state)
    }

    async fn app_for_test_with_authorizer_and_token_verifier(
        authorizer: Arc<dyn Authorizer>,
        verifier: Arc<dyn TokenVerifier>,
    ) -> Router {
        let state = state_for_test_with_authorizer_and_token_verifier(authorizer, verifier).await;
        app_with_state(state)
    }

    async fn state_for_test_with_authorizer(authorizer: Arc<dyn Authorizer>) -> AppState {
        state_for_test_with_authorizer_and_profile_and_invite(
            authorizer,
            Arc::new(StaticProfileService),
            Arc::new(StaticInviteService),
            Arc::new(StaticModerationService),
        )
        .await
    }

    async fn state_for_test_with_authorizer_and_token_verifier(
        authorizer: Arc<dyn Authorizer>,
        verifier: Arc<dyn TokenVerifier>,
    ) -> AppState {
        state_for_test_with_authorizer_token_verifier_profile_invite_scylla_message_and_guild_channel(
            authorizer,
            verifier,
            Arc::new(StaticProfileService),
            Arc::new(StaticProfileMediaService),
            Arc::new(StaticInviteService),
            Arc::new(StaticScyllaHealthReporter {
                report: ScyllaHealthReport::ready(),
            }),
            Arc::new(StaticMessageService),
            Arc::new(StaticGuildChannelService),
            Arc::new(StaticModerationService),
        )
        .await
    }

    async fn state_for_test_with_authorizer_and_profile_and_invite(
        authorizer: Arc<dyn Authorizer>,
        profile_service: Arc<dyn ProfileService>,
        invite_service: Arc<dyn InviteService>,
        moderation_service: Arc<dyn ModerationService>,
    ) -> AppState {
        state_for_test_with_authorizer_profile_media_invite_scylla_and_message(
            authorizer,
            profile_service,
            Arc::new(StaticProfileMediaService),
            invite_service,
            Arc::new(StaticScyllaHealthReporter {
                report: ScyllaHealthReport::ready(),
            }),
            Arc::new(StaticMessageService),
            moderation_service,
        )
        .await
    }

    async fn state_for_test_with_authorizer_profile_media_invite_and_scylla(
        authorizer: Arc<dyn Authorizer>,
        profile_service: Arc<dyn ProfileService>,
        profile_media_service: Arc<dyn ProfileMediaService>,
        invite_service: Arc<dyn InviteService>,
        scylla_health_reporter: Arc<dyn ScyllaHealthReporter>,
        moderation_service: Arc<dyn ModerationService>,
    ) -> AppState {
        state_for_test_with_authorizer_profile_media_invite_scylla_and_message(
            authorizer,
            profile_service,
            profile_media_service,
            invite_service,
            scylla_health_reporter,
            Arc::new(StaticMessageService),
            moderation_service,
        )
        .await
    }

    async fn state_for_test_with_authorizer_profile_media_invite_scylla_and_message(
        authorizer: Arc<dyn Authorizer>,
        profile_service: Arc<dyn ProfileService>,
        profile_media_service: Arc<dyn ProfileMediaService>,
        invite_service: Arc<dyn InviteService>,
        scylla_health_reporter: Arc<dyn ScyllaHealthReporter>,
        message_service: Arc<dyn MessageService>,
        moderation_service: Arc<dyn ModerationService>,
    ) -> AppState {
        state_for_test_with_authorizer_profile_invite_scylla_message_and_guild_channel(
            authorizer,
            profile_service,
            profile_media_service,
            invite_service,
            scylla_health_reporter,
            message_service,
            Arc::new(StaticGuildChannelService),
            moderation_service,
        )
        .await
    }

    #[allow(clippy::too_many_arguments)]
    async fn state_for_test_with_authorizer_profile_invite_scylla_message_and_guild_channel(
        authorizer: Arc<dyn Authorizer>,
        profile_service: Arc<dyn ProfileService>,
        profile_media_service: Arc<dyn ProfileMediaService>,
        invite_service: Arc<dyn InviteService>,
        scylla_health_reporter: Arc<dyn ScyllaHealthReporter>,
        message_service: Arc<dyn MessageService>,
        guild_channel_service: Arc<dyn GuildChannelService>,
        moderation_service: Arc<dyn ModerationService>,
    ) -> AppState {
        state_for_test_with_authorizer_token_verifier_profile_invite_scylla_message_and_guild_channel(
            authorizer,
            Arc::new(StaticTokenVerifier),
            profile_service,
            profile_media_service,
            invite_service,
            scylla_health_reporter,
            message_service,
            guild_channel_service,
            moderation_service,
        )
        .await
    }

    #[allow(clippy::too_many_arguments)]
    async fn state_for_test_with_authorizer_token_verifier_profile_invite_scylla_message_and_guild_channel(
        authorizer: Arc<dyn Authorizer>,
        verifier: Arc<dyn TokenVerifier>,
        profile_service: Arc<dyn ProfileService>,
        profile_media_service: Arc<dyn ProfileMediaService>,
        invite_service: Arc<dyn InviteService>,
        scylla_health_reporter: Arc<dyn ScyllaHealthReporter>,
        message_service: Arc<dyn MessageService>,
        guild_channel_service: Arc<dyn GuildChannelService>,
        moderation_service: Arc<dyn ModerationService>,
    ) -> AppState {
        let metrics = Arc::new(AuthMetrics::default());

        let store = Arc::new(InMemoryPrincipalStore::default());
        store.insert("firebase", "u-1", PrincipalId(1001)).await;
        store.insert("firebase", "u-3", PrincipalId(1003)).await;
        store.insert("firebase", "u-owner", PrincipalId(9001)).await;
        store.insert("firebase", "u-admin", PrincipalId(9002)).await;
        store
            .insert("firebase", "u-member", PrincipalId(9003))
            .await;
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
            internal_ops_guard: Arc::new(InternalOpsGuard::with_shared_secret(
                TEST_INTERNAL_OPS_SECRET,
            )),
            guild_channel_service,
            dm_service: Arc::new(StaticDmService),
            invite_service,
            message_service,
            message_realtime_hub: Arc::new(MessageRealtimeHub::default()),
            moderation_service,
            profile_service,
            profile_media_service,
            user_directory_service: Arc::new(StaticUserDirectoryService),
            scylla_health_reporter,
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
            auth_attempt_rate_limiter: Arc::new(FixedWindowRateLimiter::new(
                20,
                Duration::from_secs(60),
            )),
            ws_origin_allowlist: Arc::new(WsOriginAllowlist::new(HashSet::from([
                "http://localhost:3000".to_owned(),
                "http://127.0.0.1:3000".to_owned(),
            ]))),
            http_allowed_origins: Arc::new(vec![
                "http://localhost:3000".parse().unwrap(),
                "http://127.0.0.1:3000".parse().unwrap(),
            ]),
            ws_query_ticket_enabled: false,
            ws_preauth_message_max_bytes: 16 * 1024,
            ws_preauth_limit: 100,
            ws_preauth_connections: Arc::new(Semaphore::new(100)),
            public_invite_trusted_proxy_shared_secret: None,
            rest_rate_limit_service: Arc::new(RestRateLimitService::new(
                RestRateLimitConfig::default(),
            )),
        }
    }

    async fn app_for_test_with_authorizer_and_profile(
        authorizer: Arc<dyn Authorizer>,
        profile_service: Arc<dyn ProfileService>,
    ) -> Router {
        let state = state_for_test_with_authorizer_and_profile_and_invite(
            authorizer,
            profile_service,
            Arc::new(StaticInviteService),
            Arc::new(StaticModerationService),
        )
        .await;
        app_with_state(state)
    }

    async fn app_for_test_with_authorizer_and_message_service(
        authorizer: Arc<dyn Authorizer>,
        message_service: Arc<dyn MessageService>,
    ) -> Router {
        let state = state_for_test_with_authorizer_profile_media_invite_scylla_and_message(
            authorizer,
            Arc::new(StaticProfileService),
            Arc::new(StaticProfileMediaService),
            Arc::new(StaticInviteService),
            Arc::new(StaticScyllaHealthReporter {
                report: ScyllaHealthReport::ready(),
            }),
            message_service,
            Arc::new(StaticModerationService),
        )
        .await;
        app_with_state(state)
    }

    async fn app_for_test_with_authorizer_and_message_and_guild_channel_service(
        authorizer: Arc<dyn Authorizer>,
        message_service: Arc<dyn MessageService>,
        guild_channel_service: Arc<dyn GuildChannelService>,
    ) -> Router {
        let state = state_for_test_with_authorizer_profile_invite_scylla_message_and_guild_channel(
            authorizer,
            Arc::new(StaticProfileService),
            Arc::new(StaticProfileMediaService),
            Arc::new(StaticInviteService),
            Arc::new(StaticScyllaHealthReporter {
                report: ScyllaHealthReport::ready(),
            }),
            message_service,
            guild_channel_service,
            Arc::new(StaticModerationService),
        )
        .await;
        app_with_state(state)
    }

    async fn app_for_test_with_authorizer_profile_and_media(
        authorizer: Arc<dyn Authorizer>,
        profile_service: Arc<dyn ProfileService>,
        profile_media_service: Arc<dyn ProfileMediaService>,
    ) -> Router {
        let state = state_for_test_with_authorizer_profile_media_invite_and_scylla(
            authorizer,
            profile_service,
            profile_media_service,
            Arc::new(StaticInviteService),
            Arc::new(StaticScyllaHealthReporter {
                report: ScyllaHealthReport::ready(),
            }),
            Arc::new(StaticModerationService),
        )
        .await;
        app_with_state(state)
    }

    async fn app_for_test_with_invite_service(invite_service: Arc<dyn InviteService>) -> Router {
        let state = state_for_test_with_authorizer_and_profile_and_invite(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticProfileService),
            invite_service,
            Arc::new(StaticModerationService),
        )
        .await;
        app_with_state(state)
    }

    async fn connect_test_ws(authorizer: Arc<dyn Authorizer>) -> (TestWsStream, JoinHandle<()>) {
        let app = app_for_test_with_authorizer(authorizer).await;
        let (address, server) = spawn_test_server(app).await;
        let socket = connect_test_ws_at(address, "u-1").await;
        (socket, server)
    }

    async fn spawn_test_server(app: Router) -> (SocketAddr, JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .unwrap_or_else(|error| panic!("failed to bind test listener: {error}"));
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
                .await
                .unwrap();
        });
        (address, server)
    }

    fn ws_upgrade_request(path: &str, authorization: Option<&str>) -> Request<Body> {
        let mut builder = Request::builder()
            .method("GET")
            .uri(path)
            .header("host", "localhost")
            .header("connection", "Upgrade")
            .header("upgrade", "websocket")
            .header("sec-websocket-version", "13")
            .header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==")
            .header(ORIGIN, "http://localhost:3000");
        if let Some(authorization) = authorization {
            builder = builder.header(AUTHORIZATION, authorization);
        }
        builder.body(Body::empty()).unwrap()
    }
    async fn connect_test_ws_with_authorization(
        address: SocketAddr,
        authorization: Option<&str>,
    ) -> TestWsStream {
        let mut request = format!("ws://{address}/ws").into_client_request().unwrap();
        request
            .headers_mut()
            .insert(ORIGIN, "http://localhost:3000".parse().unwrap());
        if let Some(authorization) = authorization {
            request
                .headers_mut()
                .insert(AUTHORIZATION, authorization.parse().unwrap());
        }

        let (socket, _) = connect_async(request).await.unwrap();
        socket
    }

    async fn connect_test_ws_without_authorization(
        address: SocketAddr,
        origin: Option<&str>,
    ) -> TestWsStream {
        let mut request = format!("ws://{address}/ws").into_client_request().unwrap();
        if let Some(origin) = origin {
            request
                .headers_mut()
                .insert(ORIGIN, origin.parse().unwrap());
        }

        let (socket, _) = connect_async(request).await.unwrap();
        socket
    }

    async fn connect_test_ws_at(address: SocketAddr, uid: &str) -> TestWsStream {
        let token = format!("{uid}:{}", unix_timestamp_seconds() + 300);
        connect_test_ws_with_authorization(address, Some(&format!("Bearer {token}"))).await
    }

    async fn issue_test_ws_ticket(address: SocketAddr, uid: &str) -> String {
        let token = format!("{uid}:{}", unix_timestamp_seconds() + 300);
        let response = reqwest::Client::new()
            .post(format!("http://{address}/auth/ws-ticket"))
            .header("authorization", format!("Bearer {token}"))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), reqwest::StatusCode::OK);
        let json = response.json::<serde_json::Value>().await.unwrap();
        json["ticket"].as_str().unwrap().to_owned()
    }

    async fn send_identify_ticket(socket: &mut TestWsStream, ticket: &str) {
        let payload = serde_json::json!({
            "type": "auth.identify",
            "d": {
                "method": "ticket",
                "ticket": ticket,
            }
        })
        .to_string();
        socket
            .send(WsClientMessage::Text(payload.into()))
            .await
            .unwrap();
    }

    async fn expect_ws_json_message(socket: &mut TestWsStream) -> serde_json::Value {
        loop {
            let response = timeout(Duration::from_secs(2), socket.next())
                .await
                .unwrap()
                .unwrap()
                .unwrap();
            match response {
                WsClientMessage::Text(text) => {
                    return serde_json::from_str::<serde_json::Value>(&text).unwrap();
                }
                WsClientMessage::Ping(_) | WsClientMessage::Pong(_) => continue,
                other => panic!("expected text frame, got {other:?}"),
            }
        }
    }

    async fn expect_ws_close_reason(socket: &mut TestWsStream) -> (CloseCode, String) {
        let response = timeout(Duration::from_secs(2), socket.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        match response {
            WsClientMessage::Close(Some(frame)) => (frame.code, frame.reason.to_string()),
            other => panic!("expected close frame, got {other:?}"),
        }
    }

    async fn subscribe_test_channel(
        socket: &mut TestWsStream,
        guild_id: i64,
        channel_id: i64,
    ) -> ServerMessageFrameV1 {
        let frame = ClientMessageFrameV1::Subscribe(GuildChannelSubscriptionTargetV1 {
            guild_id,
            channel_id,
        });
        let payload = serde_json::to_string(&frame).unwrap();
        socket
            .send(WsClientMessage::Text(payload.into()))
            .await
            .unwrap();
        next_server_message_frame(socket).await
    }

    async fn unsubscribe_test_channel(
        socket: &mut TestWsStream,
        guild_id: i64,
        channel_id: i64,
    ) -> ServerMessageFrameV1 {
        let frame = ClientMessageFrameV1::Unsubscribe(GuildChannelSubscriptionTargetV1 {
            guild_id,
            channel_id,
        });
        let payload = serde_json::to_string(&frame).unwrap();
        socket
            .send(WsClientMessage::Text(payload.into()))
            .await
            .unwrap();
        next_server_message_frame(socket).await
    }

    async fn subscribe_test_dm(socket: &mut TestWsStream, channel_id: i64) -> ServerMessageFrameV1 {
        let frame = ClientMessageFrameV1::DmSubscribe(DmChannelSubscriptionTargetV1 {
            channel_id,
        });
        let payload = serde_json::to_string(&frame).unwrap();
        socket
            .send(WsClientMessage::Text(payload.into()))
            .await
            .unwrap();
        next_server_message_frame(socket).await
    }

    async fn next_server_message_frame(socket: &mut TestWsStream) -> ServerMessageFrameV1 {
        loop {
            let response = timeout(Duration::from_secs(2), socket.next())
                .await
                .unwrap()
                .unwrap()
                .unwrap();
            match response {
                WsClientMessage::Text(text) => {
                    return serde_json::from_str::<ServerMessageFrameV1>(&text).unwrap();
                }
                WsClientMessage::Ping(_) | WsClientMessage::Pong(_) => continue,
                other => panic!("expected text frame, got {other:?}"),
            }
        }
    }

    async fn post_test_channel_message(
        address: SocketAddr,
        uid: &str,
        guild_id: i64,
        channel_id: i64,
        content: &str,
        idempotency_key: Option<&str>,
    ) -> reqwest::Response {
        let token = format!("{uid}:{}", unix_timestamp_seconds() + 300);
        let client = reqwest::Client::new();
        let mut request = client
            .post(format!(
                "http://{address}/v1/guilds/{guild_id}/channels/{channel_id}/messages"
            ))
            .header("authorization", format!("Bearer {token}"))
            .header("content-type", "application/json")
            .body(serde_json::json!({ "content": content }).to_string());
        if let Some(idempotency_key) = idempotency_key {
            request = request.header("Idempotency-Key", idempotency_key);
        }
        request.send().await.unwrap()
    }

    async fn post_test_dm_message(
        address: SocketAddr,
        uid: &str,
        channel_id: i64,
        content: &str,
        idempotency_key: Option<&str>,
    ) -> reqwest::Response {
        let token = format!("{uid}:{}", unix_timestamp_seconds() + 300);
        let client = reqwest::Client::new();
        let mut request = client
            .post(format!("http://{address}/v1/dms/{channel_id}/messages"))
            .header("authorization", format!("Bearer {token}"))
            .header("content-type", "application/json")
            .body(serde_json::json!({ "content": content }).to_string());
        if let Some(idempotency_key) = idempotency_key {
            request = request.header("Idempotency-Key", idempotency_key);
        }
        request.send().await.unwrap()
    }

    async fn patch_test_channel_message(
        address: SocketAddr,
        uid: &str,
        guild_id: i64,
        channel_id: i64,
        message_id: i64,
        content: &str,
        expected_version: i64,
    ) -> reqwest::Response {
        let token = format!("{uid}:{}", unix_timestamp_seconds() + 300);
        reqwest::Client::new()
            .patch(format!(
                "http://{address}/v1/guilds/{guild_id}/channels/{channel_id}/messages/{message_id}"
            ))
            .header("authorization", format!("Bearer {token}"))
            .header("content-type", "application/json")
            .body(
                serde_json::json!({
                    "content": content,
                    "expected_version": expected_version
                })
                .to_string(),
            )
            .send()
            .await
            .unwrap()
    }

    async fn delete_test_channel_message(
        address: SocketAddr,
        uid: &str,
        guild_id: i64,
        channel_id: i64,
        message_id: i64,
        expected_version: i64,
    ) -> reqwest::Response {
        let token = format!("{uid}:{}", unix_timestamp_seconds() + 300);
        reqwest::Client::new()
            .delete(format!(
                "http://{address}/v1/guilds/{guild_id}/channels/{channel_id}/messages/{message_id}"
            ))
            .header("authorization", format!("Bearer {token}"))
            .header("content-type", "application/json")
            .body(
                serde_json::json!({
                    "expected_version": expected_version
                })
                .to_string(),
            )
            .send()
            .await
            .unwrap()
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
    async fn scylla_health_ready_returns_ok_json() {
        let app = app_for_test_with_scylla_report(ScyllaHealthReport::ready()).await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/scylla/health")
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
        assert_eq!(json["service"], "scylla");
        assert_eq!(json["status"], "ready");
        assert!(json.get("reason").is_none());
    }

    #[tokio::test]
    async fn scylla_health_degraded_returns_ok_json() {
        let app = app_for_test_with_scylla_report(ScyllaHealthReport::degraded(
            "scylla_table_missing:chat.messages_by_channel",
        ))
        .await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/scylla/health")
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
        assert_eq!(json["status"], "degraded");
        assert_eq!(json["reason"], "table_missing");
    }

    #[tokio::test]
    async fn scylla_health_error_returns_service_unavailable() {
        let app = app_for_test_with_scylla_report(ScyllaHealthReport::error(
            "scylla_connect_failed:connection refused",
        ))
        .await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/scylla/health")
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
        assert_eq!(json["status"], "error");
        assert_eq!(json["reason"], "connect_failed");
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
    async fn list_guild_invites_returns_active_invites_for_valid_request() {
        let app = app_for_test().await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/2001/invites")
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
        assert_eq!(json["invites"][0]["invite_code"], "DEVJOIN2026");
        assert_eq!(json["invites"][0]["channel"]["channel_id"], 3001);
        assert_eq!(json["invites"][0]["channel"]["name"], "general");
        assert_eq!(json["invites"][0]["creator"]["display_name"], "Alice");
        assert_eq!(json["invites"][1]["channel"]["channel_id"], 3002);
        assert_eq!(json["invites"][1]["creator"], serde_json::Value::Null);
    }

    #[tokio::test]
    async fn list_guild_invites_filters_by_channel_query_when_present() {
        let app = app_for_test().await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/2001/invites?channel_id=3001")
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
        assert_eq!(json["invites"].as_array().unwrap().len(), 1);
        assert_eq!(json["invites"][0]["channel"]["channel_id"], 3001);
        assert_eq!(json["invites"][0]["channel"]["name"], "general");
    }

    #[tokio::test]
    async fn list_guild_invites_returns_service_unavailable_when_invite_service_fails() {
        let app = app_for_test_with_invite_service(Arc::new(StaticUnavailableInviteService)).await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/2001/invites")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "invite-list-unavailable-test")
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
        assert_eq!(json["request_id"], "invite-list-unavailable-test");
    }

    #[tokio::test]
    async fn list_guild_invites_returns_retry_after_when_rate_limited() {
        let app = app_for_test().await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let mut last_response = None;

        for _ in 0..11 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .uri("/v1/guilds/2001/invites")
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
    async fn create_guild_invite_returns_created_for_valid_request() {
        let app = app_for_test().await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/guilds/2001/invites")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"channel_id":3001,"max_age_seconds":3600,"max_uses":5}"#,
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
        assert_eq!(json["invite"]["invite_code"], "DEVCREATE2026");
        assert_eq!(json["invite"]["guild"]["guild_id"], 2001);
        assert_eq!(json["invite"]["channel"]["channel_id"], 3001);
        assert_eq!(json["invite"]["max_uses"], 5);
    }

    #[tokio::test]
    async fn create_guild_invite_rejects_malformed_json() {
        let app = app_for_test().await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/guilds/2001/invites")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"channel_id":"oops"}"#))
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
    async fn create_guild_invite_returns_service_unavailable_when_invite_service_fails() {
        let app = app_for_test_with_invite_service(Arc::new(StaticUnavailableInviteService)).await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/guilds/2001/invites")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "invite-create-unavailable-test")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"channel_id":3001}"#))
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
        assert_eq!(json["request_id"], "invite-create-unavailable-test");
    }

    #[tokio::test]
    async fn revoke_guild_invite_returns_no_content_for_valid_request() {
        let app = app_for_test().await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::DELETE)
                    .uri("/v1/guilds/2001/invites/DEVJOIN2026")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn revoke_guild_invite_accepts_channel_query_when_present() {
        let app = app_for_test().await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::DELETE)
                    .uri("/v1/guilds/2001/invites/DEVJOIN2026?channel_id=3001")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn revoke_guild_invite_returns_not_found_for_missing_invite() {
        let app = app_for_test().await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::DELETE)
                    .uri("/v1/guilds/2001/invites/UNKNOWN2026")
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
        assert_eq!(json["code"], "INVITE_NOT_FOUND");
    }

    #[tokio::test]
    async fn revoke_guild_invite_returns_conflict_for_invalid_invite() {
        let app = app_for_test().await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::DELETE)
                    .uri("/v1/guilds/2001/invites/DISABLED2026")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CONFLICT);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "INVITE_INVALID");
    }

    #[tokio::test]
    async fn revoke_guild_invite_returns_service_unavailable_when_invite_service_fails() {
        let app = app_for_test_with_invite_service(Arc::new(StaticUnavailableInviteService)).await;
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::DELETE)
                    .uri("/v1/guilds/2001/invites/DEVJOIN2026")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "invite-revoke-unavailable-test")
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
        assert_eq!(json["request_id"], "invite-revoke-unavailable-test");
    }

    #[tokio::test]
    async fn revoke_guild_invite_fail_closes_when_ratelimit_degraded() {
        let state = state_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        state
            .rest_rate_limit_service
            .set_degraded_for_test(true)
            .await;
        let app = app_with_state(state);
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);

        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::DELETE)
                    .uri("/v1/guilds/2001/invites/DEVJOIN2026")
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
        let retry_after = response
            .headers()
            .get(RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .unwrap();
        let retry_after_seconds = retry_after.parse::<u64>().unwrap();
        assert!((1..=60).contains(&retry_after_seconds));
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
    async fn public_invite_endpoint_uses_trusted_client_scope_rate_limit_keys() {
        let app = app_for_test_with_public_invite_trusted_proxy_secret(
            TEST_PUBLIC_INVITE_TRUSTED_PROXY_SECRET,
        )
        .await;
        let mut last_primary_response = None;

        for _ in 0..11 {
            last_primary_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .uri("/v1/invites/DEVJOIN2026")
                            .header(
                                PUBLIC_INVITE_TRUSTED_PROXY_SECRET_HEADER,
                                TEST_PUBLIC_INVITE_TRUSTED_PROXY_SECRET,
                            )
                            .header(PUBLIC_INVITE_CLIENT_SCOPE_HEADER, "client-a")
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap(),
            );
        }

        let primary_response = last_primary_response.unwrap();
        assert_eq!(primary_response.status(), StatusCode::TOO_MANY_REQUESTS);

        let secondary_response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/invites/DEVJOIN2026")
                    .header(
                        PUBLIC_INVITE_TRUSTED_PROXY_SECRET_HEADER,
                        TEST_PUBLIC_INVITE_TRUSTED_PROXY_SECRET,
                    )
                    .header(PUBLIC_INVITE_CLIENT_SCOPE_HEADER, "client-b")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(secondary_response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn public_invite_endpoint_rejects_spoofed_client_scope_when_proxy_secret_is_invalid() {
        let app = app_for_test_with_public_invite_trusted_proxy_secret(
            TEST_PUBLIC_INVITE_TRUSTED_PROXY_SECRET,
        )
        .await;
        let mut last_response = None;

        for index in 0..11 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .uri(format!("/v1/invites/SPOOF{index}"))
                            .header(PUBLIC_INVITE_TRUSTED_PROXY_SECRET_HEADER, "wrong-secret")
                            .header(
                                PUBLIC_INVITE_CLIENT_SCOPE_HEADER,
                                format!("spoofed-client-{index}"),
                            )
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
        state
            .rest_rate_limit_service
            .set_degraded_for_test(true)
            .await;
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
        let retry_after = response
            .headers()
            .get(RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .unwrap();
        let retry_after_seconds = retry_after.parse::<u64>().unwrap();
        assert!((1..=60).contains(&retry_after_seconds));
    }

    #[tokio::test]
    async fn public_invite_endpoint_fail_closes_when_ratelimit_degraded_for_trusted_scope() {
        let mut state = state_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        state.public_invite_trusted_proxy_shared_secret =
            Some(TEST_PUBLIC_INVITE_TRUSTED_PROXY_SECRET.to_owned());
        state
            .rest_rate_limit_service
            .set_degraded_for_test(true)
            .await;
        let app = app_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/invites/DEVJOIN2026")
                    .header(
                        PUBLIC_INVITE_TRUSTED_PROXY_SECRET_HEADER,
                        TEST_PUBLIC_INVITE_TRUSTED_PROXY_SECRET,
                    )
                    .header(PUBLIC_INVITE_CLIENT_SCOPE_HEADER, "client-a")
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
    async fn invite_join_endpoint_rejects_missing_token() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/invites/DEVJOIN2026/join")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn invite_join_endpoint_accepts_valid_token_without_authz_membership() {
        let app = app_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/invites/DEVJOIN2026/join")
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
        assert_eq!(json["join"]["status"], "joined");
        assert_eq!(json["join"]["guild_id"], 2001);
    }

    #[tokio::test]
    async fn invite_join_endpoint_returns_already_member_for_duplicate_join() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/invites/ALREADY2026/join")
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
        assert_eq!(json["join"]["status"], "already_member");
        assert_eq!(json["join"]["guild_id"], 2001);
    }

    #[tokio::test]
    async fn invite_join_endpoint_returns_conflict_for_expired_invite() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/invites/EXPIRED2026/join")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CONFLICT);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "INVITE_EXPIRED");
    }

    #[tokio::test]
    async fn invite_join_endpoint_returns_conflict_for_invalid_invite() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/invites/UNKNOWN2026/join")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CONFLICT);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "INVITE_INVALID");
    }

    #[tokio::test]
    async fn invite_join_endpoint_returns_service_unavailable_when_invite_service_fails() {
        let app = app_for_test_with_invite_service(Arc::new(StaticUnavailableInviteService)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/invites/DEVJOIN2026/join")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "invite-join-unavailable-test")
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
        assert_eq!(json["request_id"], "invite-join-unavailable-test");
    }

    #[tokio::test]
    async fn dm_list_endpoint_requires_authentication() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/users/me/dms")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn dm_list_endpoint_denies_when_rest_authz_denies() {
        let app = app_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/users/me/dms")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn dm_open_or_create_endpoint_denies_when_rest_authz_denies() {
        let app = app_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/users/me/dms")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"recipient_id":1002}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn invite_join_endpoint_returns_retry_after_when_rate_limited() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let mut last_response = None;

        for _ in 0..11 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .method(Method::POST)
                            .uri("/v1/invites/DEVJOIN2026/join")
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
        let retry_after = response
            .headers()
            .get(RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .unwrap();
        let retry_after_seconds = retry_after.parse::<u64>().unwrap();
        assert!((1..=60).contains(&retry_after_seconds));
    }

    #[tokio::test]
    async fn invite_join_endpoint_uses_principal_scoped_rate_limit() {
        let app = app_for_test().await;
        let primary_token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let secondary_token = format!("u-3:{}", unix_timestamp_seconds() + 300);
        let mut last_primary_response = None;

        for _ in 0..11 {
            last_primary_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .method(Method::POST)
                            .uri("/v1/invites/DEVJOIN2026/join")
                            .header("authorization", format!("Bearer {primary_token}"))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap(),
            );
        }

        let primary_response = last_primary_response.unwrap();
        assert_eq!(primary_response.status(), StatusCode::TOO_MANY_REQUESTS);

        let secondary_response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/invites/DEVJOIN2026/join")
                    .header("authorization", format!("Bearer {secondary_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(secondary_response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn invite_join_endpoint_fail_closes_when_ratelimit_degraded() {
        let state = state_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        state
            .rest_rate_limit_service
            .set_degraded_for_test(true)
            .await;
        let app = app_with_state(state);
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);

        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/invites/DEVJOIN2026/join")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        let retry_after = response
            .headers()
            .get(RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .unwrap();
        let retry_after_seconds = retry_after.parse::<u64>().unwrap();
        assert!((1..=60).contains(&retry_after_seconds));
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
    async fn auth_metrics_endpoint_rejects_missing_internal_secret() {
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

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn auth_metrics_endpoint_rejects_bearer_token_without_internal_secret() {
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

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "INTERNAL_OPS_FORBIDDEN");
    }

    #[tokio::test]
    async fn auth_metrics_endpoint_accepts_valid_internal_secret() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/auth/metrics")
                    .header(
                        INTERNAL_OPS_SHARED_SECRET_HEADER,
                        TEST_INTERNAL_OPS_SECRET,
                    )
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
    async fn auth_metrics_endpoint_returns_unavailable_when_internal_secret_is_unconfigured() {
        let app = app_for_test_with_authorizer_and_internal_ops_guard(
            Arc::new(StaticAllowAllAuthorizer),
            InternalOpsGuard {
                shared_secret: None,
            },
        )
        .await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/auth/metrics")
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
        assert_eq!(json["code"], "INTERNAL_OPS_UNAVAILABLE");
    }

    #[tokio::test]
    async fn internal_authz_metrics_endpoint_rejects_missing_internal_secret() {
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

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn internal_authz_metrics_endpoint_accepts_valid_internal_secret() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
                    .header(
                        INTERNAL_OPS_SHARED_SECRET_HEADER,
                        TEST_INTERNAL_OPS_SECRET,
                    )
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
    async fn internal_authz_metrics_endpoint_returns_unavailable_when_internal_secret_is_unconfigured(
    ) {
        let app = app_for_test_with_authorizer_and_internal_ops_guard(
            Arc::new(StaticAllowAllAuthorizer),
            InternalOpsGuard {
                shared_secret: None,
            },
        )
        .await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
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
        assert_eq!(json["code"], "INTERNAL_OPS_UNAVAILABLE");
    }

    #[tokio::test]
    async fn internal_authz_metrics_endpoint_ignores_rest_authz_denied() {
        let app = app_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
                    .header(
                        INTERNAL_OPS_SHARED_SECRET_HEADER,
                        TEST_INTERNAL_OPS_SECRET,
                    )
                    .header("x-request-id", "internal-authz-metrics-ops")
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
    }

    #[tokio::test]
    async fn internal_authz_metrics_endpoint_ignores_rest_authz_unavailable() {
        let app = app_for_test_with_authorizer(Arc::new(StaticUnavailableAuthorizer)).await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
                    .header(
                        INTERNAL_OPS_SHARED_SECRET_HEADER,
                        TEST_INTERNAL_OPS_SECRET,
                    )
                    .header("x-request-id", "internal-authz-metrics-ops")
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
        assert!(json.get("unavailable_total").is_some());
    }

    #[tokio::test]
    async fn internal_authz_cache_invalidate_rejects_bearer_token_without_internal_secret() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/internal/authz/cache/invalidate")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"kind":"guild_role_changed","guild_id":10}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "INTERNAL_OPS_FORBIDDEN");
    }

    #[tokio::test]
    async fn internal_authz_cache_invalidate_accepts_valid_internal_secret() {
        let app = app_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/internal/authz/cache/invalidate")
                    .header(
                        INTERNAL_OPS_SHARED_SECRET_HEADER,
                        TEST_INTERNAL_OPS_SECRET,
                    )
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"kind":"guild_role_changed","guild_id":10}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["evictedKeys"], 0);
    }

    #[tokio::test]
    async fn internal_authz_cache_invalidate_rejects_malformed_json() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/internal/authz/cache/invalidate")
                    .header(
                        INTERNAL_OPS_SHARED_SECRET_HEADER,
                        TEST_INTERNAL_OPS_SECRET,
                    )
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"kind":"guild_role_changed""#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_CACHE_INVALIDATION_INVALID");
    }

    #[tokio::test]
    async fn internal_authz_cache_invalidate_rejects_unknown_kind() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/internal/authz/cache/invalidate")
                    .header(
                        INTERNAL_OPS_SHARED_SECRET_HEADER,
                        TEST_INTERNAL_OPS_SECRET,
                    )
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"kind":"unexpected_kind","guild_id":10}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_CACHE_INVALIDATION_INVALID");
    }

    #[tokio::test]
    async fn internal_authz_cache_invalidate_rejects_missing_required_field() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/internal/authz/cache/invalidate")
                    .header(
                        INTERNAL_OPS_SHARED_SECRET_HEADER,
                        TEST_INTERNAL_OPS_SECRET,
                    )
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"kind":"guild_role_changed"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_CACHE_INVALIDATION_INVALID");
    }

    #[tokio::test]
    async fn internal_authz_metrics_preflight_does_not_expose_browser_cors_headers() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/internal/authz/metrics")
                    .header(ORIGIN, "https://evil.example")
                    .header(ACCESS_CONTROL_REQUEST_METHOD, "GET")
                    .header(
                        ACCESS_CONTROL_REQUEST_HEADERS,
                        INTERNAL_OPS_SHARED_SECRET_HEADER,
                    )
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert!(!response.headers().contains_key("access-control-allow-origin"));
        assert!(!response.headers().contains_key("access-control-allow-headers"));
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

        assert!(
            authorize_ws_stream_access(&state, &authenticated, "ws-test")
                .await
                .is_ok()
        );
    }

    #[tokio::test]
    async fn message_frame_access_denies_when_target_channel_is_forbidden() {
        let state =
            state_for_test_with_authorizer(Arc::new(StreamAllowedGuildChannelDeniedAuthorizer))
                .await;
        let authenticated = AuthenticatedPrincipal {
            principal_id: PrincipalId(9003),
            firebase_uid: "u-member".to_owned(),
            expires_at_epoch: unix_timestamp_seconds() + 300,
        };
        let frame = ClientMessageFrameV1::Subscribe(GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        });

        let error = authorize_message_frame_access(&state, &authenticated, "ws-test", &frame)
            .await
            .unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::Denied);
    }

    #[tokio::test]
    async fn message_frame_access_denies_when_ws_stream_is_forbidden() {
        let state =
            state_for_test_with_authorizer(Arc::new(StreamDeniedGuildChannelAllowedAuthorizer))
                .await;
        let authenticated = AuthenticatedPrincipal {
            principal_id: PrincipalId(9003),
            firebase_uid: "u-member".to_owned(),
            expires_at_epoch: unix_timestamp_seconds() + 300,
        };
        let frame = ClientMessageFrameV1::Subscribe(GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        });

        let error = authorize_message_frame_access(&state, &authenticated, "ws-test", &frame)
            .await
            .unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::Denied);
    }

    #[tokio::test]
    async fn message_frame_access_records_allow_for_each_authz_check() {
        let state = state_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        let authenticated = AuthenticatedPrincipal {
            principal_id: PrincipalId(9003),
            firebase_uid: "u-member".to_owned(),
            expires_at_epoch: unix_timestamp_seconds() + 300,
        };
        let frame = ClientMessageFrameV1::Subscribe(GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        });

        assert!(
            authorize_message_frame_access(&state, &authenticated, "ws-test", &frame)
                .await
                .is_ok()
        );
        let metrics = state.authz_metrics.snapshot();
        let value = serde_json::to_value(metrics).unwrap();
        assert_eq!(value["allow_total"], 2);
        assert_eq!(value["deny_total"], 0);
        assert_eq!(value["unavailable_total"], 0);
    }

    #[tokio::test]
    async fn dm_message_frame_access_allows_when_target_channel_is_allowed() {
        let state = state_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        let authenticated = AuthenticatedPrincipal {
            principal_id: PrincipalId(9003),
            firebase_uid: "u-member".to_owned(),
            expires_at_epoch: unix_timestamp_seconds() + 300,
        };
        let frame = ClientMessageFrameV1::DmSubscribe(DmChannelSubscriptionTargetV1 {
            channel_id: 55,
        });

        assert!(
            authorize_message_frame_access(&state, &authenticated, "ws-test", &frame)
                .await
                .is_ok()
        );
    }

    #[tokio::test]
    async fn message_frame_access_returns_unavailable_when_ws_stream_is_unavailable() {
        let state = state_for_test_with_authorizer(Arc::new(
            StreamUnavailableGuildChannelAllowedAuthorizer,
        ))
        .await;
        let authenticated = AuthenticatedPrincipal {
            principal_id: PrincipalId(9003),
            firebase_uid: "u-member".to_owned(),
            expires_at_epoch: unix_timestamp_seconds() + 300,
        };
        let frame = ClientMessageFrameV1::Subscribe(GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        });

        let error = authorize_message_frame_access(&state, &authenticated, "ws-test", &frame)
            .await
            .unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::DependencyUnavailable);
        assert_eq!(error.ws_close_code(), 1011);
    }

    #[tokio::test]
    async fn message_frame_access_returns_unavailable_when_target_channel_is_unavailable() {
        let state = state_for_test_with_authorizer(Arc::new(
            StreamAllowedGuildChannelUnavailableAuthorizer,
        ))
        .await;
        let authenticated = AuthenticatedPrincipal {
            principal_id: PrincipalId(9003),
            firebase_uid: "u-member".to_owned(),
            expires_at_epoch: unix_timestamp_seconds() + 300,
        };
        let frame = ClientMessageFrameV1::Subscribe(GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        });

        let error = authorize_message_frame_access(&state, &authenticated, "ws-test", &frame)
            .await
            .unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::DependencyUnavailable);
        assert_eq!(error.ws_close_code(), 1011);
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
            principal_ids
                .iter()
                .all(|principal_id| *principal_id == expected),
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
    async fn permission_snapshot_returns_guild_and_channel_flags_for_member() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/2001/permission-snapshot?channel_id=3001")
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
        assert_eq!(json["snapshot"]["guild_id"], 2001);
        assert_eq!(json["snapshot"]["channel_id"], 3001);
        assert_eq!(json["snapshot"]["guild"]["can_view"], true);
        assert_eq!(json["snapshot"]["guild"]["can_create_channel"], false);
        assert_eq!(json["snapshot"]["guild"]["can_create_invite"], false);
        assert_eq!(json["snapshot"]["guild"]["can_manage_settings"], false);
        assert_eq!(json["snapshot"]["guild"]["can_moderate"], false);
        assert_eq!(json["snapshot"]["channel"]["can_view"], true);
        assert_eq!(json["snapshot"]["channel"]["can_post"], true);
        assert_eq!(json["snapshot"]["channel"]["can_manage"], false);
    }

    #[tokio::test]
    async fn permission_snapshot_returns_unavailable_when_downstream_authz_is_unavailable() {
        let app =
            app_for_test_with_authorizer(Arc::new(PermissionSnapshotUnavailableAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/2001/permission-snapshot")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "permission-snapshot-unavailable")
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
        assert_eq!(json["request_id"], "permission-snapshot-unavailable");
    }

    #[test]
    fn permission_snapshot_audit_fields_include_principal_guild_and_channel_scope() {
        let auth_context = AuthContext {
            request_id: "req-permission".to_owned(),
            principal_id: PrincipalId(1001),
            firebase_uid: "u-member".to_owned(),
        };

        assert_eq!(
            permission_snapshot_audit_fields(&auth_context, 2001, Some(3001)),
            PermissionSnapshotAuditFields {
                principal_id: 1001,
                guild_id: 2001,
                channel_id: Some(3001),
                action: "view",
                resource: "permission_snapshot",
                decision_source: "permission_snapshot_handler",
            }
        );
        assert_eq!(
            permission_snapshot_audit_fields(&auth_context, 2001, None),
            PermissionSnapshotAuditFields {
                principal_id: 1001,
                guild_id: 2001,
                channel_id: None,
                action: "view",
                resource: "permission_snapshot",
                decision_source: "permission_snapshot_handler",
            }
        );
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
    async fn list_guild_channels_returns_hierarchy_aware_contract_fields() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/2001/channels")
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
        assert_eq!(json["channels"][0]["type"], "guild_category");
        assert_eq!(json["channels"][0]["parent_id"], serde_json::Value::Null);
        assert_eq!(json["channels"][2]["type"], "guild_text");
        assert_eq!(json["channels"][2]["parent_id"], 3090);
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
        assert_eq!(json["channel"]["type"], "guild_text");
        assert_eq!(json["channel"]["parent_id"], serde_json::Value::Null);
    }

    #[tokio::test]
    async fn create_guild_channel_returns_created_for_category_container() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"times-2","type":"guild_category"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["channel"]["type"], "guild_category");
        assert_eq!(json["channel"]["parent_id"], serde_json::Value::Null);
    }

    #[tokio::test]
    async fn create_guild_channel_returns_created_for_category_child() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"name":"times-abe-2","type":"guild_text","parent_id":3090}"#,
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
        assert_eq!(json["channel"]["type"], "guild_text");
        assert_eq!(json["channel"]["parent_id"], 3090);
    }

    #[tokio::test]
    async fn create_guild_channel_rejects_unknown_parent_channel() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"name":"times-abe-2","type":"guild_text","parent_id":9999}"#,
                    ))
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
    async fn create_guild_channel_rejects_non_category_parent_channel() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"name":"release-ops","type":"guild_text","parent_id":3001}"#,
                    ))
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
    async fn patch_moderation_member_returns_updated_mute() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/2001/members/1002")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"reason":"abuse","expires_at":"2026-04-01T00:00:00Z"}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["mute"]["mute_id"], 5001);
        assert_eq!(json["mute"]["target_user_id"], 1002);
        assert_eq!(json["mute"]["created_by"], 1001);
    }

    #[tokio::test]
    async fn patch_moderation_member_returns_not_found_for_unknown_member() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/2001/members/4040")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"reason":"abuse"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "MODERATION_NOT_FOUND");
    }

    #[tokio::test]
    async fn patch_moderation_member_returns_unavailable_when_service_fails_close() {
        let app = app_for_test_with_authorizer_and_moderation_service(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(UnavailableModerationService::new(
                "moderation_store_temporarily_unavailable",
            )),
        )
        .await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/2001/members/1002")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"reason":"abuse"}"#))
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
        assert!(json["ticket"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(json["expiresAt"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
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
    async fn ws_ticket_endpoint_rate_limits_repeated_invalid_tokens() {
        let app = app_for_test().await;
        let mut last_response = None;

        for _ in 0..21 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .method("POST")
                            .uri("/auth/ws-ticket")
                            .header("authorization", "Bearer invalid-token")
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap(),
            );
        }

        let response = last_response.unwrap();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        let retry_after = response
            .headers()
            .get(RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .unwrap();
        let retry_after_seconds = retry_after.parse::<u64>().unwrap();
        assert!((1..=60).contains(&retry_after_seconds));
    }

    #[tokio::test]
    async fn protected_route_rate_limits_repeated_invalid_tokens() {
        let app = app_for_test().await;
        let mut last_response = None;

        for _ in 0..21 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .uri("/v1/protected/ping")
                            .header("authorization", "Bearer invalid-token")
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
    async fn ws_handshake_rejects_missing_origin() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/ws")
                    .header("host", "localhost")
                    .header("connection", "Upgrade")
                    .header("upgrade", "websocket")
                    .header("sec-websocket-version", "13")
                    .header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UPGRADE_REQUIRED);
    }

    #[tokio::test]
    async fn ws_query_ticket_is_disabled_by_default() {
        let app = app_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        let response = app
            .oneshot(ws_upgrade_request("/ws?ticket=abc", None))
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UPGRADE_REQUIRED);
    }

    #[tokio::test]
    async fn protected_preflight_rejects_unknown_origin() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/v1/protected/ping")
                    .header(ORIGIN, "https://evil.example")
                    .header("access-control-request-method", "GET")
                    .header("access-control-request-headers", "authorization")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert!(response.headers().get("access-control-allow-origin").is_none());
    }

    #[tokio::test]
    async fn protected_preflight_allows_configured_origin() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/v1/protected/ping")
                    .header(ORIGIN, "http://localhost:3000")
                    .header("access-control-request-method", "GET")
                    .header("access-control-request-headers", "authorization")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-origin")
                .and_then(|value| value.to_str().ok()),
            Some("http://localhost:3000")
        );
    }

    #[tokio::test]
    async fn identify_rate_limit_key_uses_ticket_principal_when_ticket_is_active() {
        let state = state_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        let principal = AuthenticatedPrincipal {
            principal_id: PrincipalId(4321),
            firebase_uid: "u-identify".to_owned(),
            expires_at_epoch: unix_timestamp_seconds() + 300,
        };
        let issued = state
            .ws_ticket_store
            .issue_ticket(principal, Duration::from_secs(60))
            .await;

        let key = identify_rate_limit_key(&state, "session-1", &issued.ticket).await;

        assert_eq!(key.value, "identify:principal:4321");
        assert_eq!(key.source, "ticket_principal");
        assert_eq!(key.scope, "principal:4321");
    }

    #[tokio::test]
    async fn identify_rate_limit_key_falls_back_to_session_when_ticket_is_unknown() {
        let state = state_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;

        let key = identify_rate_limit_key(&state, "session-xyz", "unknown-ticket").await;

        assert_eq!(key.value, "identify:session:session-xyz");
        assert_eq!(key.source, "session_id_fallback");
        assert_eq!(key.scope, "session:session-xyz");
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_identify_rate_limit_scopes_by_principal_for_same_origin() {
        let app = app_for_test_with_authorizer_and_ws_identify_limit(
            Arc::new(StaticAllowAllAuthorizer),
            2,
        )
        .await;
        let (address, server) = spawn_test_server(app).await;
        let first_user_ticket_1 = issue_test_ws_ticket(address, "u-1").await;
        let first_user_ticket_2 = issue_test_ws_ticket(address, "u-1").await;
        let first_user_ticket_3 = issue_test_ws_ticket(address, "u-1").await;
        let second_user_ticket = issue_test_ws_ticket(address, "u-3").await;

        let mut first_socket =
            connect_test_ws_without_authorization(address, Some("http://localhost:3000")).await;
        send_identify_ticket(&mut first_socket, &first_user_ticket_1).await;
        let first_ready = expect_ws_json_message(&mut first_socket).await;
        assert_eq!(first_ready["type"], "auth.ready");
        assert_eq!(first_ready["d"]["principalId"], 1001);

        let mut second_socket =
            connect_test_ws_without_authorization(address, Some("http://localhost:3000")).await;
        send_identify_ticket(&mut second_socket, &first_user_ticket_2).await;
        let second_ready = expect_ws_json_message(&mut second_socket).await;
        assert_eq!(second_ready["type"], "auth.ready");
        assert_eq!(second_ready["d"]["principalId"], 1001);

        let mut blocked_socket =
            connect_test_ws_without_authorization(address, Some("http://localhost:3000")).await;
        send_identify_ticket(&mut blocked_socket, &first_user_ticket_3).await;
        let (blocked_code, blocked_reason) = expect_ws_close_reason(&mut blocked_socket).await;
        assert_eq!(blocked_code, CloseCode::Policy);
        assert_eq!(blocked_reason, "identify_rate_limited");

        let mut unaffected_socket =
            connect_test_ws_without_authorization(address, Some("http://localhost:3000")).await;
        send_identify_ticket(&mut unaffected_socket, &second_user_ticket).await;
        let unaffected_ready = expect_ws_json_message(&mut unaffected_socket).await;
        assert_eq!(unaffected_ready["type"], "auth.ready");
        assert_eq!(unaffected_ready["d"]["principalId"], 1003);

        let _ = first_socket.close(None).await;
        let _ = second_socket.close(None).await;
        let _ = unaffected_socket.close(None).await;
        server.abort();
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_identify_rate_limit_scopes_by_session_when_origin_is_missing() {
        let app = app_for_test_with_authorizer_and_ws_identify_limit(
            Arc::new(StaticAllowAllAuthorizer),
            1,
        )
        .await;
        let (address, server) = spawn_test_server(app).await;
        let first_ticket = issue_test_ws_ticket(address, "u-1").await;
        let second_ticket = issue_test_ws_ticket(address, "u-3").await;

        let mut first_socket = connect_test_ws_without_authorization(address, None).await;
        send_identify_ticket(&mut first_socket, &first_ticket).await;
        let first_ready = expect_ws_json_message(&mut first_socket).await;
        assert_eq!(first_ready["type"], "auth.ready");
        assert_eq!(first_ready["d"]["principalId"], 1001);

        let mut second_socket = connect_test_ws_without_authorization(address, None).await;
        send_identify_ticket(&mut second_socket, &second_ticket).await;
        let second_ready = expect_ws_json_message(&mut second_socket).await;
        assert_eq!(second_ready["type"], "auth.ready");
        assert_eq!(second_ready["d"]["principalId"], 1003);

        let _ = first_socket.close(None).await;
        let _ = second_socket.close(None).await;
        server.abort();
    }

    #[tokio::test]
    async fn message_realtime_publish_removes_subscription_after_channel_revocation() {
        let authorizer = Arc::new(ToggleGuildChannelAuthorizer::new(true));
        let state = state_for_test_with_authorizer(authorizer.clone()).await;
        let (sender, mut receiver) = tokio::sync::mpsc::channel(MESSAGE_REALTIME_OUTBOUND_CAPACITY);
        let target = GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        };

        state
            .message_realtime_hub
            .subscribe("session-1", PrincipalId(9003), &target, sender)
            .await;
        state
            .message_realtime_hub
            .publish_message_created(
                &state,
                MessageItemV1 {
                    message_id: 501,
                    guild_id: 10,
                    channel_id: 20,
                    author_id: 9003,
                    content: "before revoke".to_owned(),
                    created_at: "2026-03-10T10:00:00Z".to_owned(),
                    version: 1,
                    edited_at: None,
                    is_deleted: false,
                },
            )
            .await;
        assert!(matches!(
            receiver.try_recv(),
            Ok(ServerMessageFrameV1::Created(_))
        ));

        authorizer.set_allow_channel(false);
        state
            .message_realtime_hub
            .publish_message_created(
                &state,
                MessageItemV1 {
                    message_id: 502,
                    guild_id: 10,
                    channel_id: 20,
                    author_id: 9003,
                    content: "after revoke".to_owned(),
                    created_at: "2026-03-10T10:00:01Z".to_owned(),
                    version: 1,
                    edited_at: None,
                    is_deleted: false,
                },
            )
            .await;

        assert!(receiver.try_recv().is_err());
        let realtime_state = state.message_realtime_hub.state.lock().await;
        assert!(realtime_state.session_subscriptions.is_empty());
        assert!(realtime_state.channel_subscribers.is_empty());
    }

    #[tokio::test]
    async fn message_realtime_reconcile_removes_revoked_subscription() {
        let authorizer = Arc::new(ToggleGuildChannelAuthorizer::new(true));
        let state = state_for_test_with_authorizer(authorizer.clone()).await;
        let (sender, _receiver) = tokio::sync::mpsc::channel(MESSAGE_REALTIME_OUTBOUND_CAPACITY);
        let target = GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        };

        state
            .message_realtime_hub
            .subscribe("session-1", PrincipalId(9003), &target, sender)
            .await;
        authorizer.set_allow_channel(false);
        state
            .message_realtime_hub
            .reconcile_session_subscriptions(&state, "session-1", PrincipalId(9003))
            .await;

        let realtime_state = state.message_realtime_hub.state.lock().await;
        assert!(realtime_state.session_subscriptions.is_empty());
        assert!(realtime_state.channel_subscribers.is_empty());
    }

    #[tokio::test]
    async fn message_realtime_publish_updated_delivers_latest_snapshot() {
        let state =
            state_for_test_with_authorizer(Arc::new(ToggleGuildChannelAuthorizer::new(true))).await;
        let (sender, mut receiver) = tokio::sync::mpsc::channel(MESSAGE_REALTIME_OUTBOUND_CAPACITY);
        let target = GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        };

        state
            .message_realtime_hub
            .subscribe("session-1", PrincipalId(9003), &target, sender)
            .await;
        state
            .message_realtime_hub
            .publish_message_updated(
                &state,
                MessageItemV1 {
                    message_id: 601,
                    guild_id: 10,
                    channel_id: 20,
                    author_id: 9003,
                    content: "edited realtime".to_owned(),
                    created_at: "2026-03-10T10:00:00Z".to_owned(),
                    version: 2,
                    edited_at: Some("2026-03-10T10:05:00Z".to_owned()),
                    is_deleted: false,
                },
            )
            .await;

        match receiver.try_recv() {
            Ok(ServerMessageFrameV1::Updated(data)) => {
                assert_eq!(data.message.message_id, 601);
                assert_eq!(data.message.content, "edited realtime");
                assert_eq!(data.message.version, 2);
                assert_eq!(
                    data.message.edited_at.as_deref(),
                    Some("2026-03-10T10:05:00Z")
                );
                assert!(!data.message.is_deleted);
            }
            other => panic!("expected updated frame, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn message_realtime_publish_deleted_delivers_tombstone_snapshot() {
        let state =
            state_for_test_with_authorizer(Arc::new(ToggleGuildChannelAuthorizer::new(true))).await;
        let (sender, mut receiver) = tokio::sync::mpsc::channel(MESSAGE_REALTIME_OUTBOUND_CAPACITY);
        let target = GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        };

        state
            .message_realtime_hub
            .subscribe("session-1", PrincipalId(9003), &target, sender)
            .await;
        state
            .message_realtime_hub
            .publish_message_deleted(
                &state,
                MessageItemV1 {
                    message_id: 602,
                    guild_id: 10,
                    channel_id: 20,
                    author_id: 9003,
                    content: String::new(),
                    created_at: "2026-03-10T10:00:00Z".to_owned(),
                    version: 2,
                    edited_at: Some("2026-03-10T10:06:00Z".to_owned()),
                    is_deleted: true,
                },
            )
            .await;

        match receiver.try_recv() {
            Ok(ServerMessageFrameV1::Deleted(data)) => {
                assert_eq!(data.message.message_id, 602);
                assert_eq!(data.message.content, "");
                assert_eq!(data.message.version, 2);
                assert_eq!(
                    data.message.edited_at.as_deref(),
                    Some("2026-03-10T10:06:00Z")
                );
                assert!(data.message.is_deleted);
            }
            other => panic!("expected deleted frame, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn ws_handshake_invalid_bearer_token_keeps_ws_upgrade_path_in_oneshot() {
        let app = app_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;

        let response = app
            .oneshot(ws_upgrade_request("/ws", Some("Bearer invalid-token")))
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UPGRADE_REQUIRED);
    }

    #[tokio::test]
    async fn ws_handshake_auth_dependency_unavailable_keeps_ws_upgrade_path_in_oneshot() {
        let app = app_for_test_with_authorizer_and_token_verifier(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(UnavailableTokenVerifier),
        )
        .await;

        let response = app
            .oneshot(ws_upgrade_request("/ws", Some("Bearer any-token")))
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UPGRADE_REQUIRED);
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_handshake_invalid_bearer_token_closes_with_1008() {
        let app = app_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        let (address, server) = spawn_test_server(app).await;
        let mut socket =
            connect_test_ws_with_authorization(address, Some("Bearer invalid-token")).await;

        let response = timeout(Duration::from_secs(2), socket.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        match response {
            WsClientMessage::Close(Some(frame)) => {
                assert_eq!(frame.code, CloseCode::Policy);
                assert_eq!(frame.reason, "AUTH_INVALID_TOKEN");
            }
            other => panic!("expected close frame for invalid WS auth, got {other:?}"),
        }

        server.abort();
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_handshake_auth_dependency_unavailable_closes_with_1011() {
        let app = app_for_test_with_authorizer_and_token_verifier(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(UnavailableTokenVerifier),
        )
        .await;
        let (address, server) = spawn_test_server(app).await;
        let mut socket = connect_test_ws_with_authorization(address, Some("Bearer any-token")).await;

        let response = timeout(Duration::from_secs(2), socket.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        match response {
            WsClientMessage::Close(Some(frame)) => {
                assert_eq!(frame.code, CloseCode::Error);
                assert_eq!(frame.reason, "AUTH_UNAVAILABLE");
            }
            other => panic!("expected close frame for unavailable WS auth, got {other:?}"),
        }

        server.abort();
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
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
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_handshake_invalid_authorization_header_closes_with_1008() {
        let app = app_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await;
        let (address, server) = spawn_test_server(app).await;
        let mut socket = connect_test_ws_with_authorization(address, Some("Basic bad-token")).await;

        let response = timeout(Duration::from_secs(2), socket.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        match response {
            WsClientMessage::Close(Some(frame)) => {
                assert_eq!(frame.code, CloseCode::Policy);
                assert_eq!(frame.reason, "AUTH_INVALID_TOKEN");
            }
            other => panic!("expected close frame for invalid WS auth header, got {other:?}"),
        }

        server.abort();
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
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
    #[ignore = "requires TCP bind; sandbox denies listeners"]
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
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_message_created_fanout_reaches_all_subscribers() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticMessageService),
        )
        .await;
        let (address, server) = spawn_test_server(app).await;
        let mut first = connect_test_ws_at(address, "u-member").await;
        let mut second = connect_test_ws_at(address, "u-member").await;

        let first_ack = subscribe_test_channel(&mut first, 10, 20).await;
        let second_ack = subscribe_test_channel(&mut second, 10, 20).await;
        assert!(matches!(
            first_ack,
            ServerMessageFrameV1::Subscribed(MessageSubscriptionStateV1 {
                guild_id: 10,
                channel_id: 20,
            })
        ));
        assert!(matches!(
            second_ack,
            ServerMessageFrameV1::Subscribed(MessageSubscriptionStateV1 {
                guild_id: 10,
                channel_id: 20,
            })
        ));

        let response =
            post_test_channel_message(address, "u-member", 10, 20, "hello realtime", None).await;
        assert_eq!(response.status(), reqwest::StatusCode::CREATED);

        let first_frame = next_server_message_frame(&mut first).await;
        let second_frame = next_server_message_frame(&mut second).await;
        for frame in [first_frame, second_frame] {
            match frame {
                ServerMessageFrameV1::Created(data) => {
                    assert_eq!(data.guild_id, 10);
                    assert_eq!(data.channel_id, 20);
                    assert_eq!(data.message.content, "hello realtime");
                    assert_eq!(data.message.author_id, 9003);
                }
                other => panic!("expected message.created frame, got {other:?}"),
            }
        }

        let _ = first.close(None).await;
        let _ = second.close(None).await;
        server.abort();
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_message_created_fanout_stops_after_unsubscribe() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticMessageService),
        )
        .await;
        let (address, server) = spawn_test_server(app).await;
        let mut socket = connect_test_ws_at(address, "u-member").await;

        let subscribed = subscribe_test_channel(&mut socket, 10, 20).await;
        assert!(matches!(
            subscribed,
            ServerMessageFrameV1::Subscribed(MessageSubscriptionStateV1 {
                guild_id: 10,
                channel_id: 20,
            })
        ));
        let unsubscribed = unsubscribe_test_channel(&mut socket, 10, 20).await;
        assert!(matches!(
            unsubscribed,
            ServerMessageFrameV1::Unsubscribed(MessageSubscriptionStateV1 {
                guild_id: 10,
                channel_id: 20,
            })
        ));

        let response =
            post_test_channel_message(address, "u-member", 10, 20, "hello after unsub", None).await;
        assert_eq!(response.status(), reqwest::StatusCode::CREATED);
        assert!(
            timeout(Duration::from_millis(250), socket.next())
                .await
                .is_err(),
            "unsubscribed socket should not receive fanout"
        );

        let _ = socket.close(None).await;
        server.abort();
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_message_created_fanout_skips_completed_idempotency_replay() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticIdempotencyMessageService::default()),
        )
        .await;
        let (address, server) = spawn_test_server(app).await;
        let mut socket = connect_test_ws_at(address, "u-member").await;

        let subscribed = subscribe_test_channel(&mut socket, 10, 20).await;
        assert!(matches!(
            subscribed,
            ServerMessageFrameV1::Subscribed(MessageSubscriptionStateV1 {
                guild_id: 10,
                channel_id: 20,
            })
        ));

        let first_response =
            post_test_channel_message(address, "u-member", 10, 20, "hello idem", Some("idem-1"))
                .await;
        assert_eq!(first_response.status(), reqwest::StatusCode::CREATED);
        let first_body = first_response.json::<serde_json::Value>().await.unwrap();
        let created = next_server_message_frame(&mut socket).await;
        let first_message_id = match created {
            ServerMessageFrameV1::Created(data) => {
                assert_eq!(data.message.content, "hello idem");
                data.message.message_id
            }
            other => panic!("expected message.created frame, got {other:?}"),
        };

        let second_response =
            post_test_channel_message(address, "u-member", 10, 20, "hello idem", Some("idem-1"))
                .await;
        assert_eq!(second_response.status(), reqwest::StatusCode::CREATED);
        let second_body = second_response.json::<serde_json::Value>().await.unwrap();
        assert_eq!(
            first_body["message"]["message_id"].as_i64().unwrap(),
            second_body["message"]["message_id"].as_i64().unwrap()
        );
        assert_eq!(
            first_body["message"]["message_id"].as_i64().unwrap(),
            first_message_id
        );
        assert!(
            timeout(Duration::from_millis(250), socket.next())
                .await
                .is_err(),
            "completed replay should not emit a second message.created"
        );

        let _ = socket.close(None).await;
        server.abort();
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_dm_message_created_fanout_reaches_subscribers() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticMessageService),
        )
        .await;
        let (address, server) = spawn_test_server(app).await;
        let mut socket = connect_test_ws_at(address, "u-member").await;

        let subscribed = subscribe_test_dm(&mut socket, 55).await;
        assert!(matches!(
            subscribed,
            ServerMessageFrameV1::DmSubscribed(DmMessageSubscriptionStateV1 { channel_id: 55 })
        ));

        let response = post_test_dm_message(address, "u-member", 55, "hello dm realtime", None).await;
        assert_eq!(response.status(), reqwest::StatusCode::CREATED);

        match next_server_message_frame(&mut socket).await {
            ServerMessageFrameV1::DmCreated(data) => {
                assert_eq!(data.channel_id, 55);
                assert_eq!(data.message.channel_id, 55);
                assert_eq!(data.message.content, "hello dm realtime");
                assert_eq!(data.message.author_id, 9003);
            }
            other => panic!("expected dm.message.created frame, got {other:?}"),
        }

        let _ = socket.close(None).await;
        server.abort();
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_message_updated_fanout_reaches_subscribers() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticMessageService),
        )
        .await;
        let (address, server) = spawn_test_server(app).await;
        let mut socket = connect_test_ws_at(address, "u-member").await;

        let subscribed = subscribe_test_channel(&mut socket, 10, 20).await;
        assert!(matches!(
            subscribed,
            ServerMessageFrameV1::Subscribed(MessageSubscriptionStateV1 {
                guild_id: 10,
                channel_id: 20,
            })
        ));

        let response =
            patch_test_channel_message(address, "u-member", 10, 20, 120110, "edited realtime", 1)
                .await;
        assert_eq!(response.status(), reqwest::StatusCode::OK);

        match next_server_message_frame(&mut socket).await {
            ServerMessageFrameV1::Updated(data) => {
                assert_eq!(data.guild_id, 10);
                assert_eq!(data.channel_id, 20);
                assert_eq!(data.message.message_id, 120110);
                assert_eq!(data.message.content, "edited realtime");
                assert_eq!(data.message.version, 2);
                assert!(!data.message.is_deleted);
                assert!(data.message.edited_at.is_some());
            }
            other => panic!("expected message.updated frame, got {other:?}"),
        }

        let _ = socket.close(None).await;
        server.abort();
    }

    #[tokio::test]
    #[ignore = "requires TCP bind; sandbox denies listeners"]
    async fn ws_message_deleted_fanout_reaches_subscribers() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticMessageService),
        )
        .await;
        let (address, server) = spawn_test_server(app).await;
        let mut socket = connect_test_ws_at(address, "u-member").await;

        let subscribed = subscribe_test_channel(&mut socket, 10, 20).await;
        assert!(matches!(
            subscribed,
            ServerMessageFrameV1::Subscribed(MessageSubscriptionStateV1 {
                guild_id: 10,
                channel_id: 20,
            })
        ));

        let response = delete_test_channel_message(address, "u-member", 10, 20, 120110, 1).await;
        assert_eq!(response.status(), reqwest::StatusCode::OK);

        match next_server_message_frame(&mut socket).await {
            ServerMessageFrameV1::Deleted(data) => {
                assert_eq!(data.guild_id, 10);
                assert_eq!(data.channel_id, 20);
                assert_eq!(data.message.message_id, 120110);
                assert_eq!(data.message.content, "");
                assert_eq!(data.message.version, 2);
                assert!(data.message.is_deleted);
                assert!(data.message.edited_at.is_some());
            }
            other => panic!("expected message.deleted frame, got {other:?}"),
        }

        let _ = socket.close(None).await;
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
        assert_eq!(
            json["profile"]["avatar_key"],
            "v0/tenant/default/user/1001/profile/avatar/asset/550e8400-e29b-41d4-a716-446655440000/avatar.png"
        );
        assert_eq!(
            json["profile"]["banner_key"],
            "v0/tenant/default/user/1001/profile/banner/asset/550e8400-e29b-41d4-a716-446655440001/banner.png"
        );
        assert_eq!(json["profile"]["theme"], "dark");
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
        assert_eq!(json["profile"]["theme"], "dark");
    }

    #[tokio::test]
    async fn patch_my_profile_updates_theme() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"theme":"light"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["profile"]["theme"], "light");
        assert_eq!(json["profile"]["display_name"], "Alice");
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
    async fn patch_my_profile_updates_banner_key() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"banner_key":"v0/tenant/default/user/1001/profile/banner/asset/550e8400-e29b-41d4-a716-446655440002/banner.png"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(
            json["profile"]["banner_key"],
            "v0/tenant/default/user/1001/profile/banner/asset/550e8400-e29b-41d4-a716-446655440002/banner.png"
        );
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
    async fn patch_my_profile_rejects_invalid_theme() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"theme":"onyx"}"#))
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
    async fn patch_my_profile_rejects_invalid_banner_key_format() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"banner_key":"bad key"}"#))
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
    async fn patch_my_profile_rejects_cross_principal_banner_key() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"banner_key":"v0/tenant/default/user/999/profile/banner/asset/550e8400-e29b-41d4-a716-446655440002/banner.png"}"#,
                    ))
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
    async fn issue_my_profile_media_upload_url_returns_contract() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/users/me/profile/media/upload-url")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"target":"avatar","filename":"avatar.png","content_type":"image/png","size_bytes":1048576}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["upload"]["target"], "avatar");
        assert_eq!(json["upload"]["method"], "PUT");
        assert_eq!(
            json["upload"]["required_headers"]["content-type"],
            "image/png"
        );
    }

    #[tokio::test]
    async fn get_my_profile_media_download_url_returns_contract() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/users/me/profile/media/banner/download-url")
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
        assert_eq!(json["media"]["target"], "banner");
        assert_eq!(
            json["media"]["download_url"],
            "https://storage.googleapis.com/profile-media/banner-download"
        );
    }

    #[tokio::test]
    async fn get_my_profile_media_download_url_returns_media_unavailable() {
        let app = app_for_test_with_authorizer_profile_and_media(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticProfileService),
            Arc::new(StaticUnavailableProfileMediaService),
        )
        .await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/users/me/profile/media/avatar/download-url")
                    .header("authorization", format!("Bearer {token}"))
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
        assert_eq!(json["code"], "PROFILE_MEDIA_UNAVAILABLE");
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
    async fn get_guild_members_returns_directory_entries() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/2001/members")
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
        assert_eq!(json["members"][0]["user_id"], 1001);
        assert_eq!(json["members"][0]["display_name"], "Alice");
        assert_eq!(json["members"][0]["role_keys"][0], "owner");
        assert_eq!(json["members"][1]["user_id"], 1003);
    }

    #[tokio::test]
    async fn get_guild_members_returns_forbidden_for_non_member() {
        let app = app_for_test().await;
        let token = format!("u-owner:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/2001/members")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "guild-members-denied")
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
        assert_eq!(json["request_id"], "guild-members-denied");
    }

    #[tokio::test]
    async fn get_guild_roles_returns_directory_entries() {
        let app = app_for_test().await;
        let token = format!("u-3:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/2001/roles")
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
        assert_eq!(json["roles"][0]["role_key"], "owner");
        assert_eq!(json["roles"][0]["member_count"], 1);
        assert_eq!(json["roles"][1]["role_key"], "member");
    }

    #[tokio::test]
    async fn get_user_profile_returns_profile_for_shared_guild_user() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/users/1003/profile")
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
        assert_eq!(json["profile"]["user_id"], 1003);
        assert_eq!(json["profile"]["display_name"], "Carol");
    }

    #[tokio::test]
    async fn get_user_profile_returns_forbidden_without_shared_guild() {
        let app = app_for_test().await;
        let token = format!("u-owner:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/users/1003/profile")
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
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"hello dm"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(member_dm_post_response.status(), StatusCode::CREATED);

        let member_moderation_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/10/members/9003")
                    .header("authorization", format!("Bearer {member_token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"reason":"abuse"}"#))
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
                    .uri("/v1/moderation/guilds/2001/members/1002")
                    .header("authorization", format!("Bearer {admin_token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"reason":"abuse"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(admin_moderation_response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn list_channel_messages_returns_contract_payload_with_next_before() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/10/channels/20/messages?limit=3")
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

        assert_eq!(json["items"][0]["message_id"], 120110);
        assert_eq!(json["items"][1]["message_id"], 120108);
        assert_eq!(json["items"][2]["message_id"], 120107);
        assert!(json["next_before"].as_str().is_some());
        assert_eq!(json["next_after"], serde_json::Value::Null);
        assert_eq!(json["has_more"], true);
    }

    #[tokio::test]
    async fn list_channel_messages_returns_after_page_in_ascending_order() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let cursor = MessageCursorKeyV1 {
            created_at: "2026-02-21T10:00:05Z".to_owned(),
            message_id: 120107,
        }
        .encode();
        let response = app
            .oneshot(
                Request::builder()
                    .uri(format!(
                        "/v1/guilds/10/channels/20/messages?limit=1&after={cursor}"
                    ))
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

        assert_eq!(json["items"][0]["message_id"], 120108);
        assert_eq!(json["next_before"], serde_json::Value::Null);
        assert!(json["next_after"].as_str().is_some());
        assert_eq!(json["has_more"], true);
    }

    #[tokio::test]
    async fn list_channel_messages_rejects_before_after_conflict() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/10/channels/20/messages?before=a&after=b")
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
        assert_eq!(json["message"], "request payload is invalid");
    }

    #[tokio::test]
    async fn list_channel_messages_rejects_invalid_cursor() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/10/channels/20/messages?after=not-a-cursor")
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
        assert_eq!(json["message"], "request payload is invalid");
    }

    #[tokio::test]
    async fn create_channel_message_returns_contract_payload() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"hello contract"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["message"]["guild_id"], 10);
        assert_eq!(json["message"]["channel_id"], 20);
        assert_eq!(json["message"]["author_id"], 9003);
        assert_eq!(json["message"]["content"], "hello contract");
        assert_eq!(json["message"]["is_deleted"], false);
    }

    #[tokio::test]
    async fn message_scylla_integration_http_create_and_list_channel_messages_use_live_storage() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };
        let Some((service_session, keyspace)) = connect_integration_scylla().await else {
            return;
        };
        let Some((assert_session, _)) = connect_integration_scylla().await else {
            return;
        };

        let base_id = next_integration_id_block(10);
        let guild_id = base_id;
        let channel_id = base_id + 1;
        let owner_id = 9001;
        let author_id = 9003;

        seed_user(&client, owner_id, "live-http-owner").await;
        seed_user(&client, author_id, "live-http-member").await;
        seed_guild_text_channel(
            &client,
            guild_id,
            owner_id,
            channel_id,
            "2026-03-07T00:00:00Z",
        )
        .await;
        seed_guild_member(&client, guild_id, author_id, "2026-03-07T00:00:00Z").await;

        let app = app_for_test_with_authorizer_and_message_and_guild_channel_service(
            Arc::new(RoleScenarioAuthorizer),
            build_live_message_service(database_url.clone(), service_session, keyspace.clone()),
            Arc::new(PostgresGuildChannelService::new(database_url, true)),
        )
        .await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);

        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!(
                        "/v1/guilds/{guild_id}/channels/{channel_id}/messages"
                    ))
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"hello live http"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(create_response.status(), StatusCode::CREATED);
        let create_body = to_bytes(create_response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let create_json = serde_json::from_slice::<serde_json::Value>(&create_body).unwrap();
        let message_id = create_json["message"]["message_id"].as_i64().unwrap();
        let created_at = create_json["message"]["created_at"]
            .as_str()
            .unwrap()
            .to_owned();
        assert_eq!(create_json["message"]["guild_id"], guild_id);
        assert_eq!(create_json["message"]["channel_id"], channel_id);
        assert_eq!(create_json["message"]["author_id"], author_id);
        assert_eq!(create_json["message"]["content"], "hello live http");

        let bucket = bucket_from_created_at(&created_at);
        assert_eq!(
            count_scylla_messages(&assert_session, &keyspace, channel_id, bucket).await,
            1
        );
        let (last_message_id, last_message_at) = query_last_message(&client, channel_id).await;
        assert_eq!(last_message_id, message_id);
        assert_eq!(last_message_at, created_at);

        let list_response = app
            .oneshot(
                Request::builder()
                    .uri(format!(
                        "/v1/guilds/{guild_id}/channels/{channel_id}/messages?limit=10"
                    ))
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(list_response.status(), StatusCode::OK);
        let list_body = to_bytes(list_response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let list_json = serde_json::from_slice::<serde_json::Value>(&list_body).unwrap();
        assert_eq!(list_json["items"][0]["message_id"], message_id);
        assert_eq!(list_json["items"][0]["content"], "hello live http");
        assert_eq!(list_json["items"][0]["author_id"], author_id);
        assert_eq!(list_json["has_more"], false);
        assert_eq!(list_json["next_before"], serde_json::Value::Null);
        assert_eq!(list_json["next_after"], serde_json::Value::Null);
    }

    #[tokio::test]
    async fn message_scylla_integration_http_list_channel_messages_respects_bucket_boundaries() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };
        let Some((seed_session, keyspace)) = connect_integration_scylla().await else {
            return;
        };
        let Some((service_session, _)) = connect_integration_scylla().await else {
            return;
        };

        let base_id = next_integration_id_block(10);
        let guild_id = base_id;
        let channel_id = base_id + 1;
        let owner_id = 9001;
        let member_id = 9003;

        seed_user(&client, owner_id, "http-paging-owner").await;
        seed_user(&client, member_id, "http-paging-member").await;
        seed_guild_text_channel(
            &client,
            guild_id,
            owner_id,
            channel_id,
            "2026-03-07T00:00:00Z",
        )
        .await;
        seed_guild_member(&client, guild_id, member_id, "2026-03-07T00:00:00Z").await;
        upsert_channel_last_message(&client, channel_id, 130_205, "2026-03-08T10:00:06Z").await;

        for row in [
            SeedMessageRow {
                message_id: 130_205,
                author_id: owner_id,
                created_at: "2026-03-08T10:00:06Z",
            },
            SeedMessageRow {
                message_id: 130_203,
                author_id: owner_id,
                created_at: "2026-03-08T10:00:05Z",
            },
        ] {
            insert_scylla_message(
                &seed_session,
                &keyspace,
                channel_id,
                bucket_from_created_at(row.created_at),
                row,
            )
            .await;
        }
        for row in [
            SeedMessageRow {
                message_id: 130_202,
                author_id: owner_id,
                created_at: "2026-03-07T09:00:05Z",
            },
            SeedMessageRow {
                message_id: 130_201,
                author_id: owner_id,
                created_at: "2026-03-07T09:00:05Z",
            },
            SeedMessageRow {
                message_id: 130_199,
                author_id: owner_id,
                created_at: "2026-03-07T09:00:04Z",
            },
            SeedMessageRow {
                message_id: 130_198,
                author_id: owner_id,
                created_at: "2026-03-07T09:00:02Z",
            },
        ] {
            insert_scylla_message(
                &seed_session,
                &keyspace,
                channel_id,
                bucket_from_created_at(row.created_at),
                row,
            )
            .await;
        }

        let app = app_for_test_with_authorizer_and_message_and_guild_channel_service(
            Arc::new(RoleScenarioAuthorizer),
            build_live_message_service(database_url.clone(), service_session, keyspace),
            Arc::new(PostgresGuildChannelService::new(database_url, true)),
        )
        .await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);

        let first_page = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!(
                        "/v1/guilds/{guild_id}/channels/{channel_id}/messages?limit=3"
                    ))
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(first_page.status(), StatusCode::OK);
        let first_body = to_bytes(first_page.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let first_json = serde_json::from_slice::<serde_json::Value>(&first_body).unwrap();
        assert_eq!(
            first_json["items"]
                .as_array()
                .unwrap()
                .iter()
                .map(|item| item["message_id"].as_i64().unwrap())
                .collect::<Vec<_>>(),
            vec![130_205, 130_203, 130_202]
        );
        assert_eq!(first_json["has_more"], true);
        let next_before = first_json["next_before"].as_str().unwrap().to_owned();
        assert_eq!(first_json["next_after"], serde_json::Value::Null);

        let second_page = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!(
                        "/v1/guilds/{guild_id}/channels/{channel_id}/messages?limit=3&before={next_before}"
                    ))
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(second_page.status(), StatusCode::OK);
        let second_body = to_bytes(second_page.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let second_json = serde_json::from_slice::<serde_json::Value>(&second_body).unwrap();
        assert_eq!(
            second_json["items"]
                .as_array()
                .unwrap()
                .iter()
                .map(|item| item["message_id"].as_i64().unwrap())
                .collect::<Vec<_>>(),
            vec![130_201, 130_199, 130_198]
        );
        assert_eq!(second_json["has_more"], false);
        assert_eq!(second_json["next_before"], serde_json::Value::Null);

        let after_cursor = MessageCursorKeyV1 {
            created_at: "2026-03-07T09:00:05Z".to_owned(),
            message_id: 130_201,
        }
        .encode();
        let newer_page = app
            .oneshot(
                Request::builder()
                    .uri(format!(
                        "/v1/guilds/{guild_id}/channels/{channel_id}/messages?limit=3&after={after_cursor}"
                    ))
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(newer_page.status(), StatusCode::OK);
        let newer_body = to_bytes(newer_page.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let newer_json = serde_json::from_slice::<serde_json::Value>(&newer_body).unwrap();
        assert_eq!(
            newer_json["items"]
                .as_array()
                .unwrap()
                .iter()
                .map(|item| item["message_id"].as_i64().unwrap())
                .collect::<Vec<_>>(),
            vec![130_202, 130_203, 130_205]
        );
        assert_eq!(newer_json["has_more"], false);
        assert_eq!(newer_json["next_after"], serde_json::Value::Null);
    }

    #[tokio::test]
    async fn message_scylla_integration_http_edit_channel_message_updates_live_storage() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };
        let Some((seed_session, keyspace)) = connect_integration_scylla().await else {
            return;
        };
        let Some((service_session, _)) = connect_integration_scylla().await else {
            return;
        };

        let base_id = next_integration_id_block(10);
        let guild_id = base_id;
        let channel_id = base_id + 1;
        let owner_id = 9001;
        let author_id = 9003;
        let message_id = base_id + 2;
        let created_at = "2026-03-07T09:00:05Z";

        seed_user(&client, owner_id, "http-edit-owner").await;
        seed_user(&client, author_id, "http-edit-member").await;
        seed_guild_text_channel(
            &client,
            guild_id,
            owner_id,
            channel_id,
            "2026-03-07T00:00:00Z",
        )
        .await;
        seed_guild_member(&client, guild_id, author_id, "2026-03-07T00:00:00Z").await;
        upsert_channel_last_message(&client, channel_id, message_id, created_at).await;
        insert_scylla_message(
            &seed_session,
            &keyspace,
            channel_id,
            bucket_from_created_at(created_at),
            SeedMessageRow {
                message_id,
                author_id,
                created_at,
            },
        )
        .await;

        let app = app_for_test_with_authorizer_and_message_and_guild_channel_service(
            Arc::new(RoleScenarioAuthorizer),
            build_live_message_service(database_url.clone(), service_session, keyspace),
            Arc::new(PostgresGuildChannelService::new(database_url, true)),
        )
        .await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri(format!(
                        "/v1/guilds/{guild_id}/channels/{channel_id}/messages/{message_id}"
                    ))
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"content":"edited live http","expected_version":1}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["message"]["content"], "edited live http");
        assert_eq!(json["message"]["version"], 2);
        assert_eq!(json["message"]["is_deleted"], false);
        assert!(json["message"]["edited_at"].is_string());

        let list_response = app
            .oneshot(
                Request::builder()
                    .uri(format!(
                        "/v1/guilds/{guild_id}/channels/{channel_id}/messages?limit=10"
                    ))
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(list_response.status(), StatusCode::OK);
        let list_body = to_bytes(list_response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let list_json = serde_json::from_slice::<serde_json::Value>(&list_body).unwrap();
        assert_eq!(list_json["items"][0]["message_id"], message_id);
        assert_eq!(list_json["items"][0]["content"], "edited live http");
        assert_eq!(list_json["items"][0]["version"], 2);
    }

    #[tokio::test]
    async fn message_scylla_integration_http_delete_channel_message_keeps_tombstone() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };
        let Some((seed_session, keyspace)) = connect_integration_scylla().await else {
            return;
        };
        let Some((service_session, _)) = connect_integration_scylla().await else {
            return;
        };

        let base_id = next_integration_id_block(10);
        let guild_id = base_id;
        let channel_id = base_id + 1;
        let owner_id = 9001;
        let author_id = 9003;
        let message_id = base_id + 2;
        let created_at = "2026-03-07T09:00:05Z";

        seed_user(&client, owner_id, "http-delete-owner").await;
        seed_user(&client, author_id, "http-delete-member").await;
        seed_guild_text_channel(
            &client,
            guild_id,
            owner_id,
            channel_id,
            "2026-03-07T00:00:00Z",
        )
        .await;
        seed_guild_member(&client, guild_id, author_id, "2026-03-07T00:00:00Z").await;
        upsert_channel_last_message(&client, channel_id, message_id, created_at).await;
        insert_scylla_message(
            &seed_session,
            &keyspace,
            channel_id,
            bucket_from_created_at(created_at),
            SeedMessageRow {
                message_id,
                author_id,
                created_at,
            },
        )
        .await;

        let app = app_for_test_with_authorizer_and_message_and_guild_channel_service(
            Arc::new(RoleScenarioAuthorizer),
            build_live_message_service(database_url.clone(), service_session, keyspace),
            Arc::new(PostgresGuildChannelService::new(database_url, true)),
        )
        .await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!(
                        "/v1/guilds/{guild_id}/channels/{channel_id}/messages/{message_id}"
                    ))
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"expected_version":1}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["message"]["message_id"], message_id);
        assert_eq!(json["message"]["content"], "");
        assert_eq!(json["message"]["version"], 2);
        assert_eq!(json["message"]["is_deleted"], true);

        let list_response = app
            .oneshot(
                Request::builder()
                    .uri(format!(
                        "/v1/guilds/{guild_id}/channels/{channel_id}/messages?limit=10"
                    ))
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(list_response.status(), StatusCode::OK);
        let list_body = to_bytes(list_response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let list_json = serde_json::from_slice::<serde_json::Value>(&list_body).unwrap();
        assert_eq!(list_json["items"][0]["message_id"], message_id);
        assert_eq!(list_json["items"][0]["content"], "");
        assert_eq!(list_json["items"][0]["version"], 2);
        assert_eq!(list_json["items"][0]["is_deleted"], true);
    }

    #[tokio::test]
    async fn create_channel_message_reuses_message_identity_for_same_idempotency_key() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(RoleScenarioAuthorizer),
            Arc::new(StaticIdempotencyMessageService::default()),
        )
        .await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);

        let first = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .header("Idempotency-Key", "idem-1")
                    .body(Body::from(r#"{"content":"hello contract"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        let second = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .header("Idempotency-Key", "idem-1")
                    .body(Body::from(r#"{"content":"hello contract"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(first.status(), StatusCode::CREATED);
        assert_eq!(second.status(), StatusCode::CREATED);

        let first_body = to_bytes(first.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let second_body = to_bytes(second.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let first_json = serde_json::from_slice::<serde_json::Value>(&first_body).unwrap();
        let second_json = serde_json::from_slice::<serde_json::Value>(&second_body).unwrap();
        assert_eq!(
            first_json["message"]["message_id"],
            second_json["message"]["message_id"]
        );
        assert_eq!(
            first_json["message"]["created_at"],
            second_json["message"]["created_at"]
        );
    }

    #[tokio::test]
    async fn create_channel_message_rejects_payload_mismatch_for_same_idempotency_key() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(RoleScenarioAuthorizer),
            Arc::new(StaticIdempotencyMessageService::default()),
        )
        .await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);

        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .header("Idempotency-Key", "idem-1")
                    .body(Body::from(r#"{"content":"hello contract"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .header("Idempotency-Key", "idem-1")
                    .body(Body::from(r#"{"content":"different"}"#))
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
        assert_eq!(json["message"], "request payload is invalid");
    }

    #[tokio::test]
    async fn list_dm_channels_returns_participant_scoped_result() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/users/me/dms")
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
        assert_eq!(json["channels"][0]["channel_id"], 55);
        assert_eq!(json["channels"][0]["recipient"]["user_id"], 1002);
    }

    #[tokio::test]
    async fn get_dm_channel_returns_dm_summary() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/dms/55")
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
        assert_eq!(json["channel"]["channel_id"], 55);
        assert_eq!(json["channel"]["recipient"]["display_name"], "Bob");
    }

    #[tokio::test]
    async fn create_dm_message_returns_created_message() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/dms/55/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .header("Idempotency-Key", "dm-idem-1")
                    .body(Body::from(r#"{"content":"hello dm"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["message"]["channel_id"], 55);
        assert_eq!(json["message"]["author_id"], 1001);
        assert_eq!(json["message"]["content"], "hello dm");
    }

    #[tokio::test]
    async fn create_channel_message_rejects_blank_content() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from("{\"content\":\"   \"}"))
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
        assert_eq!(json["message"], "request payload is invalid");
    }

    #[tokio::test]
    async fn create_channel_message_rejects_blank_idempotency_key() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .header("Idempotency-Key", "   ")
                    .body(Body::from(r#"{"content":"hello contract"}"#))
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
        assert_eq!(json["message"], "request payload is invalid");
    }

    #[tokio::test]
    async fn edit_channel_message_returns_updated_snapshot() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/guilds/10/channels/20/messages/120110")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"edited","expected_version":1}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["message"]["message_id"], 120110);
        assert_eq!(json["message"]["content"], "edited");
        assert_eq!(json["message"]["version"], 2);
        assert_eq!(json["message"]["is_deleted"], false);
        assert!(json["message"]["edited_at"].is_string());
    }

    #[tokio::test]
    async fn delete_channel_message_returns_tombstone_snapshot() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/v1/guilds/10/channels/20/messages/120110")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"expected_version":1}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["message"]["message_id"], 120110);
        assert_eq!(json["message"]["content"], "");
        assert_eq!(json["message"]["version"], 2);
        assert_eq!(json["message"]["is_deleted"], true);
    }

    #[tokio::test]
    async fn edit_channel_message_returns_conflict_for_stale_expected_version() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(RoleScenarioAuthorizer),
            Arc::new(StaticIdempotencyMessageService::default()),
        )
        .await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let create = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"hello"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        let create_body = to_bytes(create.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let create_json = serde_json::from_slice::<serde_json::Value>(&create_body).unwrap();
        let message_id = create_json["message"]["message_id"].as_i64().unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri(format!("/v1/guilds/10/channels/20/messages/{message_id}"))
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"edited","expected_version":99}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CONFLICT);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "MESSAGE_CONFLICT");
    }

    #[tokio::test]
    async fn delete_channel_message_returns_forbidden_for_non_author() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(RoleScenarioAuthorizer),
            Arc::new(StaticIdempotencyMessageService::default()),
        )
        .await;
        let author_token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let owner_token = format!("u-owner:{}", unix_timestamp_seconds() + 300);
        let create = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {author_token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"hello"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        let create_body = to_bytes(create.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let create_json = serde_json::from_slice::<serde_json::Value>(&create_body).unwrap();
        let message_id = create_json["message"]["message_id"].as_i64().unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/v1/guilds/10/channels/20/messages/{message_id}"))
                    .header("authorization", format!("Bearer {owner_token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"expected_version":1}"#))
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
    async fn create_channel_message_rejects_malformed_json() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"unterminated""#))
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
        assert_eq!(json["message"], "request payload is invalid");
    }

    #[tokio::test]
    async fn create_channel_message_returns_service_unavailable_when_message_service_fails_close() {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(RoleScenarioAuthorizer),
            Arc::new(StaticUnavailableMessageService),
        )
        .await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"hello contract"}"#))
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
        assert_eq!(json["message"], "authorization dependency is unavailable");
    }

    #[tokio::test]
    async fn list_channel_messages_returns_not_found_when_message_service_reports_missing_channel()
    {
        let app = app_for_test_with_authorizer_and_message_service(
            Arc::new(RoleScenarioAuthorizer),
            Arc::new(StaticNotFoundMessageService),
        )
        .await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/10/channels/20/messages")
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
        assert_eq!(json["message"], "channel resource was not found");
    }

    #[tokio::test]
    async fn list_channel_messages_denies_category_container_target() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/guilds/10/channels/21/messages")
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
    async fn create_channel_message_denies_category_container_target() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/21/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"hello category"}"#))
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
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"reason":"abuse"}"#))
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
        state
            .rest_rate_limit_service
            .set_degraded_for_test(true)
            .await;
        let app = app_with_state(state);
        let token = format!("u-admin:{}", unix_timestamp_seconds() + 300);

        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/10/members/9003")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"reason":"abuse"}"#))
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
        state
            .rest_rate_limit_service
            .set_degraded_for_test(true)
            .await;
        let app = app_with_state(state);
        let token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let first_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/dms/55/messages")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"content":"hello dm"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(first_response.status(), StatusCode::CREATED);

        let mut last_response = None;

        for _ in 0..30 {
            last_response = Some(
                app.clone()
                    .oneshot(
                        Request::builder()
                            .method("POST")
                            .uri("/v1/dms/55/messages")
                            .header("authorization", format!("Bearer {token}"))
                            .header("content-type", "application/json")
                            .body(Body::from(r#"{"content":"hello dm"}"#))
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
        match rest_authz_resource_from_path("/guilds/10/channels") {
            AuthzResource::Guild { guild_id } => assert_eq!(guild_id, 10),
            _ => panic!("guild channel collection path should map to guild resource"),
        }

        match rest_authz_resource_from_path("/channels/55") {
            AuthzResource::Channel { channel_id } => assert_eq!(channel_id, 55),
            _ => panic!("channel path should map to channel resource"),
        }

        match rest_authz_resource_from_path("/v1/guilds/10/invites") {
            AuthzResource::Guild { guild_id } => assert_eq!(guild_id, 10),
            _ => panic!("invite collection path should map to guild resource"),
        }

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

        match rest_authz_resource_from_path("/guilds/10/permission-snapshot") {
            AuthzResource::Guild { guild_id } => assert_eq!(guild_id, 10),
            _ => panic!("permission snapshot path should map to guild resource"),
        }
    }

    #[test]
    fn rest_request_scope_maps_moderation_permission_snapshot_and_dm_paths() {
        assert_eq!(
            rest_request_scope_from_path("/v1/moderation/guilds/10/members/9003"),
            RestRequestScope {
                guild_id: Some(10),
                channel_id: None,
            }
        );
        assert_eq!(
            rest_request_scope_from_path("/guilds/10/permission-snapshot"),
            RestRequestScope {
                guild_id: Some(10),
                channel_id: None,
            }
        );
        assert_eq!(
            rest_request_scope_from_path("/v1/dms/55/messages"),
            RestRequestScope {
                guild_id: None,
                channel_id: Some(55),
            }
        );
    }

    #[test]
    fn rest_authz_action_maps_invite_and_message_commands() {
        assert!(matches!(
            rest_authz_action_for_request(&Method::POST, "/v1/guilds/10/invites"),
            AuthzAction::Manage
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
    fn parse_message_client_frame_extracts_subscription_target() {
        let text = r#"{"type":"message.subscribe","d":{"guild_id":10,"channel_id":20}}"#;
        let frame = parse_message_client_frame(text).unwrap();

        assert_eq!(
            frame,
            ClientMessageFrameV1::Subscribe(GuildChannelSubscriptionTargetV1 {
                guild_id: 10,
                channel_id: 20,
            })
        );
    }

    #[test]
    fn parse_message_client_frame_extracts_dm_subscription_target() {
        let text = r#"{"type":"dm.subscribe","d":{"channel_id":55}}"#;
        let frame = parse_message_client_frame(text).unwrap();

        assert_eq!(
            frame,
            ClientMessageFrameV1::DmSubscribe(DmChannelSubscriptionTargetV1 { channel_id: 55 })
        );
    }

    #[test]
    fn build_message_server_frame_returns_subscribed_ack() {
        let frame = build_message_server_frame(ClientMessageFrameV1::Subscribe(
            GuildChannelSubscriptionTargetV1 {
                guild_id: 10,
                channel_id: 20,
            },
        ));

        let value = serde_json::to_value(frame).unwrap();
        assert_eq!(value["type"], "message.subscribed");
        assert_eq!(value["d"]["guild_id"], 10);
        assert_eq!(value["d"]["channel_id"], 20);
    }

    #[test]
    fn build_message_server_frame_returns_dm_subscribed_ack() {
        let frame = build_message_server_frame(ClientMessageFrameV1::DmSubscribe(
            DmChannelSubscriptionTargetV1 { channel_id: 55 },
        ));

        let value = serde_json::to_value(frame).unwrap();
        assert_eq!(value["type"], "dm.subscribed");
        assert_eq!(value["d"]["channel_id"], 55);
    }

    #[test]
    fn message_item_fixture_uses_shared_contract_shape() {
        let message = MessageItemV1 {
            message_id: 1,
            guild_id: 10,
            channel_id: 20,
            author_id: 30,
            content: "hello".to_owned(),
            created_at: "2026-03-07T10:00:00Z".to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        };
        let frame = ServerMessageFrameV1::Created(linklynx_protocol_ws::MessageEventFrameDataV1 {
            guild_id: 10,
            channel_id: 20,
            message,
        });

        let value = serde_json::to_value(frame).unwrap();
        assert_eq!(value["type"], "message.created");
        assert_eq!(value["d"]["message"]["message_id"], 1);
    }

    #[test]
    fn parse_identify_payload_extracts_ticket() {
        let text = r#"{"type":"auth.identify","d":{"method":"ticket","ticket":"abc"}}"#;
        let payload = parse_identify_payload(text).unwrap();

        assert_eq!(payload.method, "ticket");
        assert_eq!(payload.ticket, "abc");
    }
}
