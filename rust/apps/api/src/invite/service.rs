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

/// invite verify APIユースケース境界を表現する。
#[async_trait]
pub trait InviteService: Send + Sync {
    /// 公開招待コードを検証する。
    /// @param invite_code 検証対象の招待コード
    /// @returns 検証結果
    /// @throws InviteError 入力不正または依存障害時
    async fn verify_public_invite(
        &self,
        invite_code: String,
    ) -> Result<PublicInviteLookup, InviteError>;
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
    invite_code: String,
    status: PublicInviteStatus,
    guild: PublicInviteGuild,
    expires_at: Option<String>,
    uses: i32,
    max_uses: Option<i32>,
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
