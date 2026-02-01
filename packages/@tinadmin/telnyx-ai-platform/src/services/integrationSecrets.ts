import { TelnyxTransport } from "../client/types";
import {
  TelnyxCreateIntegrationSecretRequest,
  TelnyxIntegrationSecret,
  TelnyxIntegrationSecretListResponse,
} from "../types/integrationSecrets";

export async function listIntegrationSecrets(
  transport: TelnyxTransport
): Promise<TelnyxIntegrationSecretListResponse> {
  return transport.request("/integration_secrets");
}

export async function createIntegrationSecret(
  transport: TelnyxTransport,
  payload: TelnyxCreateIntegrationSecretRequest
): Promise<TelnyxIntegrationSecret> {
  return transport.request("/integration_secrets", {
    method: "POST",
    body: payload,
  });
}
