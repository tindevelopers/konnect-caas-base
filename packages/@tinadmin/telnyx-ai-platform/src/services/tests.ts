import { TelnyxTransport } from "../client/types";
import {
  TelnyxAssistantTest,
  TelnyxAssistantTestListResponse,
  TelnyxCreateAssistantTestRequest,
  TelnyxAssistantTestRun,
  TelnyxTriggerTestRunRequest,
} from "../types/tests";

export async function listAssistantTests(
  transport: TelnyxTransport,
  query?: Record<string, string | number | boolean | undefined>
): Promise<TelnyxAssistantTestListResponse> {
  return transport.request("/ai/assistants/tests", {
    query,
  });
}

export async function createAssistantTest(
  transport: TelnyxTransport,
  payload: TelnyxCreateAssistantTestRequest
): Promise<TelnyxAssistantTest> {
  return transport.request("/ai/assistants/tests", {
    method: "POST",
    body: payload,
  });
}

export async function triggerAssistantTestRun(
  transport: TelnyxTransport,
  testId: string,
  payload?: TelnyxTriggerTestRunRequest
): Promise<TelnyxAssistantTestRun> {
  return transport.request(`/ai/assistants/tests/${testId}/runs`, {
    method: "POST",
    body: payload ?? {},
  });
}

export async function getAssistantTestRun(
  transport: TelnyxTransport,
  testId: string,
  runId: string
): Promise<TelnyxAssistantTestRun> {
  return transport.request(`/ai/assistants/tests/${testId}/runs/${runId}`);
}
