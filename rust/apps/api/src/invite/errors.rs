/// 招待検証APIエラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InviteErrorKind {
    Validation,
    NotFound,
    ChannelNotFound,
    Forbidden,
    InvalidInvite,
    ExpiredInvite,
    DependencyUnavailable,
}

/// 招待検証API失敗情報を保持する。
#[derive(Debug, Clone)]
pub struct InviteError {
    pub kind: InviteErrorKind,
    pub reason: String,
}

impl InviteError {
    /// 入力検証エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 入力検証エラー
    /// @throws なし
    pub fn validation(reason: impl Into<String>) -> Self {
        Self {
            kind: InviteErrorKind::Validation,
            reason: reason.into(),
        }
    }

    /// リソース未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 未存在エラー
    /// @throws なし
    pub fn not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: InviteErrorKind::NotFound,
            reason: reason.into(),
        }
    }

    /// channel未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns channel未存在エラー
    /// @throws なし
    pub fn channel_not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: InviteErrorKind::ChannelNotFound,
            reason: reason.into(),
        }
    }

    /// 権限拒否エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 権限拒否エラー
    /// @throws なし
    pub fn forbidden(reason: impl Into<String>) -> Self {
        Self {
            kind: InviteErrorKind::Forbidden,
            reason: reason.into(),
        }
    }

    /// 無効な招待エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 無効な招待エラー
    /// @throws なし
    pub fn invalid_invite(reason: impl Into<String>) -> Self {
        Self {
            kind: InviteErrorKind::InvalidInvite,
            reason: reason.into(),
        }
    }

    /// 期限切れ招待エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 期限切れ招待エラー
    /// @throws なし
    pub fn expired_invite(reason: impl Into<String>) -> Self {
        Self {
            kind: InviteErrorKind::ExpiredInvite,
            reason: reason.into(),
        }
    }

    /// 依存障害エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 依存障害エラー
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: InviteErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }

    /// HTTPステータスへ変換する。
    /// @param なし
    /// @returns HTTPステータス
    /// @throws なし
    pub fn status_code(&self) -> StatusCode {
        match self.kind {
            InviteErrorKind::Validation => StatusCode::BAD_REQUEST,
            InviteErrorKind::NotFound => StatusCode::NOT_FOUND,
            InviteErrorKind::ChannelNotFound => StatusCode::NOT_FOUND,
            InviteErrorKind::Forbidden => StatusCode::FORBIDDEN,
            InviteErrorKind::InvalidInvite | InviteErrorKind::ExpiredInvite => StatusCode::CONFLICT,
            InviteErrorKind::DependencyUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    /// アプリケーションエラーコードを返す。
    /// @param なし
    /// @returns エラーコード
    /// @throws なし
    pub fn app_code(&self) -> &'static str {
        match self.kind {
            InviteErrorKind::Validation => "VALIDATION_ERROR",
            InviteErrorKind::NotFound => "GUILD_NOT_FOUND",
            InviteErrorKind::ChannelNotFound => "CHANNEL_NOT_FOUND",
            InviteErrorKind::Forbidden => "AUTHZ_DENIED",
            InviteErrorKind::InvalidInvite => "INVITE_INVALID",
            InviteErrorKind::ExpiredInvite => "INVITE_EXPIRED",
            InviteErrorKind::DependencyUnavailable => "INVITE_UNAVAILABLE",
        }
    }

    /// 外部向け固定メッセージを返す。
    /// @param なし
    /// @returns 公開メッセージ
    /// @throws なし
    pub fn public_message(&self) -> &'static str {
        match self.kind {
            InviteErrorKind::Validation => "request payload is invalid",
            InviteErrorKind::NotFound => "guild resource was not found",
            InviteErrorKind::ChannelNotFound => "channel resource was not found",
            InviteErrorKind::Forbidden => "access is denied by authorization policy",
            InviteErrorKind::InvalidInvite => "invite is invalid",
            InviteErrorKind::ExpiredInvite => "invite is expired",
            InviteErrorKind::DependencyUnavailable => "invite dependency is unavailable",
        }
    }
}

#[derive(Debug, Serialize)]
struct InviteErrorBody {
    code: &'static str,
    message: String,
    request_id: String,
}

/// 招待検証APIエラーをHTTPレスポンスへ変換する。
/// @param error 変換対象エラー
/// @param request_id リクエスト識別子
/// @returns RESTエラーレスポンス
/// @throws なし
pub fn invite_error_response(error: &InviteError, request_id: String) -> Response {
    tracing::warn!(
        request_id = %request_id,
        error_kind = ?error.kind,
        reason = %error.reason,
        "invite request rejected"
    );

    let body = InviteErrorBody {
        code: error.app_code(),
        message: error.public_message().to_owned(),
        request_id,
    };

    (error.status_code(), Json(body)).into_response()
}
