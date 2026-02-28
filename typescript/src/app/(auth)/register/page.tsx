import { createUiGateway } from "@/entities";
import { AuthRoutePreview } from "@/app/(auth)/_components/auth-route-preview";

export default async function RegisterPage() {
  const uiGateway = createUiGateway();
  const content = await uiGateway.auth.getRouteContent("register");

  return <AuthRoutePreview {...content} />;
}
