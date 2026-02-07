"use client";

import React from "react";
import { AssistantTestsList } from "@tinadmin/telnyx-ai-platform";
import { assistantTestsApi } from "../telnyxApis";

export default function AiTestsPage() {
  return <AssistantTestsList api={assistantTestsApi} />;
}
