export interface TelnyxAssistantTest {
  test_id: string;
  name: string;
  telnyx_conversation_channel: string;
  created_at: string;
  description?: string;
  destination?: string;
  max_duration_seconds?: number;
  test_suite?: string;
  instructions?: string;
  rubric?: Array<Record<string, unknown>>;
}

export interface TelnyxAssistantTestListResponse {
  meta?: Record<string, unknown>;
  data: TelnyxAssistantTest[];
}

export interface TelnyxCreateAssistantTestRequest {
  name: string;
  destination: string;
  instructions: string;
  rubric: Array<Record<string, unknown>>;
  description?: string;
  telnyx_conversation_channel?: string;
  max_duration_seconds?: number;
  test_suite?: string;
}

export interface TelnyxAssistantTestRun {
  run_id: string;
  test_id: string;
  status: string;
  triggered_by: string;
  created_at: string;
  completed_at?: string;
  logs?: string;
  conversation_id?: string;
  conversation_insights_id?: string;
  test_suite_run_id?: string;
  updated_at?: string;
  detail_status?: Array<Record<string, unknown>>;
}

export interface TelnyxTriggerTestRunRequest {
  destination_version_id?: string;
}
