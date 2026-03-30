/// user directory APIエラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserDirectoryErrorKind {
    Validation,
    UserNotFound,
    MemberNotFound,
    RoleNotFound,
    ChannelNotFound,
    GuildNotFound,
    Forbidden,
    DependencyUnavailable,
}

/// user directory API失敗情報を保持する。
#[derive(Debug, Clone)]
pub struct UserDirectoryError {
    pub kind: UserDirectoryErrorKind,
    pub reason: String,
}

impl UserDirectoryError {
    /// 入力検証エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 入力検証エラー
    /// @throws なし
    pub fn validation(reason: impl Into<String>) -> Self {
        Self {
            kind: UserDirectoryErrorKind::Validation,
            reason: reason.into(),
        }
    }

    /// 未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 未存在エラー
    /// @throws なし
    pub fn user_not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: UserDirectoryErrorKind::UserNotFound,
            reason: reason.into(),
        }
    }

    /// member未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns member未存在エラー
    /// @throws なし
    pub fn member_not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: UserDirectoryErrorKind::MemberNotFound,
            reason: reason.into(),
        }
    }

    /// role未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns role未存在エラー
    /// @throws なし
    pub fn role_not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: UserDirectoryErrorKind::RoleNotFound,
            reason: reason.into(),
        }
    }

    /// channel未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns channel未存在エラー
    /// @throws なし
    pub fn channel_not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: UserDirectoryErrorKind::ChannelNotFound,
            reason: reason.into(),
        }
    }

    /// guild未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns guild未存在エラー
    /// @throws なし
    pub fn guild_not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: UserDirectoryErrorKind::GuildNotFound,
            reason: reason.into(),
        }
    }

    /// 権限拒否エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 権限拒否エラー
    /// @throws なし
    pub fn forbidden(reason: impl Into<String>) -> Self {
        Self {
            kind: UserDirectoryErrorKind::Forbidden,
            reason: reason.into(),
        }
    }

    /// 依存障害エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 依存障害エラー
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: UserDirectoryErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }

    /// HTTPステータスへ変換する。
    /// @param なし
    /// @returns HTTPステータス
    /// @throws なし
    pub fn status_code(&self) -> StatusCode {
        match self.kind {
            UserDirectoryErrorKind::Validation => StatusCode::BAD_REQUEST,
            UserDirectoryErrorKind::UserNotFound => StatusCode::NOT_FOUND,
            UserDirectoryErrorKind::MemberNotFound => StatusCode::NOT_FOUND,
            UserDirectoryErrorKind::RoleNotFound => StatusCode::NOT_FOUND,
            UserDirectoryErrorKind::ChannelNotFound => StatusCode::NOT_FOUND,
            UserDirectoryErrorKind::GuildNotFound => StatusCode::NOT_FOUND,
            UserDirectoryErrorKind::Forbidden => StatusCode::FORBIDDEN,
            UserDirectoryErrorKind::DependencyUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    /// アプリケーションエラーコードを返す。
    /// @param なし
    /// @returns エラーコード
    /// @throws なし
    pub fn app_code(&self) -> &'static str {
        match self.kind {
            UserDirectoryErrorKind::Validation => "VALIDATION_ERROR",
            UserDirectoryErrorKind::UserNotFound => "USER_NOT_FOUND",
            UserDirectoryErrorKind::MemberNotFound => "MEMBER_NOT_FOUND",
            UserDirectoryErrorKind::RoleNotFound => "ROLE_NOT_FOUND",
            UserDirectoryErrorKind::ChannelNotFound => "CHANNEL_NOT_FOUND",
            UserDirectoryErrorKind::GuildNotFound => "GUILD_NOT_FOUND",
            UserDirectoryErrorKind::Forbidden => "AUTHZ_DENIED",
            UserDirectoryErrorKind::DependencyUnavailable => "AUTHZ_UNAVAILABLE",
        }
    }

    /// 外部向け固定メッセージを返す。
    /// @param なし
    /// @returns 公開メッセージ
    /// @throws なし
    pub fn public_message(&self) -> &'static str {
        match self.kind {
            UserDirectoryErrorKind::Validation => "request payload is invalid",
            UserDirectoryErrorKind::UserNotFound => "user resource was not found",
            UserDirectoryErrorKind::MemberNotFound => "member resource was not found",
            UserDirectoryErrorKind::RoleNotFound => "role resource was not found",
            UserDirectoryErrorKind::ChannelNotFound => "channel resource was not found",
            UserDirectoryErrorKind::GuildNotFound => "guild resource was not found",
            UserDirectoryErrorKind::Forbidden => "access is denied by authorization policy",
            UserDirectoryErrorKind::DependencyUnavailable => {
                "authorization dependency is unavailable"
            }
        }
    }
}

#[derive(Debug, Serialize)]
struct UserDirectoryErrorBody {
    code: &'static str,
    message: String,
    request_id: String,
}

/// user directory APIエラーをHTTPレスポンスへ変換する。
/// @param error 変換対象エラー
/// @param request_id リクエスト識別子
/// @returns RESTエラーレスポンス
/// @throws なし
pub fn user_directory_error_response(error: &UserDirectoryError, request_id: String) -> Response {
    tracing::warn!(
        request_id = %request_id,
        error_kind = ?error.kind,
        reason = %error.reason,
        "user directory API request rejected"
    );

    let body = UserDirectoryErrorBody {
        code: error.app_code(),
        message: error.public_message().to_owned(),
        request_id,
    };

    (error.status_code(), Json(body)).into_response()
}
