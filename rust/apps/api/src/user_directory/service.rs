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
    pub allow_manage: bool,
    pub member_count: i64,
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
