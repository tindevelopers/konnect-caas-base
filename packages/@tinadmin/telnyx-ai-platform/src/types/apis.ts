import type {
  TelnyxAssistant,
  TelnyxAssistantListResponse,
  TelnyxCreateAssistantRequest,
  TelnyxImportAssistantsRequest,
  TelnyxImportAssistantsResponse,
  TelnyxUpdateAssistantRequest,
} from "./assistants";
import type {
  TelnyxAssistantTest,
  TelnyxAssistantTestListResponse,
  TelnyxCreateAssistantTestRequest,
  TelnyxAssistantTestRun,
  TelnyxTriggerTestRunRequest,
} from "./tests";
import type {
  TelnyxCreateIntegrationSecretRequest,
  TelnyxIntegrationSecret,
  TelnyxIntegrationSecretListResponse,
} from "./integrationSecrets";

/** Server-safe API interface for assistants (used by server actions and api layer). */
export interface TelnyxAssistantsApi {
  listAssistants: () => Promise<TelnyxAssistantListResponse>;
  getAssistant: (assistantId: string) => Promise<TelnyxAssistant>;
  createAssistant: (payload: TelnyxCreateAssistantRequest) => Promise<TelnyxAssistant>;
  updateAssistant: (
    assistantId: string,
    payload: TelnyxUpdateAssistantRequest
  ) => Promise<TelnyxAssistant>;
  deleteAssistant: (assistantId: string) => Promise<void>;
  importAssistants: (
    payload: TelnyxImportAssistantsRequest
  ) => Promise<TelnyxImportAssistantsResponse>;
}

/** Server-safe API interface for assistant tests. */
export interface TelnyxAssistantTestsApi {
  listAssistantTests: (
    query?: Record<string, string | number | boolean | undefined>
  ) => Promise<TelnyxAssistantTestListResponse>;
  createAssistantTest: (
    payload: TelnyxCreateAssistantTestRequest
  ) => Promise<TelnyxAssistantTest>;
  triggerAssistantTestRun: (
    testId: string,
    payload?: TelnyxTriggerTestRunRequest
  ) => Promise<TelnyxAssistantTestRun>;
}

/** Server-safe API interface for integration secrets. */
export interface TelnyxIntegrationSecretsApi {
  listIntegrationSecrets: () => Promise<TelnyxIntegrationSecretListResponse>;
  createIntegrationSecret: (
    payload: TelnyxCreateIntegrationSecretRequest
  ) => Promise<TelnyxIntegrationSecret>;
}
