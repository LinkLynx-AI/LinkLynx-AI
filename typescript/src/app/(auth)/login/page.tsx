import { createUiGateway } from "@/entities";
import { AuthRoutePreview } from "@/app/(auth)/_components/auth-route-preview";

export default async function LoginPage() {
  const uiGateway = createUiGateway();
  const content = await uiGateway.auth.getRouteContent("login");

  return <AuthRoutePreview {...content} />;
}
