use tokio_postgres::Row;

/// Postgres-backed モデレーションサービスを表現する。
#[derive(Clone)]
pub struct PostgresModerationService {
    authorizer: Arc<dyn Authorizer>,
    database_url: Arc<str>,
    allow_postgres_notls: bool,
    clients: Arc<RwLock<Vec<Arc<tokio_postgres::Client>>>>,
    next_index: Arc<AtomicU64>,
    pool_size: usize,
}

impl PostgresModerationService {
    const DEFAULT_POOL_SIZE: usize = 4;
    const MAX_POOL_SIZE: usize = 100;
    const REPORT_ROW_SELECT: &str = "
        id AS report_id,
        guild_id,
        reporter_id,
        target_type,
        target_id,
        reason,
        status::text AS status,
        resolved_by,
        CASE
          WHEN resolved_at IS NULL THEN NULL
          ELSE to_char(resolved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
        END AS resolved_at,
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at,
        to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS updated_at";
    const CREATE_REPORT_SQL: &str = "
        WITH member AS (
          SELECT gm.guild_id
          FROM guild_members gm
          WHERE gm.guild_id = $1 AND gm.user_id = $2
          FOR KEY SHARE
        ),
        inserted AS (
          INSERT INTO moderation_reports (guild_id, reporter_id, target_type, target_id, reason)
          SELECT m.guild_id, $2, $3, $4, $5
          FROM member m
          RETURNING
            id,
            guild_id,
            reporter_id,
            target_type,
            target_id,
            reason,
            status,
            resolved_by,
            resolved_at,
            created_at,
            updated_at
        ),
        audit_insert AS (
          INSERT INTO audit_logs (guild_id, actor_id, action, target_type, target_id, metadata)
          SELECT
            i.guild_id,
            $2,
            'REPORT_CREATE',
            'moderation_report',
            i.id,
            jsonb_build_object(
              'report_id', i.id,
              'reported_target_type', i.target_type,
              'reported_target_id', i.target_id,
              'status', i.status::text
            )
          FROM inserted i
        )
        SELECT
          id AS report_id,
          guild_id,
          reporter_id,
          target_type,
          target_id,
          reason,
          status::text AS status,
          resolved_by,
          CASE
            WHEN resolved_at IS NULL THEN NULL
            ELSE to_char(resolved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
          END AS resolved_at,
          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at,
          to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS updated_at
        FROM inserted";
    const UPSERT_MUTE_SQL: &str = "
        INSERT INTO moderation_mutes (guild_id, target_user_id, reason, created_by, expires_at)
        VALUES ($1, $2, $3, $4, $5::timestamptz)
        ON CONFLICT (guild_id, target_user_id)
        DO UPDATE SET
          reason = EXCLUDED.reason,
          created_by = EXCLUDED.created_by,
          expires_at = EXCLUDED.expires_at,
          created_at = now()
        RETURNING
          id AS mute_id,
          guild_id,
          target_user_id,
          reason,
          created_by,
          CASE
            WHEN expires_at IS NULL THEN NULL
            ELSE to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
          END AS expires_at,
          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at";
    const WRITE_MUTE_AUDIT_SQL: &str = "
        INSERT INTO audit_logs (guild_id, actor_id, action, target_type, target_id, metadata)
        VALUES (
          $1,
          $2,
          'MUTE_CREATE',
          'user',
          $3,
          jsonb_build_object(
            'mute_id', $4,
            'target_user_id', $3,
            'expires_at', $5
          )
        )";

    /// Postgresサービスを生成する。
    /// @param authorizer 認可境界
    /// @param database_url 接続文字列
    /// @param allow_postgres_notls 平文接続許可フラグ
    /// @returns Postgresサービス
    /// @throws なし
    pub fn new(
        authorizer: Arc<dyn Authorizer>,
        database_url: String,
        allow_postgres_notls: bool,
    ) -> Self {
        let pool_size = Self::parse_pool_size_from_env();

        Self {
            authorizer,
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
        match env::var("MODERATION_STORE_POOL_SIZE") {
            Ok(value) => match value.parse::<usize>() {
                Ok(0) => {
                    warn!(
                        env_var = "MODERATION_STORE_POOL_SIZE",
                        value = %value,
                        default = Self::DEFAULT_POOL_SIZE,
                        "pool size must be >= 1; fallback to default"
                    );
                    Self::DEFAULT_POOL_SIZE
                }
                Ok(parsed) if parsed > Self::MAX_POOL_SIZE => {
                    warn!(
                        env_var = "MODERATION_STORE_POOL_SIZE",
                        value = %value,
                        max = Self::MAX_POOL_SIZE,
                        "pool size exceeds upper bound; clamped"
                    );
                    Self::MAX_POOL_SIZE
                }
                Ok(parsed) => parsed,
                Err(error) => {
                    warn!(
                        env_var = "MODERATION_STORE_POOL_SIZE",
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
    /// @throws ModerationError 接続失敗時
    async fn connect_client(&self) -> Result<Arc<tokio_postgres::Client>, ModerationError> {
        if !self.allow_postgres_notls {
            return Err(ModerationError::dependency_unavailable(
                "postgres_tls_required",
            ));
        }

        let (client, connection) = tokio_postgres::connect(self.database_url.as_ref(), NoTls)
            .await
            .map_err(|error| {
                ModerationError::dependency_unavailable(format!("postgres_connect_failed:{error}"))
            })?;

        tokio::spawn(async move {
            if let Err(error) = connection.await {
                tracing::error!(reason = %error, "moderation postgres connection error");
            }
        });

        Ok(Arc::new(client))
    }

    /// 接続プールを初期化する。
    /// @param なし
    /// @returns 初期化結果
    /// @throws ModerationError 接続失敗時
    async fn ensure_pool(&self) -> Result<(), ModerationError> {
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
    /// @throws ModerationError 接続未確立時
    async fn select_client(&self) -> Result<Arc<tokio_postgres::Client>, ModerationError> {
        self.ensure_pool().await?;

        let guard = self.clients.read().await;
        if guard.is_empty() {
            return Err(ModerationError::dependency_unavailable("postgres_pool_empty"));
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

    /// 読み取り系DBエラーをAPIエラーへ変換する。
    /// @param context エラー文脈
    /// @param error Postgresエラー
    /// @returns APIエラー
    /// @throws なし
    async fn map_read_error(&self, context: &str, error: tokio_postgres::Error) -> ModerationError {
        if Self::should_invalidate_pool_for_read_error(&error) {
            self.invalidate_pool().await;
        }
        ModerationError::dependency_unavailable(format!("{context}:{error}"))
    }

    /// 読み取り系DBエラーでプール破棄が必要か判定する。
    /// @param error Postgresエラー
    /// @returns 接続断系エラーの場合は `true`
    /// @throws なし
    fn should_invalidate_pool_for_read_error(error: &tokio_postgres::Error) -> bool {
        if error.is_closed() {
            return true;
        }

        std::error::Error::source(error)
            .and_then(|source| source.downcast_ref::<std::io::Error>())
            .is_some()
    }

    /// guild存在を確認する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @returns guildが存在する場合は `true`
    /// @throws ModerationError 依存障害時
    async fn has_guild(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
    ) -> Result<bool, ModerationError> {
        match client
            .query_opt("SELECT 1 FROM guilds WHERE id = $1", &[&guild_id])
            .await
        {
            Ok(row) => Ok(row.is_some()),
            Err(error) => Err(self.map_read_error("guild_lookup_failed", error).await),
        }
    }

    /// guild所属有無を確認する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @param user_id 対象user_id
    /// @returns 所属している場合は `true`
    /// @throws ModerationError 依存障害時
    async fn is_guild_member(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
        user_id: i64,
    ) -> Result<bool, ModerationError> {
        match client
            .query_opt(
                "SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2",
                &[&guild_id, &user_id],
            )
            .await
        {
            Ok(row) => Ok(row.is_some()),
            Err(error) => Err(self.map_read_error("guild_membership_lookup_failed", error).await),
        }
    }

    /// 通報作成可否を確認する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @param principal_id 実行主体
    /// @returns なし
    /// @throws ModerationError 未存在/権限拒否/依存障害時
    async fn ensure_reporter_access(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
        principal_id: PrincipalId,
    ) -> Result<(), ModerationError> {
        if self.is_guild_member(client, guild_id, principal_id.0).await? {
            return Ok(());
        }

        if !self.has_guild(client, guild_id).await? {
            return Err(ModerationError::not_found("guild_not_found"));
        }

        Err(ModerationError::forbidden("guild_membership_required"))
    }

    /// モデレーター専用操作可否を確認する。
    /// @param guild_id 対象guild_id
    /// @param principal_id 実行主体
    /// @returns なし
    /// @throws ModerationError 権限拒否/依存障害時
    async fn ensure_moderator_access(
        &self,
        guild_id: i64,
        principal_id: PrincipalId,
    ) -> Result<(), ModerationError> {
        let input = AuthzCheckInput {
            principal_id,
            resource: AuthzResource::Guild { guild_id },
            action: AuthzAction::Manage,
        };
        match self.authorizer.check(&input).await {
            Ok(()) => Ok(()),
            Err(error) if matches!(error.kind, AuthzErrorKind::Denied) => {
                Err(ModerationError::forbidden("moderation_role_required"))
            }
            Err(error) => Err(ModerationError::dependency_unavailable(format!(
                "moderation_authorizer_failed:{}",
                error.reason
            ))),
        }
    }

    /// モデレーション対象 guild の存在を確認する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @returns なし
    /// @throws ModerationError 未存在/依存障害時
    async fn ensure_guild_exists(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
    ) -> Result<(), ModerationError> {
        if self.has_guild(client, guild_id).await? {
            return Ok(());
        }

        Err(ModerationError::not_found("guild_not_found"))
    }

    /// 書き込み系DBエラーをAPIエラーへ変換する。
    /// @param context エラー文脈
    /// @param error Postgresエラー
    /// @returns APIエラー
    /// @throws なし
    fn map_write_error(context: &str, error: tokio_postgres::Error) -> ModerationError {
        if let Some(db_error) = error.as_db_error() {
            if db_error.code() == &SqlState::CHECK_VIOLATION {
                return ModerationError::validation("request_constraint_violation");
            }
            if db_error.code() == &SqlState::INVALID_DATETIME_FORMAT
                || db_error.code() == &SqlState::DATETIME_FIELD_OVERFLOW
            {
                return ModerationError::validation("expires_at_invalid");
            }
            if db_error.code() == &SqlState::FOREIGN_KEY_VIOLATION {
                return ModerationError::validation("foreign_key_invalid");
            }
        }

        ModerationError::dependency_unavailable(format!("{context}:{error}"))
    }

    /// 通報行をAPIモデルへ変換する。
    /// @param row Postgres行
    /// @returns 通報モデル
    /// @throws ModerationError 列値不正時
    fn parse_report_row(row: Row) -> Result<ModerationReport, ModerationError> {
        let target_type_text = row.get::<&str, String>("target_type");
        let target_type = ModerationTargetType::parse_db_label(&target_type_text)
            .ok_or_else(|| ModerationError::dependency_unavailable("report_target_type_invalid"))?;

        let status_text = row.get::<&str, String>("status");
        let status = ModerationReportStatus::parse_db_label(&status_text)
            .ok_or_else(|| ModerationError::dependency_unavailable("report_status_invalid"))?;

        Ok(ModerationReport {
            report_id: row.get::<&str, i64>("report_id"),
            guild_id: row.get::<&str, i64>("guild_id"),
            reporter_id: row.get::<&str, i64>("reporter_id"),
            target_type,
            target_id: row.get::<&str, i64>("target_id"),
            reason: row.get::<&str, String>("reason"),
            status,
            resolved_by: row.get::<&str, Option<i64>>("resolved_by"),
            resolved_at: row.get::<&str, Option<String>>("resolved_at"),
            created_at: row.get::<&str, String>("created_at"),
            updated_at: row.get::<&str, String>("updated_at"),
        })
    }

    /// ミュート行をAPIモデルへ変換する。
    /// @param row Postgres行
    /// @returns ミュートモデル
    /// @throws なし
    fn parse_mute_row(row: Row) -> ModerationMute {
        ModerationMute {
            mute_id: row.get::<&str, i64>("mute_id"),
            guild_id: row.get::<&str, i64>("guild_id"),
            target_user_id: row.get::<&str, i64>("target_user_id"),
            reason: row.get::<&str, String>("reason"),
            created_by: row.get::<&str, i64>("created_by"),
            expires_at: row.get::<&str, Option<String>>("expires_at"),
            created_at: row.get::<&str, String>("created_at"),
        }
    }

    /// 通報1件を取得する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @param report_id 対象report_id
    /// @returns 通報
    /// @throws ModerationError 未存在/依存障害時
    async fn fetch_report(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
        report_id: i64,
    ) -> Result<ModerationReport, ModerationError> {
        let sql = format!(
            "SELECT {} FROM moderation_reports WHERE guild_id = $1 AND id = $2",
            Self::REPORT_ROW_SELECT
        );
        let row = match client.query_opt(&sql, &[&guild_id, &report_id]).await {
            Ok(Some(row)) => row,
            Ok(None) => return Err(ModerationError::not_found("report_not_found")),
            Err(error) => return Err(self.map_read_error("report_lookup_failed", error).await),
        };

        Self::parse_report_row(row)
    }

    /// 通報一覧ページを構築する。
    /// @param rows 取得済み行
    /// @param limit ページサイズ
    /// @param status 適用済みstatus filter
    /// @returns 通報一覧ページ
    /// @throws ModerationError 行変換失敗時
    fn build_report_list_page(
        rows: Vec<Row>,
        limit: usize,
        status: Option<ModerationReportStatus>,
    ) -> Result<ModerationReportListPage, ModerationError> {
        let mut reports = rows
            .into_iter()
            .map(Self::parse_report_row)
            .collect::<Result<Vec<_>, _>>()?;
        let has_more = reports.len() > limit;
        if has_more {
            reports.truncate(limit);
        }
        let next_after = if has_more {
            reports.last().map(|report| {
                ModerationReportListCursor {
                    created_at: report.created_at.clone(),
                    report_id: report.report_id,
                }
                .encode()
            })
        } else {
            None
        };

        Ok(ModerationReportListPage {
            reports,
            page_info: ModerationReportListPageInfo {
                next_after,
                has_more,
                limit,
                status,
            },
        })
    }

    /// 通報をresolve状態へ更新する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @param report_id 対象report_id
    /// @param principal_id 実行主体
    /// @returns 更新済み通報（更新時のみ）
    /// @throws ModerationError 依存障害時
    async fn update_report_to_resolved(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
        report_id: i64,
        principal_id: PrincipalId,
    ) -> Result<Option<ModerationReport>, ModerationError> {
        let sql = format!(
            "WITH updated AS (
               UPDATE moderation_reports
               SET
                 status = 'resolved',
                 resolved_by = $3,
                 resolved_at = now(),
                 updated_at = now()
               WHERE guild_id = $1
                 AND id = $2
                 AND status = 'open'
               RETURNING {}
             ),
             audit_insert AS (
               INSERT INTO audit_logs (guild_id, actor_id, action, target_type, target_id, metadata)
               SELECT
                 u.guild_id,
                 $3,
                 'REPORT_RESOLVE',
                 'moderation_report',
                 u.report_id,
                 jsonb_build_object('report_id', u.report_id, 'status', u.status::text)
               FROM updated u
             )
             SELECT * FROM updated",
            Self::REPORT_ROW_SELECT
        );

        match client.query_opt(&sql, &[&guild_id, &report_id, &principal_id.0]).await {
            Ok(Some(row)) => Self::parse_report_row(row).map(Some),
            Ok(None) => Ok(None),
            Err(error) => Err(Self::map_write_error("report_resolve_failed", error)),
        }
    }

    /// 通報をopen状態へ更新する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @param report_id 対象report_id
    /// @param principal_id 実行主体
    /// @returns 更新済み通報（更新時のみ）
    /// @throws ModerationError 依存障害時
    async fn update_report_to_open(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
        report_id: i64,
        principal_id: PrincipalId,
    ) -> Result<Option<ModerationReport>, ModerationError> {
        let sql = format!(
            "WITH updated AS (
               UPDATE moderation_reports
               SET
                 status = 'open',
                 resolved_by = NULL,
                 resolved_at = NULL,
                 updated_at = now()
               WHERE guild_id = $1
                 AND id = $2
                 AND status = 'resolved'
               RETURNING {}
             ),
             audit_insert AS (
               INSERT INTO audit_logs (guild_id, actor_id, action, target_type, target_id, metadata)
               SELECT
                 u.guild_id,
                 $3,
                 'REPORT_REOPEN',
                 'moderation_report',
                 u.report_id,
                 jsonb_build_object('report_id', u.report_id, 'status', u.status::text)
               FROM updated u
             )
             SELECT * FROM updated",
            Self::REPORT_ROW_SELECT
        );

        match client.query_opt(&sql, &[&guild_id, &report_id, &principal_id.0]).await {
            Ok(Some(row)) => Self::parse_report_row(row).map(Some),
            Ok(None) => Ok(None),
            Err(error) => Err(Self::map_write_error("report_reopen_failed", error)),
        }
    }
}

#[async_trait]
impl ModerationService for PostgresModerationService {
    /// 通報を作成する。
    /// @param principal_id 実行主体
    /// @param input 通報作成入力
    /// @returns 作成済み通報
    /// @throws ModerationError 入力不正/権限拒否/依存障害時
    async fn create_report(
        &self,
        principal_id: PrincipalId,
        input: CreateModerationReportInput,
    ) -> Result<ModerationReport, ModerationError> {
        let target_id = normalize_positive_id(input.target_id, "target_id_must_be_positive")?;
        let reason = normalize_non_empty_reason(&input.reason, "report_reason_required")?;
        let client = self.select_client().await?;

        let row = match client
            .query_opt(
                Self::CREATE_REPORT_SQL,
                &[
                    &input.guild_id,
                    &principal_id.0,
                    &input.target_type.as_db_label(),
                    &target_id,
                    &reason,
                ],
            )
            .await
        {
            Ok(Some(row)) => row,
            Ok(None) => {
                self.ensure_reporter_access(&client, input.guild_id, principal_id)
                    .await?;
                return Err(ModerationError::dependency_unavailable(
                    "report_insert_missing_row",
                ));
            }
            Err(error) => return Err(Self::map_write_error("report_insert_failed", error)),
        };

        Self::parse_report_row(row)
    }

    /// ミュートを作成または更新する。
    /// @param principal_id 実行主体
    /// @param input ミュート入力
    /// @returns ミュート情報
    /// @throws ModerationError 入力不正/権限拒否/依存障害時
    async fn create_mute(
        &self,
        principal_id: PrincipalId,
        input: CreateModerationMuteInput,
    ) -> Result<ModerationMute, ModerationError> {
        let target_user_id =
            normalize_positive_id(input.target_user_id, "target_user_id_must_be_positive")?;
        let reason = normalize_non_empty_reason(&input.reason, "mute_reason_required")?;
        let expires_at = normalize_optional_expires_at(input.expires_at)?;
        let client = self.select_client().await?;

        self.ensure_moderator_access(input.guild_id, principal_id)
            .await?;
        self.ensure_guild_exists(&client, input.guild_id).await?;

        let row = match client
            .query_one(
                Self::UPSERT_MUTE_SQL,
                &[
                    &input.guild_id,
                    &target_user_id,
                    &reason,
                    &principal_id.0,
                    &expires_at,
                ],
            )
            .await
        {
            Ok(row) => row,
            Err(error) => return Err(Self::map_write_error("mute_upsert_failed", error)),
        };

        let mute = Self::parse_mute_row(row);

        if let Err(error) = client
            .execute(
                Self::WRITE_MUTE_AUDIT_SQL,
                &[
                    &mute.guild_id,
                    &principal_id.0,
                    &mute.target_user_id,
                    &mute.mute_id,
                    &mute.expires_at,
                ],
            )
            .await
        {
            return Err(Self::map_write_error("mute_audit_insert_failed", error));
        }

        Ok(mute)
    }

    /// モデレーションキューを返す。
    /// @param principal_id 実行主体
    /// @param input 一覧取得入力
    /// @returns 通報一覧ページ
    /// @throws ModerationError 権限拒否/依存障害時
    async fn list_reports(
        &self,
        principal_id: PrincipalId,
        input: ListModerationReportsInput,
    ) -> Result<ModerationReportListPage, ModerationError> {
        let client = self.select_client().await?;
        self.ensure_moderator_access(input.guild_id, principal_id).await?;
        self.ensure_guild_exists(&client, input.guild_id).await?;

        let fetch_limit = (input.limit as i64).saturating_add(1);
        let status_text = input.status.map(|status| status.as_db_label().to_owned());
        let after_created_at = input.after.as_ref().map(|cursor| cursor.created_at.clone());
        let after_report_id = input.after.as_ref().map(|cursor| cursor.report_id);

        let sql = match (status_text.as_ref(), after_created_at.as_ref()) {
            (None, None) => format!(
                "SELECT {} FROM moderation_reports WHERE guild_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2",
                Self::REPORT_ROW_SELECT
            ),
            (Some(_), None) => format!(
                "SELECT {} FROM moderation_reports WHERE guild_id = $1 AND status = $2::moderation_report_status ORDER BY created_at DESC, id DESC LIMIT $3",
                Self::REPORT_ROW_SELECT
            ),
            (None, Some(_)) => format!(
                "SELECT {} FROM moderation_reports WHERE guild_id = $1 AND (created_at, id) < ($2::timestamptz, $3) ORDER BY created_at DESC, id DESC LIMIT $4",
                Self::REPORT_ROW_SELECT
            ),
            (Some(_), Some(_)) => format!(
                "SELECT {} FROM moderation_reports WHERE guild_id = $1 AND status = $2::moderation_report_status AND (created_at, id) < ($3::timestamptz, $4) ORDER BY created_at DESC, id DESC LIMIT $5",
                Self::REPORT_ROW_SELECT
            ),
        };

        let rows = match (status_text.as_ref(), after_created_at.as_ref(), after_report_id.as_ref()) {
            (None, None, None) => client.query(&sql, &[&input.guild_id, &fetch_limit]).await,
            (Some(status_text), None, None) => {
                client
                    .query(&sql, &[&input.guild_id, status_text, &fetch_limit])
                    .await
            }
            (None, Some(after_created_at), Some(after_report_id)) => {
                client
                    .query(
                        &sql,
                        &[&input.guild_id, after_created_at, after_report_id, &fetch_limit],
                    )
                    .await
            }
            (Some(status_text), Some(after_created_at), Some(after_report_id)) => {
                client
                    .query(
                        &sql,
                        &[
                            &input.guild_id,
                            status_text,
                            after_created_at,
                            after_report_id,
                            &fetch_limit,
                        ],
                    )
                    .await
            }
            _ => {
                return Err(ModerationError::dependency_unavailable(
                    "report_list_input_mismatch",
                ));
            }
        };

        let rows = match rows {
            Ok(rows) => rows,
            Err(error) => return Err(self.map_read_error("report_list_query_failed", error).await),
        };

        Self::build_report_list_page(rows, input.limit, input.status)
    }

    /// 通報詳細を返す。
    /// @param principal_id 実行主体
    /// @param guild_id 対象guild_id
    /// @param report_id 対象report_id
    /// @returns 通報詳細
    /// @throws ModerationError 未存在/権限拒否/依存障害時
    async fn get_report(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        report_id: i64,
    ) -> Result<ModerationReport, ModerationError> {
        let normalized_report_id = normalize_positive_id(report_id, "report_id_must_be_positive")?;
        let client = self.select_client().await?;
        self.ensure_moderator_access(guild_id, principal_id).await?;
        self.ensure_guild_exists(&client, guild_id).await?;

        self.fetch_report(&client, guild_id, normalized_report_id).await
    }

    /// 通報を resolve へ遷移する。
    /// @param principal_id 実行主体
    /// @param guild_id 対象guild_id
    /// @param report_id 対象report_id
    /// @returns 遷移後の通報
    /// @throws ModerationError 未存在/権限拒否/依存障害時
    async fn resolve_report(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        report_id: i64,
    ) -> Result<ModerationReport, ModerationError> {
        let normalized_report_id = normalize_positive_id(report_id, "report_id_must_be_positive")?;
        let client = self.select_client().await?;
        self.ensure_moderator_access(guild_id, principal_id).await?;
        self.ensure_guild_exists(&client, guild_id).await?;

        if let Some(updated) = self
            .update_report_to_resolved(&client, guild_id, normalized_report_id, principal_id)
            .await?
        {
            return Ok(updated);
        }

        let current = self.fetch_report(&client, guild_id, normalized_report_id).await?;
        if current.status == ModerationReportStatus::Resolved {
            return Ok(current);
        }

        Err(ModerationError::conflict(
            "report_status_transition_to_resolved_conflict",
        ))
    }

    /// 通報を reopen へ遷移する。
    /// @param principal_id 実行主体
    /// @param guild_id 対象guild_id
    /// @param report_id 対象report_id
    /// @returns 遷移後の通報
    /// @throws ModerationError 未存在/権限拒否/依存障害時
    async fn reopen_report(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        report_id: i64,
    ) -> Result<ModerationReport, ModerationError> {
        let normalized_report_id = normalize_positive_id(report_id, "report_id_must_be_positive")?;
        let client = self.select_client().await?;
        self.ensure_moderator_access(guild_id, principal_id).await?;
        self.ensure_guild_exists(&client, guild_id).await?;

        if let Some(updated) = self
            .update_report_to_open(&client, guild_id, normalized_report_id, principal_id)
            .await?
        {
            return Ok(updated);
        }

        let current = self.fetch_report(&client, guild_id, normalized_report_id).await?;
        if current.status == ModerationReportStatus::Open {
            return Ok(current);
        }

        Err(ModerationError::conflict(
            "report_status_transition_to_open_conflict",
        ))
    }
}
