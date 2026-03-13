/// 公開招待の状態を表現する。
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PublicInviteStatus {
    Valid,
    Invalid,
    Expired,
}

/// 公開招待に紐づくギルド最小情報を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct PublicInviteGuild {
    pub guild_id: i64,
    pub name: String,
    pub icon_key: Option<String>,
}

/// 公開招待の検証結果を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct PublicInviteLookup {
    pub status: PublicInviteStatus,
    pub invite_code: String,
    pub guild: Option<PublicInviteGuild>,
    pub expires_at: Option<String>,
    pub uses: Option<i32>,
    pub max_uses: Option<i32>,
}

/// 招待参加結果の状態を表現する。
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InviteJoinStatus {
    Joined,
    AlreadyMember,
}

/// 招待参加の結果を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InviteJoinResult {
    pub invite_code: String,
    pub guild_id: i64,
    pub status: InviteJoinStatus,
}

/// 招待作成入力を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateInviteInput {
    pub channel_id: i64,
    pub max_age_seconds: Option<i64>,
    pub max_uses: Option<i32>,
}

/// 招待に紐づくチャンネル最小情報を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InviteChannelSummary {
    pub channel_id: i64,
    pub name: String,
}

/// 招待作成結果を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CreatedInvite {
    pub invite_code: String,
    pub guild: PublicInviteGuild,
    pub channel: InviteChannelSummary,
    pub expires_at: Option<String>,
    pub uses: i32,
    pub max_uses: Option<i32>,
}

/// invite verify APIユースケース境界を表現する。
#[async_trait]
pub trait InviteService: Send + Sync {
    /// 認証済みユーザーが guild 配下の招待を作成する。
    /// @param principal_id 作成主体ID
    /// @param guild_id 対象guild_id
    /// @param input 招待作成入力
    /// @returns 作成済み招待
    /// @throws InviteError 入力不正、未存在、非権限、または依存障害時
    async fn create_invite(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        input: CreateInviteInput,
    ) -> Result<CreatedInvite, InviteError>;

    /// 公開招待コードを検証する。
    /// @param invite_code 検証対象の招待コード
    /// @returns 検証結果
    /// @throws InviteError 入力不正または依存障害時
    async fn verify_public_invite(
        &self,
        invite_code: String,
    ) -> Result<PublicInviteLookup, InviteError>;

    /// 認証済みユーザーを招待コードでギルドへ参加させる。
    /// @param principal_id 参加主体ID
    /// @param invite_code 参加対象の招待コード
    /// @returns 参加結果
    /// @throws InviteError 入力不正、招待状態不正、または依存障害時
    async fn join_invite(
        &self,
        principal_id: PrincipalId,
        invite_code: String,
    ) -> Result<InviteJoinResult, InviteError>;
}

/// 依存未構成時にfail-closeさせるサービスを表現する。
#[derive(Clone)]
pub struct UnavailableInviteService {
    reason: String,
}

impl UnavailableInviteService {
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
    fn unavailable_error(&self) -> InviteError {
        InviteError::dependency_unavailable(self.reason.clone())
    }
}

#[async_trait]
impl InviteService for UnavailableInviteService {
    /// 招待を作成する。
    /// @param _principal_id 作成主体ID
    /// @param _guild_id 対象guild_id
    /// @param _input 招待作成入力
    /// @returns なし
    /// @throws InviteError 常に依存障害
    async fn create_invite(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _input: CreateInviteInput,
    ) -> Result<CreatedInvite, InviteError> {
        Err(self.unavailable_error())
    }

    /// 公開招待コードを検証する。
    /// @param _invite_code 検証対象の招待コード
    /// @returns なし
    /// @throws InviteError 常に依存障害
    async fn verify_public_invite(
        &self,
        _invite_code: String,
    ) -> Result<PublicInviteLookup, InviteError> {
        Err(self.unavailable_error())
    }

    /// 認証済みユーザーを招待コードでギルドへ参加させる。
    /// @param _principal_id 参加主体ID
    /// @param _invite_code 参加対象の招待コード
    /// @returns なし
    /// @throws InviteError 常に依存障害
    async fn join_invite(
        &self,
        _principal_id: PrincipalId,
        _invite_code: String,
    ) -> Result<InviteJoinResult, InviteError> {
        Err(self.unavailable_error())
    }
}

