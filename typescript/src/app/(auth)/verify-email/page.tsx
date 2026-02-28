import { createUiGateway } from "@/entities";
import { AuthRoutePreview } from "@/app/(auth)/_components/auth-route-preview";

export default async function VerifyEmailPage() {
  const uiGateway = createUiGateway();
  const content = await uiGateway.auth.getRouteContent("verify-email");

  return <AuthRoutePreview {...content} />;
}
