/// プロフィールテーマを表現する。
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProfileTheme {
    Dark,
    Light,
}

impl ProfileTheme {
    /// 文字列をプロフィールテーマへ変換する。
    /// @param value 変換対象の文字列
    /// @returns 変換済みテーマ
    /// @throws ProfileError 不正値時
    fn parse(value: &str) -> Result<Self, ProfileError> {
        match value {
            "dark" => Ok(Self::Dark),
            "light" => Ok(Self::Light),
            _ => Err(ProfileError::validation("theme_invalid_value")),
        }
    }

    /// DB格納用の固定文字列を返す。
    /// @param なし
    /// @returns DB格納文字列
    /// @throws なし
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Dark => "dark",
            Self::Light => "light",
        }
    }
}

/// プロフィール値を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProfileSettings {
    pub display_name: String,
    pub status_text: Option<String>,
    pub avatar_key: Option<String>,
    pub banner_key: Option<String>,
    pub theme: ProfileTheme,
}

/// プロフィール更新入力を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProfilePatchInput {
    pub display_name: Option<String>,
    pub status_text: Option<Option<String>>,
    pub avatar_key: Option<Option<String>>,
    pub banner_key: Option<Option<String>>,
    pub theme: Option<String>,
}

impl ProfilePatchInput {
    /// 更新対象が空かを判定する。
    /// @param なし
    /// @returns 1項目も指定されていない場合はtrue
    /// @throws なし
    pub fn is_empty(&self) -> bool {
        self.display_name.is_none()
            && self.status_text.is_none()
            && self.avatar_key.is_none()
            && self.banner_key.is_none()
            && self.theme.is_none()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct NormalizedProfilePatch {
    display_name: Option<String>,
    status_text: Option<Option<String>>,
    avatar_key: Option<Option<String>>,
    banner_key: Option<Option<String>>,
    theme: Option<ProfileTheme>,
}

/// プロフィールAPIユースケース境界を表現する。
#[async_trait]
pub trait ProfileService: Send + Sync {
    /// 認証済みprincipalのプロフィールを取得する。
    /// @param principal_id 認証済みprincipal_id
    /// @returns プロフィール
    /// @throws ProfileError 入力不正または依存障害時
    async fn get_profile(&self, principal_id: PrincipalId)
        -> Result<ProfileSettings, ProfileError>;

    /// 認証済みprincipalのプロフィールを更新する。
    /// @param principal_id 認証済みprincipal_id
    /// @param patch 更新入力
    /// @returns 更新後プロフィール
    /// @throws ProfileError 入力不正または依存障害時
    async fn update_profile(
        &self,
        principal_id: PrincipalId,
        patch: ProfilePatchInput,
    ) -> Result<ProfileSettings, ProfileError>;
}

/// 依存未構成時にfail-closeさせるサービスを表現する。
#[derive(Clone)]
pub struct UnavailableProfileService {
    reason: String,
}

impl UnavailableProfileService {
    /// 依存未構成サービスを生成する。
    /// @param reason 障害理由
    /// @returns 依存未構成サービス
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }

    /// 依存未構成エラーを返す。
    /// @param なし
    /// @returns 依存障害エラー
    /// @throws なし
    fn unavailable_error(&self) -> ProfileError {
        ProfileError::dependency_unavailable(self.reason.clone())
    }
}

#[async_trait]
impl ProfileService for UnavailableProfileService {
    /// プロフィールを取得する。
    /// @param _principal_id 認証済みprincipal_id
    /// @returns なし
    /// @throws ProfileError 常に依存障害
    async fn get_profile(
        &self,
        _principal_id: PrincipalId,
    ) -> Result<ProfileSettings, ProfileError> {
        Err(self.unavailable_error())
    }

