import { APP_ROUTES } from "@/shared/config";
import { AuthRoutePreview } from "@/app/(auth)/_components/auth-route-preview";

export default function LoginPage() {
  return (
    <AuthRoutePreview
      title="ログイン"
      description="未実装の認証処理を想定した導線プレビューです。"
      links={[
        { label: "新規登録へ", href: APP_ROUTES.register },
        { label: "メール確認へ", href: APP_ROUTES.verifyEmail },
        { label: "パスワード再設定へ", href: APP_ROUTES.passwordReset },
        { label: "ログイン後の遷移先 (@me)", href: APP_ROUTES.channels.me },
      ]}
    />
  );
}
