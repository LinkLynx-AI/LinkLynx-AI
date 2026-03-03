import { createUiGateway } from "@/entities";
import { AuthRoutePreview } from "@/app/(auth)/_components/auth-route-preview";
import { PasswordResetForm } from "@/features";

export default async function PasswordResetPage() {
  const uiGateway = createUiGateway();
  const content = await uiGateway.auth.getRouteContent("password-reset");

  return (
    <AuthRoutePreview {...content}>
      <PasswordResetForm />
    </AuthRoutePreview>
  );
}
