"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AssistantTemplate,
  AssistantTemplatePicker,
  TelnyxCreateAssistantRequest,
  useAssistantCreateFlow,
} from "@tinadmin/telnyx-ai-platform";
import { assistantsApi } from "../../telnyxApis";

const defaultInstructions =
  "You are an intelligent and concise voice assistant. This is a {{telnyx_conversation_channel}} happening on {{telnyx_current_time}}. The agent is at {{telnyx_agent_target}} and the user is at {{telnyx_end_user_target}}.";

const templates: AssistantTemplate[] = [
  {
    id: "default",
    title: "Default Assistant",
    description: "A general assistant template with basic configuration.",
    defaults: {
      name: "Default Assistant",
      model: "openai/gpt-4o",
      instructions: defaultInstructions,
      greeting: "Hi there! How can I help you today?",
    },
  },
  {
    id: "customer-support",
    title: "Customer Support Specialist",
    description: "Resolve product issues and answer customer questions.",
    defaults: {
      name: "Customer Support Specialist",
      model: "openai/gpt-4o",
      instructions:
        "You are a customer support voice assistant. Be empathetic, concise, and focus on resolving issues quickly.",
      greeting:
        "Hi, this is your support assistant. How can I help you today?",
    },
  },
  {
    id: "appointment",
    title: "Appointment Scheduler",
    description: "Schedule or reschedule appointments efficiently.",
    defaults: {
      name: "Appointment Scheduler",
      model: "openai/gpt-4o",
      instructions:
        "You help users book and reschedule appointments. Ask for preferred times and confirm details.",
      greeting:
        "Hello! I can help schedule your appointment. What time works best?",
    },
  },
];

export default function CreateAssistantPage() {
  const router = useRouter();
  const { create, isCreating, error } = useAssistantCreateFlow(assistantsApi);

  const handleSelect = async (template: AssistantTemplate) => {
    const payload: TelnyxCreateAssistantRequest = template.defaults;
    const created = await create(payload);
    if (created?.id) {
      router.push(`/ai/assistants/${created.id}`);
    }
  };

  const helpers = useMemo(
    () => ({
      isCreating,
      error,
    }),
    [isCreating, error]
  );

  return (
    <div className="space-y-4">
      <AssistantTemplatePicker
        templates={templates}
        onSelect={handleSelect}
        onCancel={() => router.push("/ai/assistants")}
      />
      {helpers.error && (
        <p className="text-sm text-red-600">{helpers.error}</p>
      )}
      {helpers.isCreating && (
        <p className="text-sm text-gray-500">Creating assistant...</p>
      )}
    </div>
  );
}
