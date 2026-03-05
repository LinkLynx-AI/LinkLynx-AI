/// モデレーション対象種別を表現する。
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModerationTargetType {
    Message,
    User,
}

impl ModerationTargetType {
    /// API入力ラベルから対象種別を解釈する。
    /// @param raw 生文字列
    /// @returns 解釈済み対象種別
    /// @throws なし
    pub fn parse_api_label(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "message" => Some(Self::Message),
            "user" => Some(Self::User),
            _ => None,
        }
    }

    /// DB保存向けラベルへ変換する。
    /// @param なし
    /// @returns DBラベル
    /// @throws なし
    pub fn as_db_label(&self) -> &'static str {
        match self {
            Self::Message => "message",
            Self::User => "user",
        }
    }

    /// DBラベルから対象種別を解釈する。
    /// @param raw DBラベル
    /// @returns 対象種別
    /// @throws なし
    pub fn parse_db_label(raw: &str) -> Option<Self> {
        match raw {
            "message" => Some(Self::Message),
            "user" => Some(Self::User),
            _ => None,
        }
    }
}

/// モデレーション通報ステータスを表現する。
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModerationReportStatus {
    Open,
    Resolved,
}

impl ModerationReportStatus {
    /// DBラベルから通報ステータスを解釈する。
    /// @param raw DBラベル
    /// @returns 通報ステータス
    /// @throws なし
    pub fn parse_db_label(raw: &str) -> Option<Self> {
        match raw {
            "open" => Some(Self::Open),
            "resolved" => Some(Self::Resolved),
            _ => None,
        }
    }
}

/// 通報作成入力を表現する。
#[derive(Debug, Clone)]
pub struct CreateModerationReportInput {
    pub guild_id: i64,
    pub target_type: ModerationTargetType,
    pub target_id: i64,
    pub reason: String,
}

/// ミュート作成入力を表現する。
#[derive(Debug, Clone)]
pub struct CreateModerationMuteInput {
    pub guild_id: i64,
    pub target_user_id: i64,
    pub reason: String,
    pub expires_at: Option<String>,
}

/// 通報要約を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ModerationReport {
    pub report_id: i64,
    pub guild_id: i64,
    pub reporter_id: i64,
    pub target_type: ModerationTargetType,
    pub target_id: i64,
    pub reason: String,
    pub status: ModerationReportStatus,
    pub resolved_by: Option<i64>,
    pub resolved_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// ミュート情報を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ModerationMute {
    pub mute_id: i64,
    pub guild_id: i64,
    pub target_user_id: i64,
    pub reason: String,
    pub created_by: i64,
    pub expires_at: Option<String>,
    pub created_at: String,
}

/// モデレーションAPIユースケース境界を表現する。
#[async_trait]
pub trait ModerationService: Send + Sync {
    /// 通報を作成する。
    /// @param principal_id 実行主体
    /// @param input 通報作成入力
    /// @returns 作成済み通報
    /// @throws ModerationError 入力不正/権限拒否/依存障害時
    async fn create_report(
        &self,
        principal_id: PrincipalId,
        input: CreateModerationReportInput,
    ) -> Result<ModerationReport, ModerationError>;

    /// ミュートを作成または更新する。
    /// @param principal_id 実行主体
    /// @param input ミュート入力
    /// @returns ミュート情報
    /// @throws ModerationError 入力不正/権限拒否/依存障害時
    async fn create_mute(
        &self,
        principal_id: PrincipalId,
        input: CreateModerationMuteInput,
    ) -> Result<ModerationMute, ModerationError>;

    /// モデレーションキューを返す。
    /// @param principal_id 実行主体
    /// @param guild_id 対象guild_id
    /// @returns 通報一覧
    /// @throws ModerationError 権限拒否/依存障害時
    async fn list_reports(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<Vec<ModerationReport>, ModerationError>;

    /// 通報詳細を返す。
    /// @param principal_id 実行主体
    /// @param guild_id 対象guild_id
    /// @param report_id 対象report_id
    /// @returns 通報詳細
    /// @throws ModerationError 未存在/権限拒否/依存障害時
    async fn get_report(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        report_id: i64,
    ) -> Result<ModerationReport, ModerationError>;

    /// 通報を resolve へ遷移する。
    /// @param principal_id 実行主体
    /// @param guild_id 対象guild_id
    /// @param report_id 対象report_id
    /// @returns 遷移後の通報
    /// @throws ModerationError 未存在/権限拒否/依存障害時
    async fn resolve_report(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        report_id: i64,
    ) -> Result<ModerationReport, ModerationError>;

    /// 通報を reopen へ遷移する。
    /// @param principal_id 実行主体
    /// @param guild_id 対象guild_id
    /// @param report_id 対象report_id
    /// @returns 遷移後の通報
    /// @throws ModerationError 未存在/権限拒否/依存障害時
    async fn reopen_report(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        report_id: i64,
    ) -> Result<ModerationReport, ModerationError>;
}

/// 依存未構成時に fail-close させるサービスを表現する。
#[derive(Clone)]
pub struct UnavailableModerationService {
    reason: String,
}

impl UnavailableModerationService {
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
    fn unavailable_error(&self) -> ModerationError {
        ModerationError::dependency_unavailable(self.reason.clone())
    }
}

#[async_trait]
impl ModerationService for UnavailableModerationService {
    /// 通報を作成する。
    /// @param _principal_id 実行主体
    /// @param _input 通報作成入力
    /// @returns なし
    /// @throws ModerationError 常に依存障害
    async fn create_report(
        &self,
        _principal_id: PrincipalId,
        _input: CreateModerationReportInput,
    ) -> Result<ModerationReport, ModerationError> {
        Err(self.unavailable_error())
    }

