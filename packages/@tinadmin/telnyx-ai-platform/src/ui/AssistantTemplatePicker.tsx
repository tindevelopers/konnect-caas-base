import React from "react";
import { TelnyxCreateAssistantRequest } from "../types/assistants";

export interface AssistantTemplate {
  id: string;
  title: string;
  description: string;
  features?: string[];
  defaults: TelnyxCreateAssistantRequest;
}

export interface AssistantTemplatePickerProps {
  templates: AssistantTemplate[];
  onSelect: (template: AssistantTemplate) => void;
  onCancel?: () => void;
}

export function AssistantTemplatePicker({
  templates,
  onSelect,
  onCancel,
}: AssistantTemplatePickerProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Create a new AI Assistant
        </h2>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-indigo-400 hover:shadow-sm dark:border-gray-700 dark:hover:border-indigo-500"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {template.title}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {template.description}
            </p>
            {template.features && template.features.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {template.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
