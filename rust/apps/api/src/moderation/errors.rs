/// モデレーションAPIエラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModerationErrorKind {
    Validation,
    NotFound,
    Forbidden,
    Conflict,
    DependencyUnavailable,
}

/// モデレーションAPI失敗情報を保持する。
#[derive(Debug, Clone)]
pub struct ModerationError {
    pub kind: ModerationErrorKind,
    pub reason: String,
}

impl ModerationError {
    /// 入力検証エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 入力検証エラー
    /// @throws なし
    pub fn validation(reason: impl Into<String>) -> Self {
        Self {
            kind: ModerationErrorKind::Validation,
            reason: reason.into(),
        }
    }

    /// リソース未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 未存在エラー
    /// @throws なし
    pub fn not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: ModerationErrorKind::NotFound,
            reason: reason.into(),
        }
    }

    /// 権限拒否エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 権限拒否エラー
    /// @throws なし
    pub fn forbidden(reason: impl Into<String>) -> Self {
        Self {
            kind: ModerationErrorKind::Forbidden,
            reason: reason.into(),
        }
    }

    /// 競合エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 競合エラー
    /// @throws なし
    pub fn conflict(reason: impl Into<String>) -> Self {
        Self {
            kind: ModerationErrorKind::Conflict,
            reason: reason.into(),
        }
    }

    /// 依存障害エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 依存障害エラー
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: ModerationErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }

    /// HTTPステータスへ変換する。
    /// @param なし
    /// @returns HTTPステータス
    /// @throws なし
    pub fn status_code(&self) -> StatusCode {
        match self.kind {
            ModerationErrorKind::Validation => StatusCode::BAD_REQUEST,
            ModerationErrorKind::NotFound => StatusCode::NOT_FOUND,
            ModerationErrorKind::Forbidden => StatusCode::FORBIDDEN,
            ModerationErrorKind::Conflict => StatusCode::CONFLICT,
            ModerationErrorKind::DependencyUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    /// アプリケーションエラーコードを返す。
    /// @param なし
    /// @returns エラーコード
    /// @throws なし
    pub fn app_code(&self) -> &'static str {
        match self.kind {
            ModerationErrorKind::Validation => "VALIDATION_ERROR",
            ModerationErrorKind::NotFound => "MODERATION_NOT_FOUND",
            ModerationErrorKind::Forbidden => "AUTHZ_DENIED",
            ModerationErrorKind::Conflict => "MODERATION_CONFLICT",
            ModerationErrorKind::DependencyUnavailable => "AUTHZ_UNAVAILABLE",
        }
    }

    /// 外部向け固定メッセージを返す。
    /// @param なし
    /// @returns 公開メッセージ
    /// @throws なし
    pub fn public_message(&self) -> &'static str {
        match self.kind {
            ModerationErrorKind::Validation => "request payload is invalid",
            ModerationErrorKind::NotFound => "moderation resource was not found",
            ModerationErrorKind::Forbidden => "access is denied by authorization policy",
            ModerationErrorKind::Conflict => "moderation request conflicts with current state",
            ModerationErrorKind::DependencyUnavailable => {
                "authorization dependency is unavailable"
            }
        }
    }
}

#[derive(Debug, Serialize)]
struct ModerationErrorBody {
    code: &'static str,
    message: String,
    request_id: String,
}

/// モデレーションAPIエラーをHTTPレスポンスへ変換する。
/// @param error 変換対象エラー
/// @param request_id リクエスト識別子
/// @returns RESTエラーレスポンス
/// @throws なし
pub fn moderation_error_response(error: &ModerationError, request_id: String) -> Response {
    tracing::warn!(
        request_id = %request_id,
        error_kind = ?error.kind,
        reason = %error.reason,
        "moderation API request rejected"
    );

    let body = ModerationErrorBody {
        code: error.app_code(),
        message: error.public_message().to_owned(),
        request_id,
    };

    (error.status_code(), Json(body)).into_response()
}
