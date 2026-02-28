/// 認証済み主体情報を保持する。
/// @param principal_id 業務主体ID
/// @param firebase_uid Firebase UID
/// @param expires_at_epoch JWT有効期限(UNIX秒)
/// @returns 認証済みセッション情報
/// @throws なし
#[derive(Debug, Clone)]
pub struct AuthenticatedPrincipal {
    pub principal_id: PrincipalId,
    pub firebase_uid: String,
    pub expires_at_epoch: u64,
}

/// リクエスト文脈に注入する認証情報を保持する。
/// @param request_id リクエスト追跡ID
/// @param principal_id 業務主体ID
/// @param firebase_uid Firebase UID
/// @returns RESTハンドラに注入される認証文脈
/// @throws なし
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub request_id: String,
    pub principal_id: PrincipalId,
    pub firebase_uid: String,
}

/// 認証エラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthErrorKind {
    MissingToken,
    InvalidToken,
    ExpiredToken,
    EmailNotVerified,
    PrincipalNotMapped,
    DependencyUnavailable,
}

/// 認証処理の失敗内容を保持する。
#[derive(Debug, Clone)]
pub struct AuthError {
    pub kind: AuthErrorKind,
    pub reason: String,
}

impl AuthError {
    /// トークン欠落エラーを生成する。
    /// @param なし
    /// @returns トークン欠落エラー
    /// @throws なし
    pub fn missing_token() -> Self {
        Self {
            kind: AuthErrorKind::MissingToken,
            reason: "authorization_header_missing".to_owned(),
        }
    }

    /// トークン不正エラーを生成する。
    /// @param reason 失敗理由
    /// @returns トークン不正エラー
    /// @throws なし
    pub fn invalid_token(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthErrorKind::InvalidToken,
            reason: reason.into(),
        }
    }

    /// 期限切れエラーを生成する。
    /// @param reason 失敗理由
    /// @returns 期限切れエラー
    /// @throws なし
    pub fn expired(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthErrorKind::ExpiredToken,
            reason: reason.into(),
        }
    }

    /// メール未確認エラーを生成する。
    /// @param reason 失敗理由
    /// @returns メール未確認エラー
    /// @throws なし
    pub fn email_not_verified(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthErrorKind::EmailNotVerified,
            reason: reason.into(),
        }
    }

    /// 主体未解決エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 主体未解決エラー
    /// @throws なし
    pub fn principal_not_mapped(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthErrorKind::PrincipalNotMapped,
            reason: reason.into(),
        }
    }

    /// 依存障害エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 依存障害エラー
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }

    /// REST応答ステータスへマッピングする。
    /// @param なし
    /// @returns HTTPステータス
    /// @throws なし
    pub fn status_code(&self) -> StatusCode {
        match self.kind {
            AuthErrorKind::MissingToken
            | AuthErrorKind::InvalidToken
            | AuthErrorKind::ExpiredToken => StatusCode::UNAUTHORIZED,
            AuthErrorKind::EmailNotVerified | AuthErrorKind::PrincipalNotMapped => {
                StatusCode::FORBIDDEN
            }
            AuthErrorKind::DependencyUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    /// アプリケーションエラーコードへマッピングする。
    /// @param なし
    /// @returns エラーコード文字列
    /// @throws なし
    pub fn app_code(&self) -> &'static str {
        match self.kind {
            AuthErrorKind::MissingToken => "AUTH_MISSING_TOKEN",
            AuthErrorKind::InvalidToken => "AUTH_INVALID_TOKEN",
            AuthErrorKind::ExpiredToken => "AUTH_TOKEN_EXPIRED",
            AuthErrorKind::EmailNotVerified => "AUTH_EMAIL_NOT_VERIFIED",
            AuthErrorKind::PrincipalNotMapped => "AUTH_PRINCIPAL_NOT_MAPPED",
            AuthErrorKind::DependencyUnavailable => "AUTH_UNAVAILABLE",
        }
    }

    /// 外部向けの固定メッセージを返す。
    /// @param なし
    /// @returns 公開用メッセージ
    /// @throws なし
    pub fn public_message(&self) -> &'static str {
        match self.kind {
            AuthErrorKind::MissingToken => "authentication token is required",
            AuthErrorKind::InvalidToken => "authentication token is invalid",
            AuthErrorKind::ExpiredToken => "authentication token is expired",
            AuthErrorKind::EmailNotVerified => "email verification is required",
            AuthErrorKind::PrincipalNotMapped => "principal mapping is not found",
            AuthErrorKind::DependencyUnavailable => "authentication dependency is unavailable",
        }
    }

    /// WSクローズコードへマッピングする。
    /// @param なし
    /// @returns WebSocketクローズコード
    /// @throws なし
    pub fn ws_close_code(&self) -> u16 {
        match self.kind {
            AuthErrorKind::DependencyUnavailable => 1011,
            _ => 1008,
        }
    }

    /// ログ向け分類名を返す。
    /// @param なし
    /// @returns ログ分類ラベル
    /// @throws なし
    pub fn log_class(&self) -> &'static str {
        match self.kind {
            AuthErrorKind::MissingToken => "missing_token",
            AuthErrorKind::InvalidToken => "invalid_token",
            AuthErrorKind::ExpiredToken => "expired_token",
            AuthErrorKind::EmailNotVerified => "email_not_verified",
            AuthErrorKind::PrincipalNotMapped => "principal_not_mapped",
            AuthErrorKind::DependencyUnavailable => "dependency_unavailable",
        }
    }

    /// 認証判定ログのdecision値を返す。
    /// @param なし
    /// @returns decision値
    /// @throws なし
    pub fn decision(&self) -> &'static str {
        match self.kind {
            AuthErrorKind::DependencyUnavailable => "unavailable",
            _ => "deny",
        }
    }
}

#[derive(Debug, Serialize)]
struct AuthErrorBody {
    code: &'static str,
    message: String,
    request_id: String,
}

/// 認証エラーをHTTPレスポンスへ変換する。
/// @param error 認証エラー
/// @param request_id リクエスト追跡ID
/// @returns RESTエラーレスポンス
/// @throws なし
pub fn auth_error_response(error: &AuthError, request_id: String) -> Response {
    let body = AuthErrorBody {
        code: error.app_code(),
        message: error.public_message().to_owned(),
        request_id,
    };

    (error.status_code(), Json(body)).into_response()
}

/// ヘッダーからBearerトークンを抽出する。
/// @param headers HTTPヘッダー
/// @returns Bearerトークン
/// @throws AuthError Authorizationヘッダー欠落/形式不正
pub fn bearer_token_from_headers(headers: &HeaderMap) -> Result<String, AuthError> {
    let header_value = headers
        .get(AUTHORIZATION)
        .ok_or_else(AuthError::missing_token)?
        .to_str()
        .map_err(|_| AuthError::invalid_token("authorization_header_not_utf8"))?;

    let (scheme, token) = header_value
        .split_once(' ')
        .ok_or_else(|| AuthError::invalid_token("authorization_scheme_invalid"))?;

    if !scheme.eq_ignore_ascii_case("bearer") {
        return Err(AuthError::invalid_token("authorization_scheme_invalid"));
    }

    let trimmed = token.trim();
    if trimmed.is_empty() {
        return Err(AuthError::missing_token());
    }

    Ok(trimmed.to_owned())
}

/// ヘッダー由来または新規のrequest_idを返す。
/// @param headers HTTPヘッダー
/// @returns request_id
/// @throws なし
pub fn request_id_from_headers(headers: &HeaderMap) -> String {
    headers
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| Uuid::new_v4().to_string())
}
