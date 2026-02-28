import { z } from "zod";
import type { UiGateway, UiGatewayProvider } from "../model";
import { createMockUiGateway } from "./mock-ui-gateway";

type CreateUiGatewayOptions = {
  provider?: string;
};

const UI_GATEWAY_PROVIDER_SCHEMA = z.enum(["mock", "api"]);

function resolveUiGatewayProvider(provider: string | undefined): UiGatewayProvider {
  if (provider === undefined) {
    return "mock";
  }

  const parsedProvider = UI_GATEWAY_PROVIDER_SCHEMA.safeParse(provider);

  if (!parsedProvider.success) {
    throw new Error(
      `Invalid NEXT_PUBLIC_UI_GATEWAY_PROVIDER: ${provider}. Allowed values are 'mock' or 'api'.`,
    );
  }

  return parsedProvider.data;
}

/**
 * UI Gateway のprovider設定から利用実体を生成する。
 */
export function createUiGateway(options: CreateUiGatewayOptions = {}): UiGateway {
  const provider = resolveUiGatewayProvider(
    options.provider ?? process.env.NEXT_PUBLIC_UI_GATEWAY_PROVIDER,
  );

  if (provider === "mock") {
    return createMockUiGateway();
  }

  // LIN-504 では API adapter 未実装のため、provider=api でも表示確認を継続できるよう mock へフォールバックする。
  return createMockUiGateway();
}