    /// プロフィールを更新する。
    /// @param _principal_id 認証済みprincipal_id
    /// @param _patch 更新入力
    /// @returns なし
    /// @throws ProfileError 常に依存障害
    async fn update_profile(
        &self,
        _principal_id: PrincipalId,
        _patch: ProfilePatchInput,
    ) -> Result<ProfileSettings, ProfileError> {
        Err(self.unavailable_error())
    }
}

const DISPLAY_NAME_MAX_CHARS: usize = 32;
const STATUS_TEXT_MAX_CHARS: usize = 190;
const OBJECT_KEY_MAX_CHARS: usize = 512;
const PROFILE_MEDIA_OBJECT_KEY_SEGMENT_COUNT: usize = 10;

/// 更新入力を正規化して検証する。
/// @param patch 更新入力
/// @returns 正規化済み更新入力
/// @throws ProfileError 入力不正時
fn normalize_profile_patch_input(
    patch: ProfilePatchInput,
) -> Result<NormalizedProfilePatch, ProfileError> {
    if patch.is_empty() {
        return Err(ProfileError::validation("profile_patch_empty"));
    }

    let display_name = match patch.display_name {
        Some(raw_display_name) => {
            let normalized = normalize_display_name(&raw_display_name)?;
            Some(normalized)
        }
        None => None,
    };

    let status_text = match patch.status_text {
        Some(raw_status_text) => {
            let normalized = normalize_optional_status_text(raw_status_text)?;
            Some(normalized)
        }
        None => None,
    };

    let avatar_key = match patch.avatar_key {
        Some(raw_avatar_key) => {
            let normalized = normalize_optional_object_key(raw_avatar_key, "avatar_key")?;
            Some(normalized)
        }
        None => None,
    };

    let banner_key = match patch.banner_key {
        Some(raw_banner_key) => {
            let normalized = normalize_optional_object_key(raw_banner_key, "banner_key")?;
            Some(normalized)
        }
        None => None,
    };

    let theme = match patch.theme {
        Some(raw_theme) => {
            let normalized = normalize_theme(&raw_theme)?;
            Some(normalized)
        }
        None => None,
    };

    Ok(NormalizedProfilePatch {
        display_name,
        status_text,
        avatar_key,
        banner_key,
        theme,
    })
}

/// profile media key を principal/target に対して検証する。
/// @param principal_id 認証済みprincipal_id
/// @param patch 正規化済み更新入力
/// @returns 検証結果
/// @throws ProfileError object key が契約外の場合
fn validate_profile_media_patch_keys(
    principal_id: PrincipalId,
    patch: &NormalizedProfilePatch,
) -> Result<(), ProfileError> {
    validate_profile_media_object_key_option(
        patch.avatar_key.as_ref(),
        principal_id,
        ProfileMediaTarget::Avatar,
        "avatar_key",
    )?;
    validate_profile_media_object_key_option(
        patch.banner_key.as_ref(),
        principal_id,
        ProfileMediaTarget::Banner,
        "banner_key",
    )?;

    Ok(())
}

/// 表示名を正規化して検証する。
/// @param raw_display_name 生の表示名
/// @returns 正規化済み表示名
/// @throws ProfileError 入力不正時
fn normalize_display_name(raw_display_name: &str) -> Result<String, ProfileError> {
    let normalized = raw_display_name.trim();
    if normalized.is_empty() {
        return Err(ProfileError::validation("display_name_required"));
    }

    if normalized.chars().count() > DISPLAY_NAME_MAX_CHARS {
        return Err(ProfileError::validation("display_name_too_long"));
    }

    Ok(normalized.to_owned())
}

/// 任意ステータス文を正規化して検証する。
/// @param raw_status_text 生のステータス文
/// @returns 正規化済みステータス文
/// @throws ProfileError 入力不正時
fn normalize_optional_status_text(
    raw_status_text: Option<String>,
) -> Result<Option<String>, ProfileError> {
    match raw_status_text {
        Some(value) => {
            let normalized = value.trim();
            if normalized.is_empty() {
                return Ok(None);
            }

            if normalized.chars().count() > STATUS_TEXT_MAX_CHARS {
                return Err(ProfileError::validation("status_text_too_long"));
            }

            Ok(Some(normalized.to_owned()))
        }
        None => Ok(None),
    }
}

/// 任意 object key を正規化して検証する。
/// @param raw_object_key 生の object key
/// @param field_name 対象フィールド名
/// @returns 正規化済み object key
/// @throws ProfileError 入力不正時
fn normalize_optional_object_key(
    raw_object_key: Option<String>,
    field_name: &str,
) -> Result<Option<String>, ProfileError> {
    match raw_object_key {
        Some(value) => {
            let normalized = value.trim();
            if normalized.is_empty() {
                return Ok(None);
            }

            if normalized.chars().count() > OBJECT_KEY_MAX_CHARS {
                return Err(ProfileError::validation(format!("{field_name}_too_long")));
            }

            if !is_valid_object_key(normalized) {
                return Err(ProfileError::validation(format!(
                    "{field_name}_invalid_format"
                )));
            }

            Ok(Some(normalized.to_owned()))
        }
        None => Ok(None),
    }
}

/// object key 形式を検証する。
/// @param value 検証対象 object key
/// @returns 許可形式ならtrue
/// @throws なし
fn is_valid_object_key(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'_' | b'-' | b'.'))
}

