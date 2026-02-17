import "server-only";

import type { AgentProviderRequest, AgentProviderResponse } from "../types";

export interface AgentProviderDriver {
  readonly name: string;
  sendMessage(request: AgentProviderRequest): Promise<AgentProviderResponse>;
}

