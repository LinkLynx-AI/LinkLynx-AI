/// guild/channel APIエラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GuildChannelErrorKind {
    Validation,
    NotFound,
    ChannelNotFound,
    Forbidden,
    DependencyUnavailable,
}

/// guild/channel API失敗情報を保持する。
#[derive(Debug, Clone)]
pub struct GuildChannelError {
    pub kind: GuildChannelErrorKind,
    pub reason: String,
}

impl GuildChannelError {
    /// 入力検証エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 入力検証エラー
    /// @throws なし
    pub fn validation(reason: impl Into<String>) -> Self {
        Self {
            kind: GuildChannelErrorKind::Validation,
            reason: reason.into(),
        }
    }

    /// リソース未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 未存在エラー
    /// @throws なし
    pub fn not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: GuildChannelErrorKind::NotFound,
            reason: reason.into(),
        }
    }

    /// channel未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 未存在エラー
    /// @throws なし
    pub fn channel_not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: GuildChannelErrorKind::ChannelNotFound,
            reason: reason.into(),
        }
    }

    /// メンバー境界違反エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 権限拒否エラー
    /// @throws なし
    pub fn forbidden(reason: impl Into<String>) -> Self {
        Self {
            kind: GuildChannelErrorKind::Forbidden,
            reason: reason.into(),
        }
    }

    /// 依存障害エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 依存障害エラー
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: GuildChannelErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }

    /// HTTPステータスへ変換する。
    /// @param なし
    /// @returns HTTPステータス
    /// @throws なし
    pub fn status_code(&self) -> StatusCode {
        match self.kind {
            GuildChannelErrorKind::Validation => StatusCode::BAD_REQUEST,
            GuildChannelErrorKind::NotFound => StatusCode::NOT_FOUND,
            GuildChannelErrorKind::ChannelNotFound => StatusCode::NOT_FOUND,
            GuildChannelErrorKind::Forbidden => StatusCode::FORBIDDEN,
            GuildChannelErrorKind::DependencyUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    /// アプリケーションエラーコードを返す。
    /// @param なし
    /// @returns エラーコード
    /// @throws なし
    pub fn app_code(&self) -> &'static str {
        match self.kind {
            GuildChannelErrorKind::Validation => "VALIDATION_ERROR",
            GuildChannelErrorKind::NotFound => "GUILD_NOT_FOUND",
            GuildChannelErrorKind::ChannelNotFound => "CHANNEL_NOT_FOUND",
            GuildChannelErrorKind::Forbidden => "AUTHZ_DENIED",
            GuildChannelErrorKind::DependencyUnavailable => "AUTHZ_UNAVAILABLE",
        }
    }

    /// 外部向け固定メッセージを返す。
    /// @param なし
    /// @returns 公開メッセージ
    /// @throws なし
    pub fn public_message(&self) -> &'static str {
        match self.kind {
            GuildChannelErrorKind::Validation => "request payload is invalid",
            GuildChannelErrorKind::NotFound => "guild resource was not found",
            GuildChannelErrorKind::ChannelNotFound => "channel resource was not found",
            GuildChannelErrorKind::Forbidden => "access is denied by authorization policy",
            GuildChannelErrorKind::DependencyUnavailable => {
                "authorization dependency is unavailable"
            }
        }
    }
}

#[derive(Debug, Serialize)]
struct GuildChannelErrorBody {
    code: &'static str,
    message: String,
    request_id: String,
}

/// guild/channel APIエラーをHTTPレスポンスへ変換する。
/// @param error 変換対象エラー
/// @param request_id リクエスト識別子
/// @returns RESTエラーレスポンス
/// @throws なし
pub fn guild_channel_error_response(error: &GuildChannelError, request_id: String) -> Response {
    tracing::warn!(
        request_id = %request_id,
        error_kind = ?error.kind,
        reason = %error.reason,
        "guild/channel API request rejected"
    );

    let body = GuildChannelErrorBody {
        code: error.app_code(),
        message: error.public_message().to_owned(),
        request_id,
    };

    (error.status_code(), Json(body)).into_response()
}
