"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  AssistantEditor,
  McpServerDescriptor,
  TelnyxModelMetadata,
} from "@tinadmin/telnyx-ai-platform";
import { assistantsApi } from "../../telnyxApis";
import { listMcpServersAction } from "@/app/actions/telnyx/mcpServers";
import { listModelsAction } from "@/app/actions/telnyx/models";
import AssistantActions from "@/components/ai/AssistantActions";

export default function AssistantEditorPage() {
  const router = useRouter();
  const params = useParams();
  const assistantId = params?.assistantId as string;
  const [mcpServers, setMcpServers] = useState<McpServerDescriptor[]>([]);
  const [models, setModels] = useState<TelnyxModelMetadata[]>([]);

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

  return (
    <>
      <AssistantEditor
        api={assistantsApi}
        assistantId={assistantId}
        mcpServers={mcpServers}
        models={models}
        onBack={() => router.push("/ai/assistants")}
      />
      <AssistantActions assistantId={assistantId} />
    </>
  );
}
