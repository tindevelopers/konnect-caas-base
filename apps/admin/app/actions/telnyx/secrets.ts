"use server";

import {
  createIntegrationSecret,
  listIntegrationSecrets,
  TelnyxCreateIntegrationSecretRequest,
} from "@tinadmin/telnyx-ai-platform";
import { getTelnyxTransport } from "./client";

export async function listIntegrationSecretsAction() {
  const transport = await getTelnyxTransport("integrations.read");
  return listIntegrationSecrets(transport);
}

export async function createIntegrationSecretAction(
  payload: TelnyxCreateIntegrationSecretRequest
) {
  const transport = await getTelnyxTransport("integrations.write");
  return createIntegrationSecret(transport, payload);
}
