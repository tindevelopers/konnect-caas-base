"use client";

import React, { useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import TextArea from "@/components/form/input/TextArea";

const steps = [
  { id: "audience", label: "Audience" },
  { id: "message", label: "Message" },
  { id: "schedule", label: "Schedule" },
];

const audienceOptions = [
  { value: "crm-all", label: "CRM: All Contacts" },
  { value: "crm-high-value", label: "CRM: High value" },
  { value: "crm-demo", label: "CRM: Demo attendees" },
  { value: "custom", label: "Custom list (API/CSV)" },
];

const channelOptions = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "call", label: "Call" },
];

const builderTemplates = [
  { name: "Welcome Sequence", description: "CRM + Telnyx call + SMS checkpoint" },
  { name: "Product Launch", description: "Multi-channel nurture with AI assistant" },
];

export default function CampaignBuilder() {
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState({
    audience: audienceOptions[0].value,
    channel: "email",
    template: builderTemplates[0].name,
    subject: "",
    body: "",
    schedule: "",
  });

  const estimatedReach = useMemo(() => {
    if (form.audience === "crm-high-value") return "2,300 contacts";
    if (form.audience === "crm-demo") return "1,120 contacts";
    if (form.audience === "custom") return "Upload required";
    return "8,400 contacts";
  }, [form.audience]);

  const renderStepBody = () => {
    switch (steps[currentStep].id) {
      case "audience":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="builder-audience">Audience</Label>
              <Select
                id="builder-audience"
                options={audienceOptions}
                value={form.audience}
                onChange={(value) => setForm({ ...form, audience: value })}
              />
            </div>
            <div>
              <Label htmlFor="builder-template">Template</Label>
              <Select
                id="builder-template"
                options={builderTemplates.map((template) => ({
                  value: template.name,
                  label: template.name,
                }))}
                value={form.template}
                onChange={(value) => setForm({ ...form, template: value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Estimated Reach</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">{estimatedReach}</p>
            </div>
          </div>
        );
      case "message":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="builder-channel">Channel</Label>
              <Select
                id="builder-channel"
                options={channelOptions}
                value={form.channel}
                onChange={(value) => setForm({ ...form, channel: value })}
              />
            </div>
            <div>
              <Label htmlFor="builder-subject">Subject</Label>
              <Input
                id="builder-subject"
                placeholder="Choose a hook for CRM recipients"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="builder-body">Message</Label>
              <TextArea
                id="builder-body"
                rows={4}
                placeholder="Use the AI agent to craft a responsive script"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="builder-schedule">Schedule</Label>
              <Input
                id="builder-schedule"
                type="datetime-local"
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The Telnyx dialer will respect the selected send time when calling or sending SMS after the CRM campaign touches.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
            Campaign Builder
          </p>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Map Campaigns from CRM → Dialer</h2>
        </div>
        <Button size="sm" variant="outline">
          Save Template
        </Button>
      </div>
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={`rounded-full border px-4 py-1 text-sm ${
                currentStep === index
                  ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:border-brand-400 dark:text-brand-300"
                  : "border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
              }`}
            >
              {index + 1}. {step.label}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-white/5">
          {renderStepBody()}
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Auto-save enabled. Campaign will push through CRM records before Telnyx or AI agents are invoked.
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          >
            Back
          </Button>
          <Button size="sm" onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}>
            {currentStep === steps.length - 1 ? "Launch Campaign" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
