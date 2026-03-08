const PROFILE_MEDIA_BUCKET_ENV: &str = "PROFILE_GCS_BUCKET";
const PROFILE_MEDIA_TENANT_SEGMENT: &str = "default";
const PROFILE_MEDIA_SIGNED_URL_TTL_SECONDS: i64 = 300;
const PROFILE_MEDIA_MAX_FILENAME_CHARS: usize = 255;
const PROFILE_MEDIA_MAX_CONTENT_TYPE_CHARS: usize = 255;
const GCS_SIGNED_URL_HOST: &str = "storage.googleapis.com";
const GCP_METADATA_EMAIL_URL: &str =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email";
const GCP_METADATA_TOKEN_URL: &str =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const GCP_METADATA_FLAVOR_HEADER: &str = "Metadata-Flavor";
const GCP_METADATA_FLAVOR_VALUE: &str = "Google";
const GCP_IAM_SIGN_BLOB_URL_PREFIX: &str =
    "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProfileMediaTarget {
    Avatar,
    Banner,
}

impl ProfileMediaTarget {
    /// API表現から変換する。
    /// @param value API文字列表現
    /// @returns 変換済みターゲット
    /// @throws ProfileError 対象が不正な場合
    pub fn parse(value: &str) -> Result<Self, ProfileError> {
        match value {
            "avatar" => Ok(Self::Avatar),
            "banner" => Ok(Self::Banner),
            _ => Err(ProfileError::validation("profile_media_target_invalid")),
        }
    }

