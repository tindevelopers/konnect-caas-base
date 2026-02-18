"use server";

import { testAssistantTool } from "@tinadmin/telnyx-ai-platform/server";
import { getTelnyxTransport } from "./client";

export async function testAssistantToolAction(params: {
  assistantId: string;
  toolId: string;
}) {
  const transport = await getTelnyxTransport("integrations.write");
  return testAssistantTool(transport, params.assistantId, params.toolId);
}

