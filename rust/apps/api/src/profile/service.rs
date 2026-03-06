/// プロフィール値を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProfileSettings {
    pub display_name: String,
    pub status_text: Option<String>,
    pub avatar_key: Option<String>,
}

/// プロフィール更新入力を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProfilePatchInput {
    pub display_name: Option<String>,
    pub status_text: Option<Option<String>>,
    pub avatar_key: Option<Option<String>>,
}

impl ProfilePatchInput {
    /// 更新対象が空かを判定する。
    /// @param なし
    /// @returns 1項目も指定されていない場合はtrue
    /// @throws なし
    pub fn is_empty(&self) -> bool {
        self.display_name.is_none() && self.status_text.is_none() && self.avatar_key.is_none()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct NormalizedProfilePatch {
    display_name: Option<String>,
    status_text: Option<Option<String>>,
    avatar_key: Option<Option<String>>,
}

/// プロフィールAPIユースケース境界を表現する。
#[async_trait]
pub trait ProfileService: Send + Sync {
    /// 認証済みprincipalのプロフィールを取得する。
    /// @param principal_id 認証済みprincipal_id
    /// @returns プロフィール
    /// @throws ProfileError 入力不正または依存障害時
    async fn get_profile(&self, principal_id: PrincipalId) -> Result<ProfileSettings, ProfileError>;

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
const AVATAR_KEY_MAX_CHARS: usize = 512;

/// 更新入力を正規化して検証する。
/// @param patch 更新入力
/// @returns 正規化済み更新入力
/// @throws ProfileError 入力不正時
fn normalize_profile_patch_input(patch: ProfilePatchInput) -> Result<NormalizedProfilePatch, ProfileError> {
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
            let normalized = normalize_optional_avatar_key(raw_avatar_key)?;
            Some(normalized)
        }
        None => None,
    };

    Ok(NormalizedProfilePatch {
        display_name,
        status_text,
        avatar_key,
    })
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

/// 任意アバターキーを正規化して検証する。
/// @param raw_avatar_key 生のアバターキー
/// @returns 正規化済みアバターキー
/// @throws ProfileError 入力不正時
fn normalize_optional_avatar_key(
    raw_avatar_key: Option<String>,
) -> Result<Option<String>, ProfileError> {
    match raw_avatar_key {
        Some(value) => {
            let normalized = value.trim();
            if normalized.is_empty() {
                return Ok(None);
            }

            if normalized.chars().count() > AVATAR_KEY_MAX_CHARS {
                return Err(ProfileError::validation("avatar_key_too_long"));
            }

            if !is_valid_avatar_key(normalized) {
                return Err(ProfileError::validation("avatar_key_invalid_format"));
            }

            Ok(Some(normalized.to_owned()))
        }
        None => Ok(None),
    }
}

/// アバターキー形式を検証する。
/// @param value 検証対象アバターキー
/// @returns 許可形式ならtrue
/// @throws なし
fn is_valid_avatar_key(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'_' | b'-' | b'.'))
}
