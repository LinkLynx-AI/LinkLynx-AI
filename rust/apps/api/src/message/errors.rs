/// message API エラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageErrorKind {
    Validation,
    ChannelNotFound,
    MessageNotFound,
    AuthzDenied,
    Conflict,
    DependencyUnavailable,
}

/// message API 失敗情報を保持する。
#[derive(Debug, Clone)]
pub struct MessageError {
    pub kind: MessageErrorKind,
    pub reason: String,
}

impl MessageError {
    /// 入力検証エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 入力検証エラー
    /// @throws なし
    pub fn validation(reason: impl Into<String>) -> Self {
        Self {
            kind: MessageErrorKind::Validation,
            reason: reason.into(),
        }
    }

    /// channel未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 未存在エラー
    /// @throws なし
    pub fn channel_not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: MessageErrorKind::ChannelNotFound,
            reason: reason.into(),
        }
    }

    /// message未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 未存在エラー
    /// @throws なし
    pub fn message_not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: MessageErrorKind::MessageNotFound,
            reason: reason.into(),
        }
    }

    /// authz denied エラーを生成する。
    /// @param reason 失敗理由
    /// @returns authz denied エラー
    /// @throws なし
    pub fn authz_denied(reason: impl Into<String>) -> Self {
        Self {
            kind: MessageErrorKind::AuthzDenied,
            reason: reason.into(),
        }
    }

    /// conflict エラーを生成する。
    /// @param reason 失敗理由
    /// @returns conflict エラー
    /// @throws なし
    pub fn conflict(reason: impl Into<String>) -> Self {
        Self {
            kind: MessageErrorKind::Conflict,
            reason: reason.into(),
        }
    }

    /// 依存障害エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 依存障害エラー
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: MessageErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }

    /// HTTPステータスへ変換する。
    /// @param なし
    /// @returns HTTPステータス
    /// @throws なし
    pub fn status_code(&self) -> StatusCode {
        match self.kind {
            MessageErrorKind::Validation => StatusCode::BAD_REQUEST,
            MessageErrorKind::ChannelNotFound => StatusCode::NOT_FOUND,
            MessageErrorKind::MessageNotFound => StatusCode::NOT_FOUND,
            MessageErrorKind::AuthzDenied => StatusCode::FORBIDDEN,
            MessageErrorKind::Conflict => StatusCode::CONFLICT,
            MessageErrorKind::DependencyUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    /// アプリケーションエラーコードを返す。
    /// @param なし
    /// @returns エラーコード
    /// @throws なし
    pub fn app_code(&self) -> &'static str {
        match self.kind {
            MessageErrorKind::Validation => "VALIDATION_ERROR",
            MessageErrorKind::ChannelNotFound => "CHANNEL_NOT_FOUND",
            MessageErrorKind::MessageNotFound => "MESSAGE_NOT_FOUND",
            MessageErrorKind::AuthzDenied => "AUTHZ_DENIED",
            MessageErrorKind::Conflict => "MESSAGE_CONFLICT",
            MessageErrorKind::DependencyUnavailable => "AUTHZ_UNAVAILABLE",
        }
    }

    /// 外部向け固定メッセージを返す。
    /// @param なし
    /// @returns 公開メッセージ
    /// @throws なし
    pub fn public_message(&self) -> &'static str {
        match self.kind {
            MessageErrorKind::Validation => "request payload is invalid",
            MessageErrorKind::ChannelNotFound => "channel resource was not found",
            MessageErrorKind::MessageNotFound => "message resource was not found",
            MessageErrorKind::AuthzDenied => "message update is not allowed",
            MessageErrorKind::Conflict => "message version conflict",
            MessageErrorKind::DependencyUnavailable => {
                "authorization dependency is unavailable"
            }
        }
    }
}

impl From<MessageApiError> for MessageError {
    fn from(value: MessageApiError) -> Self {
        Self::validation(value.reason_code())
    }
}

impl From<MessageUsecaseError> for MessageError {
    fn from(value: MessageUsecaseError) -> Self {
        match value {
            MessageUsecaseError::Validation(reason) => Self::validation(reason),
            MessageUsecaseError::ChannelNotFound(reason) => Self::channel_not_found(reason),
            MessageUsecaseError::MessageNotFound(reason) => Self::message_not_found(reason),
            MessageUsecaseError::AuthzDenied(reason) => Self::authz_denied(reason),
            MessageUsecaseError::Conflict(reason) => Self::conflict(reason),
            MessageUsecaseError::DependencyUnavailable(reason) => {
                Self::dependency_unavailable(reason)
            }
        }
    }
}

#[derive(Debug, Serialize)]
struct MessageErrorBody {
    code: &'static str,
    message: String,
    request_id: String,
}

/// message API エラーをHTTPレスポンスへ変換する。
/// @param error 変換対象エラー
/// @param request_id リクエスト識別子
/// @returns RESTエラーレスポンス
/// @throws なし
pub fn message_error_response(error: &MessageError, request_id: String) -> Response {
    tracing::warn!(
        request_id = %request_id,
        error_kind = ?error.kind,
        reason = %error.reason,
        "message API request rejected"
    );

    let body = MessageErrorBody {
        code: error.app_code(),
        message: error.public_message().to_owned(),
        request_id,
    };

    (error.status_code(), Json(body)).into_response()
}
