/// server rail向けのguild要約を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct GuildSummary {
    pub guild_id: i64,
    pub name: String,
    pub icon_key: Option<String>,
    pub joined_at: String,
}

/// guild作成結果を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CreatedGuild {
    pub guild_id: i64,
    pub name: String,
    pub icon_key: Option<String>,
    pub owner_id: i64,
}

/// guild更新入力を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuildPatchInput {
    pub name: Option<String>,
    pub icon_key: Option<Option<String>>,
}

impl GuildPatchInput {
    /// 更新対象が空かを判定する。
    /// @param なし
    /// @returns 1項目も指定されていない場合はtrue
    /// @throws なし
    pub fn is_empty(&self) -> bool {
        self.name.is_none() && self.icon_key.is_none()
    }
}

/// channel一覧要素を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChannelSummary {
    pub channel_id: i64,
    pub guild_id: i64,
    pub name: String,
    pub created_at: String,
}

/// channel作成結果を表現する。
pub type CreatedChannel = ChannelSummary;

/// channel更新入力を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChannelPatchInput {
    pub name: String,
}

/// guild/channel APIユースケース境界を表現する。
#[async_trait]
pub trait GuildChannelService: Send + Sync {
    /// principalが所属するguild一覧を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @returns guild一覧
    /// @throws GuildChannelError 入力不正または依存障害時
    async fn list_guilds(
        &self,
        principal_id: PrincipalId,
    ) -> Result<Vec<GuildSummary>, GuildChannelError>;

    /// guildを作成しowner bootstrapを実行する。
    /// @param principal_id 作成主体
    /// @param name guild名
    /// @returns 作成結果
    /// @throws GuildChannelError 入力不正または依存障害時
    async fn create_guild(
        &self,
        principal_id: PrincipalId,
        name: String,
    ) -> Result<CreatedGuild, GuildChannelError>;

    /// guild設定を更新する。
    /// @param principal_id 更新主体
    /// @param guild_id 対象guild_id
    /// @param patch 更新入力
    /// @returns 更新後guild
    /// @throws GuildChannelError 入力不正/非権限/未存在/依存障害時
    async fn update_guild(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        patch: GuildPatchInput,
    ) -> Result<CreatedGuild, GuildChannelError>;

