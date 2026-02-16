import type {
  TelnyxAssistant,
  TelnyxAssistantListResponse,
  TelnyxCloneAssistantResponse,
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

/** Result of listAssistants: either data or an error message (avoids Next.js masking thrown errors in prod). */
export type ListAssistantsResult = TelnyxAssistantListResponse | { error: string };

/** Server-safe API interface for assistants (used by server actions and api layer). */
export interface TelnyxAssistantsApi {
  listAssistants: () => Promise<ListAssistantsResult>;
  getAssistant: (assistantId: string) => Promise<TelnyxAssistant>;
  createAssistant: (payload: TelnyxCreateAssistantRequest) => Promise<TelnyxAssistant>;
  updateAssistant: (
    assistantId: string,
    payload: TelnyxUpdateAssistantRequest
  ) => Promise<TelnyxAssistant>;
  cloneAssistant: (assistantId: string) => Promise<TelnyxCloneAssistantResponse>;
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
