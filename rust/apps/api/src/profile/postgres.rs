/// Postgres-backed プロフィールサービスを表現する。
#[derive(Clone)]
pub struct PostgresProfileService {
    database_url: Arc<str>,
    allow_postgres_notls: bool,
    clients: Arc<RwLock<Vec<Arc<tokio_postgres::Client>>>>,
    next_index: Arc<AtomicU64>,
    pool_size: usize,
}

impl PostgresProfileService {
    const DEFAULT_POOL_SIZE: usize = 4;
    const MAX_POOL_SIZE: usize = 100;

    /// Postgresサービスを生成する。
    /// @param database_url 接続文字列
    /// @param allow_postgres_notls 平文接続許可フラグ
    /// @returns Postgresサービス
    /// @throws なし
    pub fn new(database_url: String, allow_postgres_notls: bool) -> Self {
        let pool_size = Self::parse_pool_size_from_env();

        Self {
            database_url: Arc::from(database_url),
            allow_postgres_notls,
            clients: Arc::new(RwLock::new(Vec::new())),
            next_index: Arc::new(AtomicU64::new(0)),
            pool_size,
        }
    }

    /// 接続プールサイズを環境変数から解釈する。
    /// @param なし
    /// @returns プールサイズ
    /// @throws なし
    fn parse_pool_size_from_env() -> usize {
        match env::var("PROFILE_STORE_POOL_SIZE") {
            Ok(value) => match value.parse::<usize>() {
                Ok(0) => {
                    warn!(
                        env_var = "PROFILE_STORE_POOL_SIZE",
                        value = %value,
                        default = Self::DEFAULT_POOL_SIZE,
                        "pool size must be >= 1; fallback to default"
                    );
                    Self::DEFAULT_POOL_SIZE
                }
                Ok(parsed) if parsed > Self::MAX_POOL_SIZE => {
                    warn!(
                        env_var = "PROFILE_STORE_POOL_SIZE",
                        value = %value,
                        max = Self::MAX_POOL_SIZE,
                        "pool size exceeds upper bound; clamped"
                    );
                    Self::MAX_POOL_SIZE
                }
                Ok(parsed) => parsed,
                Err(error) => {
                    warn!(
                        env_var = "PROFILE_STORE_POOL_SIZE",
                        value = %value,
                        reason = %error,
                        default = Self::DEFAULT_POOL_SIZE,
                        "invalid pool size env value; fallback to default"
                    );
                    Self::DEFAULT_POOL_SIZE
                }
            },
            Err(_) => Self::DEFAULT_POOL_SIZE,
        }
    }

    /// Postgresクライアントを接続する。
    /// @param なし
    /// @returns Postgresクライアント
    /// @throws ProfileError 接続失敗時
    async fn connect_client(&self) -> Result<Arc<tokio_postgres::Client>, ProfileError> {
        if !self.allow_postgres_notls {
            return Err(ProfileError::dependency_unavailable(
                "postgres_tls_required",
            ));
        }

        let (client, connection) = tokio_postgres::connect(self.database_url.as_ref(), NoTls)
            .await
            .map_err(|error| {
                ProfileError::dependency_unavailable(format!("postgres_connect_failed:{error}"))
            })?;

        tokio::spawn(async move {
            if let Err(error) = connection.await {
                tracing::error!(reason = %error, "profile postgres connection error");
            }
        });

        Ok(Arc::new(client))
    }

    /// 接続プールを初期化する。
    /// @param なし
    /// @returns 初期化結果
    /// @throws ProfileError 接続失敗時
    async fn ensure_pool(&self) -> Result<(), ProfileError> {
        {
            let guard = self.clients.read().await;
            if !guard.is_empty() {
                return Ok(());
            }
        }

        let mut guard = self.clients.write().await;
        if !guard.is_empty() {
            return Ok(());
        }

        for _ in 0..self.pool_size {
            guard.push(self.connect_client().await?);
        }

        Ok(())
    }

    /// 接続プールからクライアントを選択する。
    /// @param なし
    /// @returns 選択されたクライアント
    /// @throws ProfileError 接続未確立時
    async fn select_client(&self) -> Result<Arc<tokio_postgres::Client>, ProfileError> {
        self.ensure_pool().await?;

        let guard = self.clients.read().await;
        if guard.is_empty() {
            return Err(ProfileError::dependency_unavailable("postgres_pool_empty"));
        }

        let index = (self.next_index.fetch_add(1, Ordering::Relaxed) as usize) % guard.len();
        Ok(Arc::clone(&guard[index]))
    }

    /// 接続プールを破棄して再接続を促す。
    /// @param なし
    /// @returns なし
    /// @throws なし
    async fn invalidate_pool(&self) {
        let mut guard = self.clients.write().await;
        guard.clear();
    }

