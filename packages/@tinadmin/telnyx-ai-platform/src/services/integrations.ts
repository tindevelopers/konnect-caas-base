import type { TelnyxTransport } from "../client/types";
import type { TelnyxIntegrationsListResponse } from "../types/integrations";

export async function listIntegrations(
  transport: TelnyxTransport
): Promise<TelnyxIntegrationsListResponse> {
  return transport.request("/ai/integrations");
}

