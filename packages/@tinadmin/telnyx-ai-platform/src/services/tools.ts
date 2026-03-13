import type { TelnyxTransport } from "../client/types";
import type { TelnyxToolTestResponse } from "../types/tools";

export async function testAssistantTool(
  transport: TelnyxTransport,
  assistantId: string,
  toolId: string
): Promise<TelnyxToolTestResponse> {
  return transport.request(`/ai/assistants/${assistantId}/tools/${toolId}/test`, {
    method: "POST",
    body: {},
  });
}

