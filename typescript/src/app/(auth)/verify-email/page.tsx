import { APP_ROUTES } from "@/shared/config";
import { AuthRoutePreview } from "@/app/(auth)/_components/auth-route-preview";

export default function VerifyEmailPage() {
  return (
    <AuthRoutePreview
      title="メール確認"
      description="待機・再送・完了の導線を確認するためのプレビューです。"
      links={[
        { label: "ログインへ", href: APP_ROUTES.login },
        { label: "パスワード再設定へ", href: APP_ROUTES.passwordReset },
        { label: "認証後の遷移先 (me)", href: APP_ROUTES.channels.me },
      ]}
    />
  );
}