    /// object key segment を返す。
    /// @param なし
    /// @returns key segment
    /// @throws なし
    pub fn as_key_segment(&self) -> &'static str {
        match self {
            Self::Avatar => "avatar",
            Self::Banner => "banner",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProfileMediaUploadInput {
    pub target: ProfileMediaTarget,
    pub filename: String,
    pub content_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProfileMediaUpload {
    pub target: ProfileMediaTarget,
    pub object_key: String,
    pub upload_url: String,
    pub expires_at: String,
    pub method: String,
    pub required_headers: std::collections::BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProfileMediaDownload {
    pub target: ProfileMediaTarget,
    pub object_key: String,
    pub download_url: String,
    pub expires_at: String,
}

#[async_trait]
pub trait ProfileMediaService: Send + Sync {
    /// 認証済みprincipal向けのアップロードURLを発行する。
    /// @param principal_id 認証済みprincipal_id
    /// @param input 発行入力
    /// @returns アップロード契約
    /// @throws ProfileError 入力不正または依存障害時
    async fn issue_upload_url(
        &self,
        principal_id: PrincipalId,
        input: ProfileMediaUploadInput,
    ) -> Result<ProfileMediaUpload, ProfileError>;

    /// 認証済みprincipal向けのダウンロードURLを発行する。
    /// @param principal_id 認証済みprincipal_id
    /// @param target 画像種別
    /// @returns ダウンロード契約
    /// @throws ProfileError 入力不正または依存障害時
    async fn issue_download_url(
        &self,
        principal_id: PrincipalId,
        target: ProfileMediaTarget,
    ) -> Result<ProfileMediaDownload, ProfileError>;
}

#[derive(Clone)]
pub struct UnavailableProfileMediaService {
    reason: String,
}

impl UnavailableProfileMediaService {
    /// fail-close 用の未構成サービスを生成する。
    /// @param reason 障害理由
    /// @returns 未構成サービス
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }

    /// 依存障害を返す。
    /// @param なし
    /// @returns 画像依存障害
    /// @throws なし
    fn unavailable_error(&self) -> ProfileError {
        ProfileError::media_dependency_unavailable(self.reason.clone())
    }
}

#[async_trait]
impl ProfileMediaService for UnavailableProfileMediaService {
    async fn issue_upload_url(
        &self,
        _principal_id: PrincipalId,
        _input: ProfileMediaUploadInput,
    ) -> Result<ProfileMediaUpload, ProfileError> {
        Err(self.unavailable_error())
    }

    async fn issue_download_url(
        &self,
        _principal_id: PrincipalId,
        _target: ProfileMediaTarget,
    ) -> Result<ProfileMediaDownload, ProfileError> {
        Err(self.unavailable_error())
    }
}

#[derive(Clone)]
pub struct GcsProfileMediaService {
    profile_service: Arc<dyn ProfileService>,
    signer: GcsSignedUrlSigner,
}

impl GcsProfileMediaService {
    /// GCS profile media サービスを生成する。
    /// @param profile_service 既存プロフィール取得サービス
    /// @param signer GCS signed URL signer
    /// @returns profile media サービス
    /// @throws なし
    pub fn new(profile_service: Arc<dyn ProfileService>, signer: GcsSignedUrlSigner) -> Self {
        Self {
            profile_service,
            signer,
        }
    }
}

#[async_trait]
impl ProfileMediaService for GcsProfileMediaService {
    async fn issue_upload_url(
        &self,
        principal_id: PrincipalId,
        input: ProfileMediaUploadInput,
    ) -> Result<ProfileMediaUpload, ProfileError> {
        self.signer.issue_upload_url(principal_id, input).await
    }

    async fn issue_download_url(
        &self,
        principal_id: PrincipalId,
        target: ProfileMediaTarget,
    ) -> Result<ProfileMediaDownload, ProfileError> {
        let profile = self.profile_service.get_profile(principal_id).await?;
        let object_key = match target {
            ProfileMediaTarget::Avatar => profile.avatar_key,
            ProfileMediaTarget::Banner => profile.banner_key,
        }
        .ok_or_else(|| ProfileError::media_not_found("profile_media_key_missing"))?;
        validate_profile_media_object_key(
            &object_key,
            principal_id,
            target,
            "profile_media_key",
        )?;

        self.signer.issue_download_url(target, object_key).await
    }
}

#[derive(Clone)]
pub struct GcsSignedUrlSigner {
    bucket: String,
    credential: GcsSignerCredential,
}

#[derive(Clone)]
enum GcsSignerCredential {
    LocalKey {
        client_email: String,
        encoding_key: jsonwebtoken::EncodingKey,
    },
    AttachedServiceAccount {
        http_client: reqwest::Client,
    },
}

#[derive(Debug, Deserialize)]
struct ServiceAccountCredentialFile {
    client_email: String,
    private_key: String,
}

impl GcsSignedUrlSigner {
    /// ファイルから signer を構築する。
    /// @param bucket bucket 名
    /// @param credential_path service account json path
    /// @returns signer
    /// @throws ProfileError 資格情報読込失敗時
    pub fn from_service_account_path(
        bucket: String,
        credential_path: &str,
    ) -> Result<Self, ProfileError> {
        let raw = std::fs::read_to_string(credential_path).map_err(|error| {
            ProfileError::media_dependency_unavailable(format!(
                "profile_media_credentials_read_failed:{error}"
            ))
        })?;
        let credential: ServiceAccountCredentialFile = serde_json::from_str(&raw).map_err(|error| {
            ProfileError::media_dependency_unavailable(format!(
                "profile_media_credentials_parse_failed:{error}"
            ))
        })?;
        let encoding_key = jsonwebtoken::EncodingKey::from_rsa_pem(
            credential.private_key.as_bytes(),
        )
        .map_err(|error| {
            ProfileError::media_dependency_unavailable(format!(
                "profile_media_credentials_key_invalid:{error}"
            ))
        })?;

        Ok(Self {
            bucket,
            credential: GcsSignerCredential::LocalKey {
                client_email: credential.client_email,
                encoding_key,
            },
        })
    }

    /// 実行環境に紐づく service account を使う signer を構築する。
    /// @param bucket bucket 名
    /// @returns signer
    /// @throws なし
    pub fn from_attached_service_account(bucket: String) -> Self {
        Self {
            bucket,
            credential: GcsSignerCredential::AttachedServiceAccount {
                http_client: reqwest::Client::new(),
            },
        }
    }

    /// アップロードURLを発行する。
    /// @param principal_id 認証済みprincipal_id
    /// @param input 発行入力
    /// @returns アップロード契約
    /// @throws ProfileError 入力不正または署名失敗時
    pub async fn issue_upload_url(
        &self,
        principal_id: PrincipalId,
        input: ProfileMediaUploadInput,
    ) -> Result<ProfileMediaUpload, ProfileError> {
        let normalized_filename = sanitize_profile_media_filename(&input.filename)?;
        let normalized_content_type = normalize_profile_media_content_type(&input.content_type)?;
        let asset_id = uuid::Uuid::new_v4().to_string();
        let object_key = format!(
            "v0/tenant/{}/user/{}/profile/{}/asset/{}/{}",
            PROFILE_MEDIA_TENANT_SEGMENT,
            principal_id.0,
            input.target.as_key_segment(),
            asset_id,
            normalized_filename,
        );
        let signed = self
            .signed_url(
            "PUT",
            &object_key,
            Some(("content-type", normalized_content_type.as_str())),
            )
            .await?;

        let mut required_headers = std::collections::BTreeMap::new();
        required_headers.insert("content-type".to_owned(), normalized_content_type);

        Ok(ProfileMediaUpload {
            target: input.target,
            object_key,
            upload_url: signed.url,
            expires_at: signed.expires_at,
            method: "PUT".to_owned(),
            required_headers,
        })
    }

    /// ダウンロードURLを発行する。
    /// @param target 画像種別
    /// @param object_key 対象 object key
    /// @returns ダウンロード契約
    /// @throws ProfileError 署名失敗時
    pub async fn issue_download_url(
        &self,
        target: ProfileMediaTarget,
        object_key: String,
    ) -> Result<ProfileMediaDownload, ProfileError> {
        let signed = self.signed_url("GET", &object_key, None).await?;
        Ok(ProfileMediaDownload {
            target,
            object_key,
            download_url: signed.url,
            expires_at: signed.expires_at,
        })
    }

    /// GCS V4 signed URL を生成する。
    /// @param method HTTP method
    /// @param object_key 対象 object key
    /// @param content_type 署名対象 content-type
    /// @returns 署名済みURL
    /// @throws ProfileError 署名失敗時
    async fn signed_url(
        &self,
        method: &str,
        object_key: &str,
        content_type: Option<(&str, &str)>,
    ) -> Result<SignedUrlArtifact, ProfileError> {
        let now = time::OffsetDateTime::now_utc();
        let datestamp = format!(
            "{:04}{:02}{:02}",
            now.year(),
            u8::from(now.month()),
            now.day()
        );
        let timestamp = format!(
            "{datestamp}T{:02}{:02}{:02}Z",
            now.hour(),
            now.minute(),
            now.second()
        );
        let expires_at = (now + time::Duration::seconds(PROFILE_MEDIA_SIGNED_URL_TTL_SECONDS))
            .format(&time::format_description::well_known::Rfc3339)
            .map_err(|error| {
                ProfileError::media_dependency_unavailable(format!(
                    "profile_media_expires_at_format_failed:{error}"
                ))
            })?;
        let scope = format!("{datestamp}/auto/storage/goog4_request");
        let client_email = self.client_email().await?;
        let credential = format!("{}/{}", client_email, scope);
        let canonical_uri = format!("/{}/{}", self.bucket, object_key);

        let mut query_params = vec![
            (
                "X-Goog-Algorithm".to_owned(),
                "GOOG4-RSA-SHA256".to_owned(),
            ),
            ("X-Goog-Credential".to_owned(), credential),
            ("X-Goog-Date".to_owned(), timestamp.clone()),
            (
                "X-Goog-Expires".to_owned(),
                PROFILE_MEDIA_SIGNED_URL_TTL_SECONDS.to_string(),
            ),
        ];

        let mut canonical_headers = vec![("host".to_owned(), GCS_SIGNED_URL_HOST.to_owned())];
        if let Some((header_name, header_value)) = content_type {
            canonical_headers.push((header_name.to_owned(), header_value.to_owned()));
        }
        canonical_headers.sort_by(|left, right| left.0.cmp(&right.0));
        let signed_headers = canonical_headers
            .iter()
            .map(|(name, _)| name.as_str())
            .collect::<Vec<_>>()
            .join(";");
        query_params.push((
            "X-Goog-SignedHeaders".to_owned(),
            signed_headers.clone(),
        ));
        query_params.sort_by(|left, right| left.0.cmp(&right.0));

        let canonical_query_string = query_params
            .iter()
            .map(|(key, value)| format!("{}={}", uri_encode(key), uri_encode(value)))
            .collect::<Vec<_>>()
            .join("&");
        let canonical_headers_string = canonical_headers
            .iter()
            .map(|(name, value)| format!("{name}:{value}\n"))
            .collect::<String>();
        let canonical_request = format!(
            "{method}\n{canonical_uri}\n{canonical_query_string}\n{canonical_headers_string}\n{signed_headers}\nUNSIGNED-PAYLOAD"
        );
        let canonical_request_hash = sha256_hex(canonical_request.as_bytes());
        let string_to_sign = format!(
            "GOOG4-RSA-SHA256\n{timestamp}\n{scope}\n{canonical_request_hash}"
        );
        let signature_bytes = self.sign_bytes(string_to_sign.as_bytes()).await?;
        let signature_hex = hex_encode(&signature_bytes);
        let final_query = format!("{canonical_query_string}&X-Goog-Signature={signature_hex}");
        let url = format!("https://{GCS_SIGNED_URL_HOST}{canonical_uri}?{final_query}");

        Ok(SignedUrlArtifact { url, expires_at })
    }

    /// 現在の signer 用 client email を返す。
    /// @param なし
    /// @returns client email
    /// @throws ProfileError 取得失敗時
    async fn client_email(&self) -> Result<String, ProfileError> {
        match &self.credential {
            GcsSignerCredential::LocalKey { client_email, .. } => Ok(client_email.clone()),
            GcsSignerCredential::AttachedServiceAccount { http_client } => {
                metadata_service_account_email(http_client).await
            }
        }
    }

    /// bytes に署名する。
    /// @param payload 署名対象 bytes
    /// @returns signature bytes
    /// @throws ProfileError 署名失敗時
    async fn sign_bytes(&self, payload: &[u8]) -> Result<Vec<u8>, ProfileError> {
        match &self.credential {
            GcsSignerCredential::LocalKey { encoding_key, .. } => {
                let encoded_signature = jsonwebtoken::crypto::sign(
                    payload,
                    encoding_key,
                    jsonwebtoken::Algorithm::RS256,
                )
                .map_err(|error| {
                    ProfileError::media_dependency_unavailable(format!(
                        "profile_media_signature_failed:{error}"
                    ))
                })?;
                base64::engine::general_purpose::URL_SAFE_NO_PAD
                    .decode(encoded_signature)
                    .map_err(|error| {
                        ProfileError::media_dependency_unavailable(format!(
                            "profile_media_signature_decode_failed:{error}"
                        ))
                    })
            }
            GcsSignerCredential::AttachedServiceAccount { http_client } => {
                iam_sign_blob(http_client, payload).await
            }
        }
    }
}

struct SignedUrlArtifact {
    url: String,
    expires_at: String,
}

/// profile media filename を正規化する。
/// @param raw_filename 生 filename
/// @returns 正規化済み filename
/// @throws ProfileError filename 不正時
fn sanitize_profile_media_filename(raw_filename: &str) -> Result<String, ProfileError> {
    let trimmed = raw_filename.trim();
    if trimmed.is_empty() {
        return Err(ProfileError::validation("profile_media_filename_required"));
    }
    if trimmed.chars().count() > PROFILE_MEDIA_MAX_FILENAME_CHARS {
        return Err(ProfileError::validation("profile_media_filename_too_long"));
    }

    let mut normalized = trimmed
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    while normalized.contains("--") {
        normalized = normalized.replace("--", "-");
    }
    let normalized = normalized.trim_matches(['-', '.']).to_owned();
    if normalized.is_empty() {
        return Err(ProfileError::validation("profile_media_filename_invalid"));
    }

    Ok(normalized)
}

/// profile media content-type を検証する。
/// @param raw_content_type 生 content-type
/// @returns 正規化済み content-type
/// @throws ProfileError content-type 不正時
fn normalize_profile_media_content_type(raw_content_type: &str) -> Result<String, ProfileError> {
    let normalized = raw_content_type.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Err(ProfileError::validation("profile_media_content_type_required"));
    }
    if normalized.chars().count() > PROFILE_MEDIA_MAX_CONTENT_TYPE_CHARS {
        return Err(ProfileError::validation("profile_media_content_type_too_long"));
    }
    if !normalized.starts_with("image/") {
        return Err(ProfileError::validation("profile_media_content_type_invalid"));
    }
    if !normalized
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'/' | b'.' | b'+' | b'-'))
    {
        return Err(ProfileError::validation("profile_media_content_type_invalid"));
    }