    /// ミュートを作成または更新する。
    /// @param _principal_id 実行主体
    /// @param _input ミュート入力
    /// @returns なし
    /// @throws ModerationError 常に依存障害
    async fn create_mute(
        &self,
        _principal_id: PrincipalId,
        _input: CreateModerationMuteInput,
    ) -> Result<ModerationMute, ModerationError> {
        Err(self.unavailable_error())
    }

    /// モデレーションキューを返す。
    /// @param _principal_id 実行主体
    /// @param _guild_id 対象guild_id
    /// @returns なし
    /// @throws ModerationError 常に依存障害
    async fn list_reports(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
    ) -> Result<Vec<ModerationReport>, ModerationError> {
        Err(self.unavailable_error())
    }

    /// 通報詳細を返す。
    /// @param _principal_id 実行主体
    /// @param _guild_id 対象guild_id
    /// @param _report_id 対象report_id
    /// @returns なし
    /// @throws ModerationError 常に依存障害
    async fn get_report(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _report_id: i64,
    ) -> Result<ModerationReport, ModerationError> {
        Err(self.unavailable_error())
    }

    /// 通報を resolve へ遷移する。
    /// @param _principal_id 実行主体
    /// @param _guild_id 対象guild_id
    /// @param _report_id 対象report_id
    /// @returns なし
    /// @throws ModerationError 常に依存障害
    async fn resolve_report(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _report_id: i64,
    ) -> Result<ModerationReport, ModerationError> {
        Err(self.unavailable_error())
    }

    /// 通報を reopen へ遷移する。
    /// @param _principal_id 実行主体
    /// @param _guild_id 対象guild_id
    /// @param _report_id 対象report_id
    /// @returns なし
    /// @throws ModerationError 常に依存障害
    async fn reopen_report(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _report_id: i64,
    ) -> Result<ModerationReport, ModerationError> {
        Err(self.unavailable_error())
    }
}

/// 理由文字列をtrimし空文字を拒否する。
/// @param raw_reason 入力理由文字列
/// @param reason 検証失敗理由
/// @returns 正規化済み理由
/// @throws ModerationError 理由不正時
pub fn normalize_non_empty_reason(
    raw_reason: &str,
    reason: &'static str,
) -> Result<String, ModerationError> {
    let normalized = raw_reason.trim();
    if normalized.is_empty() {
        return Err(ModerationError::validation(reason));
    }
    if normalized.chars().count() > 1_000 {
        return Err(ModerationError::validation("reason_too_long"));
    }

    Ok(normalized.to_owned())
}

/// 正のIDを検証する。
/// @param value 入力値
/// @param reason 検証失敗理由
/// @returns 検証済みID
/// @throws ModerationError 値不正時
pub fn normalize_positive_id(value: i64, reason: &'static str) -> Result<i64, ModerationError> {
    if value <= 0 {
        return Err(ModerationError::validation(reason));
    }

    Ok(value)
}

/// 期限入力をtrimし空文字をnullへ正規化する。
/// @param expires_at 期限入力
/// @returns 正規化済み期限
/// @throws ModerationError 不正入力時
pub fn normalize_optional_expires_at(
    expires_at: Option<String>,
) -> Result<Option<String>, ModerationError> {
    let Some(raw) = expires_at else {
        return Ok(None);
    };

    let normalized = raw.trim();
    if normalized.is_empty() {
        return Ok(None);
    }
    if normalized.chars().count() > 64 {
        return Err(ModerationError::validation("expires_at_too_long"));
    }

    Ok(Some(normalized.to_owned()))
}
