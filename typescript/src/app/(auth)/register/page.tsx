import { APP_ROUTES } from "@/shared/config";
import { AuthRoutePreview } from "@/app/(auth)/_components/auth-route-preview";

export default function RegisterPage() {
  return (
    <AuthRoutePreview
      title="新規登録"
      description="登録フォームのUI先行レビュー用ページです。"
      links={[
        { label: "ログインへ", href: APP_ROUTES.login },
        { label: "メール確認へ", href: APP_ROUTES.verifyEmail },
        { label: "ホームへ", href: APP_ROUTES.home },
      ]}
    />
  );
}