    Ok(normalized)
}

#[derive(Deserialize)]
struct MetadataAccessTokenResponse {
    access_token: String,
}

#[derive(Serialize)]
struct IamSignBlobRequest<'a> {
    payload: &'a str,
}

#[derive(Deserialize)]
struct IamSignBlobResponse {
    #[serde(rename = "signedBlob")]
    signed_blob: String,
}

/// metadata server から service account email を取得する。
/// @param http_client HTTP client
/// @returns service account email
/// @throws ProfileError metadata 取得失敗時
async fn metadata_service_account_email(
    http_client: &reqwest::Client,
) -> Result<String, ProfileError> {
    let response = http_client
        .get(GCP_METADATA_EMAIL_URL)
        .header(GCP_METADATA_FLAVOR_HEADER, GCP_METADATA_FLAVOR_VALUE)
        .send()
        .await
        .map_err(|error| {
            ProfileError::media_dependency_unavailable(format!(
                "profile_media_metadata_email_request_failed:{error}"
            ))
        })?;
    let response = response.error_for_status().map_err(|error| {
        ProfileError::media_dependency_unavailable(format!(
            "profile_media_metadata_email_status_failed:{error}"
        ))
    })?;
    let email = response.text().await.map_err(|error| {
        ProfileError::media_dependency_unavailable(format!(
            "profile_media_metadata_email_body_failed:{error}"
        ))
    })?;
    let trimmed = email.trim();
    if trimmed.is_empty() {
        return Err(ProfileError::media_dependency_unavailable(
            "profile_media_metadata_email_missing",
        ));
    }

    Ok(trimmed.to_owned())
}

