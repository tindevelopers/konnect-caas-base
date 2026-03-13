"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  AssistantEditor,
  AssignedNumberRow,
  McpServerDescriptor,
  TelnyxModelMetadata,
  TelnyxIntegration,
} from "@tinadmin/telnyx-ai-platform";
import { assistantsApi } from "../../telnyxApis";
import { listMcpServersAction } from "@/app/actions/telnyx/mcpServers";
import { listModelsAction } from "@/app/actions/telnyx/models";
import { listIntegrationsAction } from "@/app/actions/telnyx/integrations";
import { createIntegrationSecretAction } from "@/app/actions/telnyx/secrets";
import { testAssistantToolAction } from "@/app/actions/telnyx/tools";
import { listPhoneNumbersAssignedToAssistantAction } from "@/app/actions/telnyx/numbers";
import AssistantActions from "@/components/ai/AssistantActions";
import AssistantActionsErrorBoundary from "@/components/ai/AssistantActionsErrorBoundary";

export default function AssistantEditorPage() {
  const router = useRouter();
  const params = useParams();
  const assistantId = params?.assistantId as string;
  const [mcpServers, setMcpServers] = useState<McpServerDescriptor[]>([]);
  const [models, setModels] = useState<TelnyxModelMetadata[]>([]);
  const [integrations, setIntegrations] = useState<TelnyxIntegration[]>([]);
  const [assignedNumbers, setAssignedNumbers] = useState<AssignedNumberRow[]>([]);

  if (!assistantId) {
    return <p className="text-sm text-gray-500">Assistant not found.</p>;
  }

  useEffect(() => {
    async function loadMcpServers() {
      try {
        const data = await listMcpServersAction();
        setMcpServers(data);
      } catch {
        setMcpServers([]);
      }
    }
    void loadMcpServers();
  }, []);

  useEffect(() => {
    async function loadModels() {
      try {
        const response = await listModelsAction();
        setModels(response.data ?? []);
      } catch {
        setModels([]);
      }
    }
    void loadModels();
  }, []);

  useEffect(() => {
    async function loadIntegrations() {
      try {
        const response = await listIntegrationsAction();
        setIntegrations(response.data ?? []);
      } catch {
        setIntegrations([]);
      }
    }
    void loadIntegrations();
  }, []);

  const loadAssignedNumbers = useCallback(async () => {
    if (!assistantId) return;
    try {
      const res = await listPhoneNumbersAssignedToAssistantAction(assistantId);
      setAssignedNumbers(res.data ?? []);
    } catch {
      setAssignedNumbers([]);
    }
  }, [assistantId]);

  useEffect(() => {
    void loadAssignedNumbers();
  }, [loadAssignedNumbers]);

  const onAssignNumbers = useCallback(() => {
    router.push("/rtc/numbers/manage-numbers");
  }, [router]);

  return (
    <>
      <AssistantEditor
        api={assistantsApi}
        assistantId={assistantId}
        mcpServers={mcpServers}
        models={models}
        integrations={integrations}
        createIntegrationSecret={createIntegrationSecretAction}
        testAssistantTool={testAssistantToolAction}
        assignedNumbers={assignedNumbers}
        onAssignNumbers={onAssignNumbers}
        onBack={() => router.push("/ai/assistants")}
      />
      <AssistantActionsErrorBoundary>
        <AssistantActions assistantId={assistantId} />
      </AssistantActionsErrorBoundary>
    </>
  );
}
