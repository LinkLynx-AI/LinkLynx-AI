/// guild member read model を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct GuildMemberDirectoryEntry {
    pub user_id: i64,
    pub display_name: String,
    pub avatar_key: Option<String>,
    pub status_text: Option<String>,
    pub nickname: Option<String>,
    pub joined_at: String,
    pub role_keys: Vec<String>,
}

/// guild role read model を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct GuildRoleDirectoryEntry {
    pub role_key: String,
    pub name: String,
    pub priority: i32,
    pub allow_view: bool,
    pub allow_post: bool,
    pub allow_manage: bool,
    pub is_system: bool,
    pub member_count: i64,
}

/// guild role create input を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateGuildRoleInput {
    pub name: String,
    pub allow_view: bool,
    pub allow_post: bool,
    pub allow_manage: bool,
}

/// guild role patch input を表現する。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct GuildRolePatchInput {
    pub name: Option<String>,
    pub allow_view: Option<bool>,
    pub allow_post: Option<bool>,
    pub allow_manage: Option<bool>,
}

impl GuildRolePatchInput {
    /// patch が空かどうかを判定する。
    /// @param なし
    /// @returns 変更がない場合は `true`
    /// @throws なし
    pub fn is_empty(&self) -> bool {
        self.name.is_none()
            && self.allow_view.is_none()
            && self.allow_post.is_none()
            && self.allow_manage.is_none()
    }
}

/// channel permission override transport value を表現する。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PermissionOverrideValue {
    Allow,
    Deny,
    Inherit,
}

impl PermissionOverrideValue {
    /// tri-state DB値から transport 値へ変換する。
    /// @param value DB tri-state
    /// @returns transport 値
    /// @throws なし
    pub fn from_option_bool(value: Option<bool>) -> Self {
        match value {
            Some(true) => Self::Allow,
            Some(false) => Self::Deny,
            None => Self::Inherit,
        }
    }

    /// transport 値を tri-state DB値へ変換する。
    /// @param なし
    /// @returns DB tri-state
    /// @throws なし
    pub fn as_option_bool(self) -> Option<bool> {
        match self {
            Self::Allow => Some(true),
            Self::Deny => Some(false),
            Self::Inherit => None,
        }
    }
}

/// channel role override read model を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChannelRolePermissionOverrideEntry {
    pub role_key: String,
    pub subject_name: String,
    pub is_system: bool,
    pub can_view: PermissionOverrideValue,
    pub can_post: PermissionOverrideValue,
}

/// channel user override read model を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChannelUserPermissionOverrideEntry {
    pub user_id: i64,
    pub subject_name: String,
    pub can_view: PermissionOverrideValue,
    pub can_post: PermissionOverrideValue,
}

/// channel permission read model を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChannelPermissionDirectoryEntry {
    pub role_overrides: Vec<ChannelRolePermissionOverrideEntry>,
    pub user_overrides: Vec<ChannelUserPermissionOverrideEntry>,
}

/// channel role override upsert input を表現する。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChannelRolePermissionOverrideInput {
    pub role_key: String,
    pub can_view: PermissionOverrideValue,
    pub can_post: PermissionOverrideValue,
}

/// channel user override upsert input を表現する。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChannelUserPermissionOverrideInput {
    pub user_id: i64,
    pub can_view: PermissionOverrideValue,
    pub can_post: PermissionOverrideValue,
}

/// channel permission replacement input を表現する。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReplaceChannelPermissionsInput {
    pub role_overrides: Vec<ChannelRolePermissionOverrideInput>,
    pub user_overrides: Vec<ChannelUserPermissionOverrideInput>,
}

/// channel permission update 結果を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChannelPermissionUpdateResult {
    pub permissions: ChannelPermissionDirectoryEntry,
    pub changed_role_overrides: bool,
    pub changed_user_ids: Vec<i64>,
}

/// 他ユーザープロフィール read model を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct UserProfileDirectoryEntry {
    pub user_id: i64,
    pub display_name: String,
    pub status_text: Option<String>,
    pub avatar_key: Option<String>,
    pub banner_key: Option<String>,
    pub created_at: String,
}

