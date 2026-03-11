/// DM APIエラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DmErrorKind {
    Validation,
    Forbidden,
    NotFound,
    DependencyUnavailable,
}

/// DM API の失敗を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DmError {
    pub kind: DmErrorKind,
    pub reason: String,
}

impl DmError {
    /// validation error を生成する。
    /// @param reason 失敗理由
    /// @returns validation error
    /// @throws なし
    pub fn validation(reason: impl Into<String>) -> Self {
        Self {
            kind: DmErrorKind::Validation,
            reason: reason.into(),
        }
    }

    /// forbidden error を生成する。
    /// @param reason 失敗理由
    /// @returns forbidden error
    /// @throws なし
    pub fn forbidden(reason: impl Into<String>) -> Self {
        Self {
            kind: DmErrorKind::Forbidden,
            reason: reason.into(),
        }
    }

    /// not found error を生成する。
    /// @param reason 失敗理由
    /// @returns not found error
    /// @throws なし
    pub fn not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: DmErrorKind::NotFound,
            reason: reason.into(),
        }
    }

    /// dependency unavailable error を生成する。
    /// @param reason 失敗理由
    /// @returns dependency unavailable error
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: DmErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }
}

#[derive(Debug, Serialize)]
struct DmErrorBody {
    code: &'static str,
    message: String,
    request_id: String,
}

/// DM API エラーを HTTP response へ変換する。
/// @param error DM エラー
/// @param request_id request 識別子
/// @returns HTTP response
/// @throws なし
pub fn dm_error_response(error: &DmError, request_id: String) -> Response {
    let (status, code, message) = match error.kind {
        DmErrorKind::Validation => (
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "request payload is invalid",
        ),
        DmErrorKind::Forbidden => (
            StatusCode::FORBIDDEN,
            "AUTHZ_DENIED",
            "access is denied by authorization policy",
        ),
        DmErrorKind::NotFound if error.reason == "recipient_not_found" => (
            StatusCode::NOT_FOUND,
            "USER_NOT_FOUND",
            "target user resource was not found",
        ),
        DmErrorKind::NotFound => (
            StatusCode::NOT_FOUND,
            "CHANNEL_NOT_FOUND",
            "channel resource was not found",
        ),
        DmErrorKind::DependencyUnavailable => (
            StatusCode::SERVICE_UNAVAILABLE,
            "AUTHZ_UNAVAILABLE",
            "authorization dependency is unavailable",
        ),
    };
    let body = DmErrorBody {
        code,
        message: message.to_owned(),
        request_id,
    };
    (status, Json(body)).into_response()
}
