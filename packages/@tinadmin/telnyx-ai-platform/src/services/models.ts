import { TelnyxTransport } from "../client/types";
import { TelnyxModelsResponse } from "../types/assistants";

export async function listModels(
  transport: TelnyxTransport
): Promise<TelnyxModelsResponse> {
  return transport.request("/ai/models");
}