/// user directory APIユースケース境界を表現する。
#[async_trait]
pub trait UserDirectoryService: Send + Sync {
    /// guild member 一覧を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns member 一覧
    /// @throws UserDirectoryError 権限拒否/依存障害時
    async fn list_guild_members(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<Vec<GuildMemberDirectoryEntry>, UserDirectoryError>;

    /// guild role 一覧を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns role 一覧
    /// @throws UserDirectoryError 権限拒否/依存障害時
    async fn list_guild_roles(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<Vec<GuildRoleDirectoryEntry>, UserDirectoryError>;

    /// guild role を作成する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param input 作成入力
    /// @returns 作成済み role
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn create_guild_role(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        input: CreateGuildRoleInput,
    ) -> Result<GuildRoleDirectoryEntry, UserDirectoryError>;

    /// guild role を更新する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param role_key 対象role_key
    /// @param patch 更新内容
    /// @returns 更新済み role
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn update_guild_role(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        role_key: &str,
        patch: GuildRolePatchInput,
    ) -> Result<GuildRoleDirectoryEntry, UserDirectoryError>;

    /// guild role を削除する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param role_key 対象role_key
    /// @returns なし
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn delete_guild_role(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        role_key: &str,
    ) -> Result<(), UserDirectoryError>;

    /// guild custom role の順序を置換する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param role_keys custom role の新順序
    /// @returns 更新後 role 一覧
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn reorder_guild_roles(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        role_keys: Vec<String>,
    ) -> Result<Vec<GuildRoleDirectoryEntry>, UserDirectoryError>;

    /// guild member への role 割当を置換する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param member_id 対象member_id
    /// @param role_keys 最終 role 一覧
    /// @returns 更新後 member
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn replace_member_roles(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        member_id: i64,
        role_keys: Vec<String>,
    ) -> Result<GuildMemberDirectoryEntry, UserDirectoryError>;

    /// channel permission を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param channel_id 対象channel_id
    /// @returns permission 一覧
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn get_channel_permissions(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<ChannelPermissionDirectoryEntry, UserDirectoryError>;

    /// channel permission を置換する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param channel_id 対象channel_id
    /// @param input 最終 override 一覧
    /// @returns 更新後 permission と invalidation 用情報
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn replace_channel_permissions(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
        input: ReplaceChannelPermissionsInput,
    ) -> Result<ChannelPermissionUpdateResult, UserDirectoryError>;

    /// 他ユーザープロフィールを返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param user_id 対象user_id
    /// @returns プロフィール
    /// @throws UserDirectoryError 未存在/権限拒否/依存障害時
    async fn get_user_profile(
        &self,
        principal_id: PrincipalId,
        user_id: i64,
    ) -> Result<UserProfileDirectoryEntry, UserDirectoryError>;
}

/// 依存未構成時に fail-close させるサービスを表現する。
#[derive(Clone)]
pub struct UnavailableUserDirectoryService {
    reason: String,
}

impl UnavailableUserDirectoryService {
    /// 依存未構成サービスを生成する。
    /// @param reason 障害理由
    /// @returns 依存未構成サービス
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }

    /// 依存未構成エラーを返す。
    /// @param なし
    /// @returns 依存障害エラー
    /// @throws なし
    fn unavailable_error(&self) -> UserDirectoryError {
        UserDirectoryError::dependency_unavailable(self.reason.clone())
    }
}

#[async_trait]
impl UserDirectoryService for UnavailableUserDirectoryService {
    /// guild member 一覧を返す。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _guild_id 対象guild_id
    /// @returns なし
    /// @throws UserDirectoryError 常に依存障害
    async fn list_guild_members(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
    ) -> Result<Vec<GuildMemberDirectoryEntry>, UserDirectoryError> {
        Err(self.unavailable_error())
    }

    /// guild role 一覧を返す。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _guild_id 対象guild_id
    /// @returns なし
    /// @throws UserDirectoryError 常に依存障害
    async fn list_guild_roles(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
    ) -> Result<Vec<GuildRoleDirectoryEntry>, UserDirectoryError> {
        Err(self.unavailable_error())
    }

    /// guild role を作成する。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _guild_id 対象guild_id
    /// @param _input 作成入力
    /// @returns なし
    /// @throws UserDirectoryError 常に依存障害
    async fn create_guild_role(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _input: CreateGuildRoleInput,
    ) -> Result<GuildRoleDirectoryEntry, UserDirectoryError> {
        Err(self.unavailable_error())
    }

    /// guild role を更新する。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _guild_id 対象guild_id
    /// @param _role_key 対象role_key
    /// @param _patch 更新内容
    /// @returns なし
    /// @throws UserDirectoryError 常に依存障害
    async fn update_guild_role(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _role_key: &str,
        _patch: GuildRolePatchInput,
    ) -> Result<GuildRoleDirectoryEntry, UserDirectoryError> {
        Err(self.unavailable_error())
    }

    /// guild role を削除する。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _guild_id 対象guild_id
    /// @param _role_key 対象role_key
    /// @returns なし
    /// @throws UserDirectoryError 常に依存障害
    async fn delete_guild_role(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _role_key: &str,
    ) -> Result<(), UserDirectoryError> {
        Err(self.unavailable_error())
    }

    /// guild custom role の順序を置換する。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _guild_id 対象guild_id
    /// @param _role_keys custom role の新順序
    /// @returns なし
    /// @throws UserDirectoryError 常に依存障害
    async fn reorder_guild_roles(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _role_keys: Vec<String>,
    ) -> Result<Vec<GuildRoleDirectoryEntry>, UserDirectoryError> {
        Err(self.unavailable_error())
    }

    /// guild member への role 割当を置換する。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _guild_id 対象guild_id
    /// @param _member_id 対象member_id
    /// @param _role_keys 最終 role 一覧
    /// @returns なし
    /// @throws UserDirectoryError 常に依存障害
    async fn replace_member_roles(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _member_id: i64,
        _role_keys: Vec<String>,
    ) -> Result<GuildMemberDirectoryEntry, UserDirectoryError> {
        Err(self.unavailable_error())
    }

    /// channel permission を返す。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _guild_id 対象guild_id
    /// @param _channel_id 対象channel_id
    /// @returns なし
    /// @throws UserDirectoryError 常に依存障害
    async fn get_channel_permissions(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _channel_id: i64,
    ) -> Result<ChannelPermissionDirectoryEntry, UserDirectoryError> {
        Err(self.unavailable_error())
    }

    /// channel permission を置換する。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _guild_id 対象guild_id
    /// @param _channel_id 対象channel_id
    /// @param _input 最終 override 一覧
    /// @returns なし
    /// @throws UserDirectoryError 常に依存障害
    async fn replace_channel_permissions(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _channel_id: i64,
        _input: ReplaceChannelPermissionsInput,
    ) -> Result<ChannelPermissionUpdateResult, UserDirectoryError> {
        Err(self.unavailable_error())
    }

    /// 他ユーザープロフィールを返す。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _user_id 対象user_id
    /// @returns なし
    /// @throws UserDirectoryError 常に依存障害
    async fn get_user_profile(
        &self,
        _principal_id: PrincipalId,
        _user_id: i64,
    ) -> Result<UserProfileDirectoryEntry, UserDirectoryError> {
        Err(self.unavailable_error())
    }
}
