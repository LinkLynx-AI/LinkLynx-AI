import { AuthLayout } from "@/app/(auth)/_components/auth-layout";
import { LoginForm } from "@/features/auth-flow";
import { APP_ROUTES } from "@/shared/config";

export default function LoginPage() {
  return (
    <AuthLayout
      title="おかえりなさい！"
      description="ログインして続きを楽しもう"
      footerText="アカウントをお持ちでない方は"
      footerLinkText="新規登録"
      footerLinkHref={APP_ROUTES.register}
    >
      <LoginForm />
    </AuthLayout>
  );
}
