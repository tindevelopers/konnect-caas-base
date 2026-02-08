import {
  listAssistantsAction,
  getAssistantAction,
  createAssistantAction,
  updateAssistantAction,
  cloneAssistantAction,
  deleteAssistantAction,
  importAssistantsAction,
} from "@/app/actions/telnyx/assistants";
import {
  listAssistantTestsAction,
  createAssistantTestAction,
  triggerAssistantTestRunAction,
} from "@/app/actions/telnyx/tests";
import {
  listIntegrationSecretsAction,
  createIntegrationSecretAction,
} from "@/app/actions/telnyx/secrets";
import {
  TelnyxAssistantsApi,
  TelnyxAssistantTestsApi,
  TelnyxIntegrationSecretsApi,
} from "@tinadmin/telnyx-ai-platform";

export const assistantsApi: TelnyxAssistantsApi = {
  listAssistants: listAssistantsAction,
  getAssistant: getAssistantAction,
  createAssistant: createAssistantAction,
  updateAssistant: updateAssistantAction,
  cloneAssistant: cloneAssistantAction,
  deleteAssistant: deleteAssistantAction,
  importAssistants: importAssistantsAction,
};

export const assistantTestsApi: TelnyxAssistantTestsApi = {
  listAssistantTests: listAssistantTestsAction,
  createAssistantTest: createAssistantTestAction,
  triggerAssistantTestRun: triggerAssistantTestRunAction,
};

export const integrationSecretsApi: TelnyxIntegrationSecretsApi = {
  listIntegrationSecrets: listIntegrationSecretsAction,
  createIntegrationSecret: createIntegrationSecretAction,
};