/// 招待コードを正規化して検証する。
/// @param raw_invite_code 生の招待コード
/// @returns 正規化済み招待コード
/// @throws InviteError 入力不正時
fn normalize_invite_code(raw_invite_code: &str) -> Result<String, InviteError> {
    let normalized = raw_invite_code.trim();
    if normalized.is_empty() {
        return Err(InviteError::validation("invite_code_required"));
    }

    Ok(normalized.to_owned())
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct InviteRecord {
    status: PublicInviteStatus,
    guild: PublicInviteGuild,
    expires_at: Option<String>,
    uses: i32,
    max_uses: Option<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum InviteJoinDecision {
    Joined,
    AlreadyMember,
    Invalid,
    Expired,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct InviteJoinRecord {
    guild_id: i64,
    decision: InviteJoinDecision,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CreatedInviteRecord {
    guild: PublicInviteGuild,
    channel: InviteChannelSummary,
    expires_at: Option<String>,
    uses: i32,
    max_uses: Option<i32>,
}

/// 招待作成入力を検証する。
/// @param input 生の招待作成入力
/// @returns 検証済み入力
/// @throws InviteError 入力不正時
fn normalize_create_invite_input(input: CreateInviteInput) -> Result<CreateInviteInput, InviteError> {
    if input.channel_id <= 0 {
        return Err(InviteError::validation("channel_id_must_be_positive"));
    }

    let max_age_seconds = match input.max_age_seconds {
        Some(value) if value <= 0 => {
            return Err(InviteError::validation("max_age_seconds_must_be_positive"));
        }
        Some(value) => Some(value),
        None => None,
    };

    let max_uses = match input.max_uses {
        Some(value) if value <= 0 => {
            return Err(InviteError::validation("max_uses_must_be_positive"));
        }
        Some(value) => Some(value),
        None => None,
    };

    Ok(CreateInviteInput {
        channel_id: input.channel_id,
        max_age_seconds,
        max_uses,
    })
}

/// DB取得結果を公開招待レスポンスへ変換する。
/// @param invite_code 検証対象の招待コード
/// @param record DB取得結果
/// @returns 公開招待レスポンス
/// @throws InviteError 入力不正時
fn build_public_invite_lookup(
    invite_code: String,
    record: Option<InviteRecord>,
) -> Result<PublicInviteLookup, InviteError> {
    let normalized_invite_code = normalize_invite_code(&invite_code)?;

    match record {
        Some(record) => Ok(PublicInviteLookup {
            status: record.status,
            invite_code: normalized_invite_code,
            guild: Some(record.guild),
            expires_at: record.expires_at,
            uses: Some(record.uses),
            max_uses: record.max_uses,
        }),
        None => Ok(PublicInviteLookup {
            status: PublicInviteStatus::Invalid,
            invite_code: normalized_invite_code,
            guild: None,
            expires_at: None,
            uses: None,
            max_uses: None,
        }),
    }
}

/// DB取得結果を招待参加レスポンスへ変換する。
/// @param invite_code 参加対象の招待コード
/// @param record DB取得結果
/// @returns 招待参加レスポンス
/// @throws InviteError 入力不正または招待状態不正時
fn build_invite_join_result(
    invite_code: String,
    record: Option<InviteJoinRecord>,
) -> Result<InviteJoinResult, InviteError> {
    let normalized_invite_code = normalize_invite_code(&invite_code)?;

    match record {
        Some(InviteJoinRecord {
            guild_id,
            decision: InviteJoinDecision::Joined,
        }) => Ok(InviteJoinResult {
            invite_code: normalized_invite_code,
            guild_id,
            status: InviteJoinStatus::Joined,
        }),
        Some(InviteJoinRecord {
            guild_id,
            decision: InviteJoinDecision::AlreadyMember,
        }) => Ok(InviteJoinResult {
            invite_code: normalized_invite_code,
            guild_id,
            status: InviteJoinStatus::AlreadyMember,
        }),
        Some(InviteJoinRecord {
            decision: InviteJoinDecision::Expired,
            ..
        }) => Err(InviteError::expired_invite("invite_expired")),
        Some(InviteJoinRecord {
            decision: InviteJoinDecision::Invalid,
            ..
        })
        | None => Err(InviteError::invalid_invite("invite_invalid")),
    }
}

/// 招待作成レコードをレスポンスへ変換する。
/// @param invite_code 作成済み招待コード
/// @param record 作成レコード
/// @returns 招待作成レスポンス
/// @throws InviteError 入力不正時
fn build_created_invite(
    invite_code: String,
    record: CreatedInviteRecord,
) -> Result<CreatedInvite, InviteError> {
    let normalized_invite_code = normalize_invite_code(&invite_code)?;

    Ok(CreatedInvite {
        invite_code: normalized_invite_code,
        guild: record.guild,
        channel: record.channel,
        expires_at: record.expires_at,
        uses: record.uses,
        max_uses: record.max_uses,
    })
}
