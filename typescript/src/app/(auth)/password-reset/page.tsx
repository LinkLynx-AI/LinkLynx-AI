import { APP_ROUTES } from "@/shared/config";
import { AuthRoutePreview } from "@/app/(auth)/_components/auth-route-preview";

export default function PasswordResetPage() {
  return (
    <AuthRoutePreview
      title="パスワード再設定"
      description="申請・再設定・完了の遷移確認用プレビューです。"
      links={[
        { label: "ログインへ戻る", href: APP_ROUTES.login },
        { label: "新規登録へ", href: APP_ROUTES.register },
        { label: "メール確認へ", href: APP_ROUTES.verifyEmail },
      ]}
    />
  );
}