    /// クエリエラー時に接続プールを破棄して依存障害へ変換する。
    /// @param reason 障害理由
    /// @returns 依存障害エラー
    /// @throws なし
    async fn dependency_unavailable_after_pool_invalidate(
        &self,
        reason: impl Into<String>,
    ) -> ProfileError {
        self.invalidate_pool().await;
        ProfileError::dependency_unavailable(reason.into())
    }
}

#[async_trait]
impl ProfileService for PostgresProfileService {
    /// 認証済みprincipalのプロフィールを取得する。
    /// @param principal_id 認証済みprincipal_id
    /// @returns プロフィール
    /// @throws ProfileError 入力不正または依存障害時
    async fn get_profile(
        &self,
        principal_id: PrincipalId,
    ) -> Result<ProfileSettings, ProfileError> {
        let client = self.select_client().await?;

        let row = match client
            .query_opt(
                "SELECT display_name, status_text, avatar_key, banner_key, theme
                 FROM users
                 WHERE id = $1
                 LIMIT 1",
                &[&principal_id.0],
            )
            .await
        {
            Ok(row) => row,
            Err(error) => {
                let profile_error = self
                    .dependency_unavailable_after_pool_invalidate(format!(
                        "profile_get_query_failed:{error}"
                    ))
                    .await;
                return Err(profile_error);
            }
        };

        let Some(row) = row else {
            return Err(ProfileError::not_found("user_not_found"));
        };

        Ok(ProfileSettings {
            display_name: row.get::<&str, String>("display_name"),
            status_text: row.get::<&str, Option<String>>("status_text"),
            avatar_key: row.get::<&str, Option<String>>("avatar_key"),
            banner_key: row.get::<&str, Option<String>>("banner_key"),
            theme: ProfileTheme::parse(row.get::<&str, String>("theme").as_str())
                .map_err(|_| ProfileError::dependency_unavailable("profile_theme_invalid"))?,
        })
    }

    /// 認証済みprincipalのプロフィールを更新する。
    /// @param principal_id 認証済みprincipal_id
    /// @param patch 更新入力
    /// @returns 更新後プロフィール
    /// @throws ProfileError 入力不正または依存障害時
    async fn update_profile(
        &self,
        principal_id: PrincipalId,
        patch: ProfilePatchInput,
    ) -> Result<ProfileSettings, ProfileError> {
        let normalized_patch = normalize_profile_patch_input(patch)?;
        validate_profile_media_patch_keys(principal_id, &normalized_patch)?;
        let client = self.select_client().await?;

        let set_display_name = normalized_patch.display_name.is_some();
        let display_name_value = normalized_patch.display_name.as_deref();

        let set_status_text = normalized_patch.status_text.is_some();
        let status_text_value = normalized_patch
            .status_text
            .as_ref()
            .and_then(|value| value.as_deref());

        let set_avatar_key = normalized_patch.avatar_key.is_some();
        let avatar_key_value = normalized_patch
            .avatar_key
            .as_ref()
            .and_then(|value| value.as_deref());
        let set_banner_key = normalized_patch.banner_key.is_some();
        let banner_key_value = normalized_patch
            .banner_key
            .as_ref()
            .and_then(|value| value.as_deref());
        let set_theme = normalized_patch.theme.is_some();
        let theme_value = normalized_patch.theme.as_ref().map(ProfileTheme::as_str);

        let row = match client
            .query_opt(
                "UPDATE users
                 SET
                   display_name = CASE WHEN $2::boolean THEN $3::text ELSE display_name END,
                   status_text = CASE WHEN $4::boolean THEN $5::text ELSE status_text END,
                   avatar_key = CASE WHEN $6::boolean THEN $7::text ELSE avatar_key END,
                   banner_key = CASE WHEN $8::boolean THEN $9::text ELSE banner_key END,
                   theme = CASE WHEN $10::boolean THEN $11::text ELSE theme END
                 WHERE id = $1
                 RETURNING display_name, status_text, avatar_key, banner_key, theme",
                &[
                    &principal_id.0,
                    &set_display_name,
                    &display_name_value,
                    &set_status_text,
                    &status_text_value,
                    &set_avatar_key,
                    &avatar_key_value,
                    &set_banner_key,
                    &banner_key_value,
                    &set_theme,
                    &theme_value,
                ],
            )
            .await
        {
            Ok(row) => row,
            Err(error) => {
                let profile_error = self
                    .dependency_unavailable_after_pool_invalidate(format!(
                        "profile_update_query_failed:{error}"
                    ))
                    .await;
                return Err(profile_error);
            }
        };

        let Some(row) = row else {
            return Err(ProfileError::not_found("user_not_found"));
        };

        Ok(ProfileSettings {
            display_name: row.get::<&str, String>("display_name"),
            status_text: row.get::<&str, Option<String>>("status_text"),
            avatar_key: row.get::<&str, Option<String>>("avatar_key"),
            banner_key: row.get::<&str, Option<String>>("banner_key"),
            theme: ProfileTheme::parse(row.get::<&str, String>("theme").as_str())
                .map_err(|_| ProfileError::dependency_unavailable("profile_theme_invalid"))?,
        })
    }
}
