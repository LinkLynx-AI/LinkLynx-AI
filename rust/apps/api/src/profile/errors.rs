/// プロフィールAPIエラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProfileErrorKind {
    Validation,
    NotFound,
    DependencyUnavailable,
}

/// プロフィールAPI失敗情報を保持する。
#[derive(Debug, Clone)]
pub struct ProfileError {
    pub kind: ProfileErrorKind,
    pub reason: String,
}

impl ProfileError {
    /// 入力検証エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 入力検証エラー
    /// @throws なし
    pub fn validation(reason: impl Into<String>) -> Self {
        Self {
            kind: ProfileErrorKind::Validation,
            reason: reason.into(),
        }
    }

    /// ユーザー未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 未存在エラー
    /// @throws なし
    pub fn not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: ProfileErrorKind::NotFound,
            reason: reason.into(),
        }
    }

    /// 依存障害エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 依存障害エラー
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: ProfileErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }

    /// HTTPステータスへ変換する。
    /// @param なし
    /// @returns HTTPステータス
    /// @throws なし
    pub fn status_code(&self) -> StatusCode {
        match self.kind {
            ProfileErrorKind::Validation => StatusCode::BAD_REQUEST,
            ProfileErrorKind::NotFound => StatusCode::NOT_FOUND,
            ProfileErrorKind::DependencyUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    /// アプリケーションエラーコードを返す。
    /// @param なし
    /// @returns エラーコード
    /// @throws なし
    pub fn app_code(&self) -> &'static str {
        match self.kind {
            ProfileErrorKind::Validation => "VALIDATION_ERROR",
            ProfileErrorKind::NotFound => "USER_NOT_FOUND",
            ProfileErrorKind::DependencyUnavailable => "PROFILE_UNAVAILABLE",
        }
    }

    /// 外部向け固定メッセージを返す。
    /// @param なし
    /// @returns 公開メッセージ
    /// @throws なし
    pub fn public_message(&self) -> &'static str {
        match self.kind {
            ProfileErrorKind::Validation => "request payload is invalid",
            ProfileErrorKind::NotFound => "user resource was not found",
            ProfileErrorKind::DependencyUnavailable => "profile dependency is unavailable",
        }
    }
}

#[derive(Debug, Serialize)]
struct ProfileErrorBody {
    code: &'static str,
    message: String,
    request_id: String,
}

/// プロフィールAPIエラーをHTTPレスポンスへ変換する。
/// @param error 変換対象エラー
/// @param request_id リクエスト識別子
/// @returns RESTエラーレスポンス
/// @throws なし
pub fn profile_error_response(error: &ProfileError, request_id: String) -> Response {
    tracing::warn!(
        request_id = %request_id,
        error_kind = ?error.kind,
        reason = %error.reason,
        "profile API request rejected"
    );

    let body = ProfileErrorBody {
        code: error.app_code(),
        message: error.public_message().to_owned(),
        request_id,
    };

    (error.status_code(), Json(body)).into_response()
}
