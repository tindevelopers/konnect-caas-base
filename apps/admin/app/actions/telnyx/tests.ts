"use server";

import {
  createAssistantTest,
  listAssistantTests,
  triggerAssistantTestRun,
  TelnyxCreateAssistantTestRequest,
  TelnyxTriggerTestRunRequest,
} from "@tinadmin/telnyx-ai-platform/server";
import { getTelnyxTransport } from "./client";

export async function listAssistantTestsAction(
  query?: Record<string, string | number | boolean | undefined>
) {
  const transport = await getTelnyxTransport("integrations.read");
  return listAssistantTests(transport, query);
}

export async function createAssistantTestAction(
  payload: TelnyxCreateAssistantTestRequest
) {
  const transport = await getTelnyxTransport("integrations.write");
  return createAssistantTest(transport, payload);
}

export async function triggerAssistantTestRunAction(
  testId: string,
  payload?: TelnyxTriggerTestRunRequest
) {
  const transport = await getTelnyxTransport("integrations.write");
  return triggerAssistantTestRun(transport, testId, payload);
}
