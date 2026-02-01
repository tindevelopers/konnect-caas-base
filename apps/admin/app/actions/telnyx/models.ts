"use server";

import { listModels } from "@tinadmin/telnyx-ai-platform";
import { getTelnyxTransport } from "./client";

export async function listModelsAction() {
  const transport = await getTelnyxTransport("integrations.read");
  return listModels(transport);
}