/// metadata server から access token を取得する。
/// @param http_client HTTP client
/// @returns access token
/// @throws ProfileError metadata 取得失敗時
async fn metadata_access_token(http_client: &reqwest::Client) -> Result<String, ProfileError> {
    let response = http_client
        .get(GCP_METADATA_TOKEN_URL)
        .header(GCP_METADATA_FLAVOR_HEADER, GCP_METADATA_FLAVOR_VALUE)
        .send()
        .await
        .map_err(|error| {
            ProfileError::media_dependency_unavailable(format!(
                "profile_media_metadata_token_request_failed:{error}"
            ))
        })?;
    let response = response.error_for_status().map_err(|error| {
        ProfileError::media_dependency_unavailable(format!(
            "profile_media_metadata_token_status_failed:{error}"
        ))
    })?;
    let body: MetadataAccessTokenResponse = response.json().await.map_err(|error| {
        ProfileError::media_dependency_unavailable(format!(
            "profile_media_metadata_token_parse_failed:{error}"
        ))
    })?;
    if body.access_token.trim().is_empty() {
        return Err(ProfileError::media_dependency_unavailable(
            "profile_media_metadata_token_missing",
        ));
    }

    Ok(body.access_token)
}

/// IAM Credentials API で signBlob する。
/// @param http_client HTTP client
/// @param payload 署名対象
/// @returns signature bytes
/// @throws ProfileError 署名失敗時
async fn iam_sign_blob(
    http_client: &reqwest::Client,
    payload: &[u8],
) -> Result<Vec<u8>, ProfileError> {
    let email = metadata_service_account_email(http_client).await?;
    let access_token = metadata_access_token(http_client).await?;
    let payload_base64 = base64::engine::general_purpose::STANDARD.encode(payload);
    let url = format!(
        "{}{}:signBlob",
        GCP_IAM_SIGN_BLOB_URL_PREFIX,
        uri_encode(&email)
    );
    let response = http_client
        .post(url)
        .bearer_auth(access_token)
        .json(&IamSignBlobRequest {
            payload: payload_base64.as_str(),
        })
        .send()
        .await
        .map_err(|error| {
            ProfileError::media_dependency_unavailable(format!(
                "profile_media_iam_sign_request_failed:{error}"
            ))
        })?;
    let response = response.error_for_status().map_err(|error| {
        ProfileError::media_dependency_unavailable(format!(
            "profile_media_iam_sign_status_failed:{error}"
        ))
    })?;
    let body: IamSignBlobResponse = response.json().await.map_err(|error| {
        ProfileError::media_dependency_unavailable(format!(
            "profile_media_iam_sign_parse_failed:{error}"
        ))
    })?;
    base64::engine::general_purpose::STANDARD
        .decode(body.signed_blob)
        .map_err(|error| {
            ProfileError::media_dependency_unavailable(format!(
                "profile_media_iam_sign_decode_failed:{error}"
            ))
        })
}

/// クエリ値を URI encode する。
/// @param value 生文字列
/// @returns encode 済み文字列
/// @throws なし
fn uri_encode(value: &str) -> String {
    percent_encoding::utf8_percent_encode(value, percent_encoding::NON_ALPHANUMERIC).to_string()
}

/// SHA-256 を hex 化する。
/// @param value 入力 bytes
/// @returns hex digest
/// @throws なし
fn sha256_hex(value: &[u8]) -> String {
    let digest = sha2::Sha256::digest(value);
    hex_encode(&digest)
}

/// bytes を lower-hex へ変換する。
/// @param value 入力 bytes
/// @returns lower-hex
/// @throws なし
fn hex_encode(value: &[u8]) -> String {
    value.iter().map(|byte| format!("{byte:02x}")).collect()
}
