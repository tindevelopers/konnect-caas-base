"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  AssistantEditor,
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
import AssistantActions from "@/components/ai/AssistantActions";
import AssistantActionsErrorBoundary from "@/components/ai/AssistantActionsErrorBoundary";

export default function AssistantEditorPage() {
  const router = useRouter();
  const params = useParams();
  const assistantId = params?.assistantId as string;
  const [mcpServers, setMcpServers] = useState<McpServerDescriptor[]>([]);
  const [models, setModels] = useState<TelnyxModelMetadata[]>([]);
  const [integrations, setIntegrations] = useState<TelnyxIntegration[]>([]);

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
        onBack={() => router.push("/ai/assistants")}
      />
      <AssistantActionsErrorBoundary>
        <AssistantActions assistantId={assistantId} />
      </AssistantActionsErrorBoundary>
    </>
  );
}
