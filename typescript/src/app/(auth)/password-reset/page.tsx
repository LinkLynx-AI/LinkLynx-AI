import { AuthLayout } from "@/app/(auth)/_components/auth-layout";
import { PasswordResetForm } from "@/features/auth-flow/ui/password-reset-form";
import { APP_ROUTES } from "@/shared/config";

export default function PasswordResetPage() {
  return (
    <AuthLayout
      title="パスワードをリセット"
      description="登録済みのメールアドレスへ再設定リンクを送ります"
      footerText="ログイン画面に戻る"
      footerLinkText="ログイン"
      footerLinkHref={APP_ROUTES.login}
    >
      <PasswordResetForm />
    </AuthLayout>
  );
}