/// profile media key option を検証する。
/// @param value 正規化済み key option
/// @param principal_id 認証済みprincipal_id
/// @param target 画像種別
/// @param field_name 対象フィールド名
/// @returns 検証結果
/// @throws ProfileError 契約外 key の場合
fn validate_profile_media_object_key_option(
    value: Option<&Option<String>>,
    principal_id: PrincipalId,
    target: ProfileMediaTarget,
    field_name: &str,
) -> Result<(), ProfileError> {
    let Some(Some(object_key)) = value else {
        return Ok(());
    };

    validate_profile_media_object_key(object_key, principal_id, target, field_name)
}

/// profile media key を principal/target に対して検証する。
/// @param object_key 検証対象 key
/// @param principal_id 認証済みprincipal_id
/// @param target 画像種別
/// @param field_name 対象フィールド名
/// @returns 検証結果
/// @throws ProfileError 契約外 key の場合
pub(crate) fn validate_profile_media_object_key(
    object_key: &str,
    principal_id: PrincipalId,
    target: ProfileMediaTarget,
    field_name: &str,
) -> Result<(), ProfileError> {
    let expected_principal = principal_id.0.to_string();
    let segments = object_key.split('/').collect::<Vec<_>>();
    if segments.len() != PROFILE_MEDIA_OBJECT_KEY_SEGMENT_COUNT {
        return Err(ProfileError::validation(format!(
            "{field_name}_invalid_profile_media_key"
        )));
    }

    let is_valid = segments[0] == "v0"
        && segments[1] == "tenant"
        && segments[2] == PROFILE_MEDIA_TENANT_SEGMENT
        && segments[3] == "user"
        && segments[4] == expected_principal
        && segments[5] == "profile"
        && segments[6] == target.as_key_segment()
        && segments[7] == "asset"
        && uuid::Uuid::parse_str(segments[8])
            .ok()
            .and_then(|parsed| parsed.get_version())
            == Some(uuid::Version::Random)
        && sanitize_profile_media_filename(segments[9])
            .map(|normalized| normalized == segments[9])
            .unwrap_or(false);
    if !is_valid {
        return Err(ProfileError::validation(format!(
            "{field_name}_invalid_profile_media_key"
        )));
    }

    Ok(())
}

/// テーマを正規化して検証する。
/// @param raw_theme 生のテーマ文字列
/// @returns 正規化済みテーマ
/// @throws ProfileError 入力不正時
fn normalize_theme(raw_theme: &str) -> Result<ProfileTheme, ProfileError> {
    let normalized = raw_theme.trim();
    if normalized.is_empty() {
        return Err(ProfileError::validation("theme_required"));
    }

    ProfileTheme::parse(normalized)
}
