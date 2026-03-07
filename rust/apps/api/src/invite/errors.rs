/// 招待検証APIエラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InviteErrorKind {
    Validation,
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
            InviteErrorKind::DependencyUnavailable => "invite verification dependency is unavailable",
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
        "invite verification request rejected"
    );

    let body = InviteErrorBody {
        code: error.app_code(),
        message: error.public_message().to_owned(),
        request_id,
    };

    (error.status_code(), Json(body)).into_response()
}
