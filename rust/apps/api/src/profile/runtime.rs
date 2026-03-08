/// 実行時向けのプロフィールサービスを生成する。
/// @param なし
/// @returns プロフィールサービス
/// @throws なし
pub fn build_runtime_profile_service() -> Arc<dyn ProfileService> {
    let database_url = match env::var("DATABASE_URL") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => {
            warn!("DATABASE_URL missing; profile service will fail-close as unavailable");
            return Arc::new(UnavailableProfileService::new("profile_store_unconfigured"));
        }
    };

    let allow_postgres_notls = parse_runtime_bool_env("AUTH_ALLOW_POSTGRES_NOTLS", false);
    if !allow_postgres_notls {
        warn!(
            "AUTH_ALLOW_POSTGRES_NOTLS is false; profile service stays fail-close until TLS connector is configured"
        );
        return Arc::new(UnavailableProfileService::new("postgres_tls_required"));
    }

    Arc::new(PostgresProfileService::new(database_url, allow_postgres_notls))
}

/// 実行時向けのプロフィール画像サービスを生成する。
/// @param profile_service 既存 profile service
/// @returns profile media service
/// @throws なし
pub fn build_runtime_profile_media_service(
    profile_service: Arc<dyn ProfileService>,
) -> Arc<dyn ProfileMediaService> {
    let bucket = match env::var(PROFILE_MEDIA_BUCKET_ENV) {
        Ok(value) if !value.trim().is_empty() => value.trim().to_owned(),
        _ => {
            warn!(
                env_var = PROFILE_MEDIA_BUCKET_ENV,
                "profile media bucket missing; service will fail-close as unavailable"
            );
            return Arc::new(UnavailableProfileMediaService::new(
                "profile_media_bucket_unconfigured",
            ));
        }
    };
    let signer = match env::var("GOOGLE_APPLICATION_CREDENTIALS") {
        Ok(value) if !value.trim().is_empty() => {
            match GcsSignedUrlSigner::from_service_account_path(bucket, value.trim()) {
                Ok(value) => value,
                Err(error) => {
                    warn!(reason = %error.reason, "profile media signer initialization failed");
                    return Arc::new(UnavailableProfileMediaService::new(error.reason));
                }
            }
        }
        _ => {
            warn!(
                env_var = "GOOGLE_APPLICATION_CREDENTIALS",
                "profile media signer will use attached runtime service account"
            );
            GcsSignedUrlSigner::from_attached_service_account(bucket)
        }
    };

    Arc::new(GcsProfileMediaService::new(profile_service, signer))
}

/// 実行時bool環境変数を解釈する。
/// @param name 環境変数名
/// @param default 未設定時のデフォルト値
/// @returns 解釈結果
/// @throws なし
fn parse_runtime_bool_env(name: &str, default: bool) -> bool {
    match env::var(name) {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            match normalized.as_str() {
                "1" | "true" | "yes" | "on" => true,
                "0" | "false" | "no" | "off" => false,
                _ => {
                    warn!(
                        env_var = %name,
                        value = %value,
                        default = default,
                        "invalid bool env value; fallback to default"
                    );
                    default
                }
            }
        }
        Err(_) => default,
    }
}
