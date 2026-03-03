import { AuthLayout } from "@/app/(auth)/_components/auth-layout";
import { RegisterForm } from "@/features/auth-flow/ui/register-form";
import { APP_ROUTES } from "@/shared/config";

export default function RegisterPage() {
  return (
    <AuthLayout
      title="アカウントを作成"
      footerText="すでにアカウントをお持ちの方は"
      footerLinkText="ログイン"
      footerLinkHref={APP_ROUTES.login}
    >
      <RegisterForm />
    </AuthLayout>
  );
}
