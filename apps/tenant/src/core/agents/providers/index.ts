import "server-only";

import { AbacusAgentProvider } from "./abacus";
import { AdvancedAgentProvider } from "./advanced";
import { TelnyxAgentProvider } from "./telnyx";
import type { AgentProviderDriver } from "./base";
import type { AgentProvider } from "../types";

const registry: Record<string, AgentProviderDriver> = {
  telnyx: new TelnyxAgentProvider(),
  advanced: new AdvancedAgentProvider(),
  abacus: new AbacusAgentProvider(),
};

export function getAgentProviderDriver(
  provider: AgentProvider
): AgentProviderDriver {
  const driver = registry[String(provider)];
  if (!driver) {
    throw new Error(
      `Unsupported agent provider "${provider}". Configure a provider driver first.`
    );
  }
  return driver;
}

