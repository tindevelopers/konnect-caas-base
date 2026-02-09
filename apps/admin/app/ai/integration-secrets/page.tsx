"use client";

import React from "react";
import { IntegrationSecretsList } from "@tinadmin/telnyx-ai-platform";
import { integrationSecretsApi } from "../telnyxApis";

export default function IntegrationSecretsPage() {
  return <IntegrationSecretsList api={integrationSecretsApi} />;
}