    /// guildを削除する。
    /// @param principal_id 削除主体
    /// @param guild_id 対象guild_id
    /// @returns なし
    /// @throws GuildChannelError 非権限/未存在/依存障害時
    async fn delete_guild(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<(), GuildChannelError>;

    /// guild配下のchannel一覧を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns channel一覧
    /// @throws GuildChannelError 非メンバー/未存在/依存障害時
    async fn list_guild_channels(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<Vec<ChannelSummary>, GuildChannelError>;

    /// guild配下へchannelを作成する。
    /// @param principal_id 作成主体
    /// @param guild_id 対象guild_id
    /// @param name channel名
    /// @returns 作成結果
    /// @throws GuildChannelError 入力不正/非メンバー/未存在/依存障害時
    async fn create_guild_channel(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        name: String,
    ) -> Result<CreatedChannel, GuildChannelError>;

    /// channelを更新する。
    /// @param principal_id 更新主体
    /// @param channel_id 対象channel_id
    /// @param patch 更新入力
    /// @returns 更新結果
    /// @throws GuildChannelError 入力不正/境界違反/未存在/依存障害時
    async fn update_guild_channel(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
        patch: ChannelPatchInput,
    ) -> Result<ChannelSummary, GuildChannelError>;

    /// channelを削除する。
    /// @param principal_id 削除主体
    /// @param channel_id 対象channel_id
    /// @returns なし
    /// @throws GuildChannelError 境界違反/未存在/依存障害時
    async fn delete_guild_channel(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
    ) -> Result<(), GuildChannelError>;
}

/// 依存未構成時にfail-closeさせるサービスを表現する。
#[derive(Clone)]
pub struct UnavailableGuildChannelService {
    reason: String,
}

impl UnavailableGuildChannelService {
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
    fn unavailable_error(&self) -> GuildChannelError {
        GuildChannelError::dependency_unavailable(self.reason.clone())
    }
}

#[async_trait]
impl GuildChannelService for UnavailableGuildChannelService {
    /// guild一覧を返す。
    /// @param _principal_id 認証済みprincipal_id
    /// @returns なし
    /// @throws GuildChannelError 常に依存障害
    async fn list_guilds(
        &self,
        _principal_id: PrincipalId,
    ) -> Result<Vec<GuildSummary>, GuildChannelError> {
        Err(self.unavailable_error())
    }

    /// guildを作成する。
    /// @param _principal_id 作成主体
    /// @param _name guild名
    /// @returns なし
    /// @throws GuildChannelError 常に依存障害
    async fn create_guild(
        &self,
        _principal_id: PrincipalId,
        _name: String,
    ) -> Result<CreatedGuild, GuildChannelError> {
        Err(self.unavailable_error())
    }

    /// guild設定を更新する。
    /// @param _principal_id 更新主体
    /// @param _guild_id 対象guild_id
    /// @param _patch 更新入力
    /// @returns なし
    /// @throws GuildChannelError 常に依存障害
    async fn update_guild(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _patch: GuildPatchInput,
    ) -> Result<CreatedGuild, GuildChannelError> {
        Err(self.unavailable_error())
    }

    /// guildを削除する。
    /// @param _principal_id 削除主体
    /// @param _guild_id 対象guild_id
    /// @returns なし
    /// @throws GuildChannelError 常に依存障害
    async fn delete_guild(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
    ) -> Result<(), GuildChannelError> {
        Err(self.unavailable_error())
    }

    /// channel一覧を返す。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _guild_id 対象guild_id
    /// @returns なし
    /// @throws GuildChannelError 常に依存障害
    async fn list_guild_channels(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
    ) -> Result<Vec<ChannelSummary>, GuildChannelError> {
        Err(self.unavailable_error())
    }

    /// channelを作成する。
    /// @param _principal_id 作成主体
    /// @param _guild_id 対象guild_id
    /// @param _name channel名
    /// @returns なし
    /// @throws GuildChannelError 常に依存障害
    async fn create_guild_channel(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _name: String,
    ) -> Result<CreatedChannel, GuildChannelError> {
        Err(self.unavailable_error())
    }

    /// channelを更新する。
    /// @param _principal_id 更新主体
    /// @param _channel_id 対象channel_id
    /// @param _patch 更新入力
    /// @returns なし
    /// @throws GuildChannelError 常に依存障害
    async fn update_guild_channel(
        &self,
        _principal_id: PrincipalId,
        _channel_id: i64,
        _patch: ChannelPatchInput,
    ) -> Result<ChannelSummary, GuildChannelError> {
        Err(self.unavailable_error())
    }

    /// channelを削除する。
    /// @param _principal_id 削除主体
    /// @param _channel_id 対象channel_id
    /// @returns なし
    /// @throws GuildChannelError 常に依存障害
    async fn delete_guild_channel(
        &self,
        _principal_id: PrincipalId,
        _channel_id: i64,
    ) -> Result<(), GuildChannelError> {
        Err(self.unavailable_error())
    }
}

const GUILD_NAME_MAX_CHARS: usize = 100;
const CHANNEL_NAME_MAX_CHARS: usize = 100;
const ICON_KEY_MAX_CHARS: usize = 512;

/// 入力名をtrimし空文字を拒否する。
/// @param raw_name 入力文字列
/// @param reason 検証失敗理由
/// @returns 正規化済み文字列
/// @throws GuildChannelError 空文字入力時
fn normalize_non_empty_name(raw_name: &str, reason: &'static str) -> Result<String, GuildChannelError> {
    let normalized = raw_name.trim();
    if normalized.is_empty() {
        return Err(GuildChannelError::validation(reason));
    }

    Ok(normalized.to_owned())
}

/// guild名を正規化して検証する。
/// @param raw_name 生のguild名
/// @returns 正規化済みguild名
/// @throws GuildChannelError 入力不正時
fn normalize_guild_name(raw_name: &str) -> Result<String, GuildChannelError> {
    let normalized = normalize_non_empty_name(raw_name, "guild_name_required")?;
    if normalized.chars().count() > GUILD_NAME_MAX_CHARS {
        return Err(GuildChannelError::validation("guild_name_too_long"));
    }

    Ok(normalized)
}

/// channel更新入力を正規化して検証する。
/// @param patch 更新入力
/// @returns 正規化済みチャンネル名
/// @throws GuildChannelError 入力不正時
fn normalize_channel_patch_input(patch: ChannelPatchInput) -> Result<String, GuildChannelError> {
    let normalized = normalize_non_empty_name(&patch.name, "channel_name_required")?;
    if normalized.chars().count() > CHANNEL_NAME_MAX_CHARS {
        return Err(GuildChannelError::validation("channel_name_too_long"));
    }

    Ok(normalized)
}

/// icon_keyを正規化して検証する。
/// @param raw_icon_key 生のicon_key
/// @returns 正規化済みicon_key
/// @throws GuildChannelError 入力不正時
fn normalize_icon_key(raw_icon_key: Option<String>) -> Result<Option<String>, GuildChannelError> {
    let Some(raw_icon_key) = raw_icon_key else {
        return Ok(None);
    };

    let normalized = raw_icon_key.trim();
    if normalized.is_empty() {
        return Ok(None);
    }
    if normalized.chars().count() > ICON_KEY_MAX_CHARS {
        return Err(GuildChannelError::validation("icon_key_too_long"));
    }
    if !is_valid_icon_key(normalized) {
        return Err(GuildChannelError::validation("icon_key_invalid_format"));
    }

    Ok(Some(normalized.to_owned()))
}

/// icon_key形式を検証する。
/// @param value 検証対象icon_key
/// @returns 許可形式ならtrue
/// @throws なし
fn is_valid_icon_key(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'_' | b'-' | b'.'))
}
