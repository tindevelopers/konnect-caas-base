"use server";

import { listIntegrations } from "@tinadmin/telnyx-ai-platform/server";
import { getTelnyxTransport } from "./client";

export async function listIntegrationsAction() {
  const transport = await getTelnyxTransport("integrations.read");
  return listIntegrations(transport);
}

