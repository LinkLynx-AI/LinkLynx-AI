import { z } from "zod";
import type { UiGateway, UiGatewayProvider } from "../model";
import { createApiUiGateway } from "./api-ui-gateway";
import { createMockUiGateway } from "./mock-ui-gateway";

type CreateUiGatewayOptions = {
  provider?: string;
};

const UI_GATEWAY_PROVIDER_SCHEMA = z.enum(["no-data", "api"]);

function resolveUiGatewayProvider(provider: string | undefined): UiGatewayProvider {
  if (provider === undefined) {
    return "no-data";
  }

  const parsedProvider = UI_GATEWAY_PROVIDER_SCHEMA.safeParse(provider);

  if (!parsedProvider.success) {
    throw new Error(
      `Invalid NEXT_PUBLIC_UI_GATEWAY_PROVIDER: ${provider}. Allowed values are 'no-data' or 'api'.`,
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

  if (provider === "no-data") {
    return createMockUiGateway();
  }

  return createApiUiGateway();
}
