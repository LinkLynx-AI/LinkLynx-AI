/// 認可エラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthzErrorKind {
    Denied,
    DependencyUnavailable,
}

/// 認可処理の失敗内容を保持する。
#[derive(Debug, Clone)]
pub struct AuthzError {
    pub kind: AuthzErrorKind,
    pub reason: String,
}

impl AuthzError {
    /// 決定的拒否エラーを生成する。
    /// @param reason 拒否理由
    /// @returns 拒否エラー
    /// @throws なし
    pub fn denied(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthzErrorKind::Denied,
            reason: reason.into(),
        }
    }

    /// 依存障害エラーを生成する。
    /// @param reason 障害理由
    /// @returns 依存障害エラー
    /// @throws なし
    pub fn unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthzErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }

    /// REST応答ステータスへマッピングする。
    /// @param なし
    /// @returns HTTPステータス
    /// @throws なし
    pub fn status_code(&self) -> StatusCode {
        match self.kind {
            AuthzErrorKind::Denied => StatusCode::FORBIDDEN,
            AuthzErrorKind::DependencyUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    /// アプリケーションエラーコードへマッピングする。
    /// @param なし
    /// @returns エラーコード
    /// @throws なし
    pub fn app_code(&self) -> &'static str {
        match self.kind {
            AuthzErrorKind::Denied => "AUTHZ_DENIED",
            AuthzErrorKind::DependencyUnavailable => "AUTHZ_UNAVAILABLE",
        }
    }

    /// 外部向け固定メッセージを返す。
    /// @param なし
    /// @returns 公開メッセージ
    /// @throws なし
    pub fn public_message(&self) -> &'static str {
        match self.kind {
            AuthzErrorKind::Denied => "access is denied by authorization policy",
            AuthzErrorKind::DependencyUnavailable => "authorization dependency is unavailable",
        }
    }

    /// WSクローズコードへマッピングする。
    /// @param なし
    /// @returns WebSocketクローズコード
    /// @throws なし
    pub fn ws_close_code(&self) -> u16 {
        match self.kind {
            AuthzErrorKind::Denied => 1008,
            AuthzErrorKind::DependencyUnavailable => 1011,
        }
    }

    /// ログ向け分類名を返す。
    /// @param なし
    /// @returns ログ分類ラベル
    /// @throws なし
    pub fn log_class(&self) -> &'static str {
        match self.kind {
            AuthzErrorKind::Denied => "authz_denied",
            AuthzErrorKind::DependencyUnavailable => "authz_dependency_unavailable",
        }
    }

    /// 判定ログ向けdecision値を返す。
    /// @param なし
    /// @returns decision値
    /// @throws なし
    pub fn decision(&self) -> &'static str {
        match self.kind {
            AuthzErrorKind::Denied => "deny",
            AuthzErrorKind::DependencyUnavailable => "unavailable",
        }
    }
}

#[derive(Debug, Serialize)]
struct AuthzErrorBody {
    code: &'static str,
    message: String,
    request_id: String,
}

/// 認可エラーをHTTPレスポンスへ変換する。
/// @param error 認可エラー
/// @param request_id リクエスト追跡ID
/// @returns RESTエラーレスポンス
/// @throws なし
pub fn authz_error_response(error: &AuthzError, request_id: String) -> Response {
    let body = AuthzErrorBody {
        code: error.app_code(),
        message: error.public_message().to_owned(),
        request_id,
    };

    (error.status_code(), Json(body)).into_response()
}
