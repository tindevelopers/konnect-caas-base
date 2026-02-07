"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import { PlayIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface TestResult {
  id: string;
  webhook: string;
  event: string;
  timestamp: string;
  status: "success" | "failed";
  responseTime: number;
  statusCode?: number;
  response?: string;
  error?: string;
}

export default function WebhookTestingPage() {
  const [selectedWebhook, setSelectedWebhook] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [testPayload, setTestPayload] = useState(`{
  "id": "evt_test_123",
  "type": "order.created",
  "data": {
    "order_id": "ord_12345",
    "amount": 199.00,
    "currency": "usd"
  }
}`);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const webhooks = [
    { id: "1", name: "Order Created", url: "https://api.example.com/webhooks/orders" },
    { id: "2", name: "Payment Webhook", url: "https://api.example.com/webhooks/payments" },
  ];

  const events = [
    "order.created",
    "order.updated",
    "payment.succeeded",
    "payment.failed",
    "user.created",
  ];

  const handleTest = () => {
    setIsTesting(true);
    // Simulate webhook test
    setTimeout(() => {
      const result: TestResult = {
        id: Date.now().toString(),
        webhook: selectedWebhook,
        event: selectedEvent,
        timestamp: new Date().toISOString(),
        status: Math.random() > 0.3 ? "success" : "failed",
        responseTime: Math.floor(Math.random() * 500) + 50,
        statusCode: Math.random() > 0.3 ? 200 : 500,
        response: Math.random() > 0.3 ? '{"status": "ok"}' : undefined,
        error: Math.random() > 0.7 ? "Connection timeout" : undefined,
      };
      setTestResults([result, ...testResults]);
      setIsTesting(false);
    }, 1500);
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Webhook Testing" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Webhook Testing</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Test webhooks with sample payloads before going live
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Test Configuration */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Test Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="test-webhook">Webhook</Label>
                <select
                  id="test-webhook"
                  value={selectedWebhook}
                  onChange={(e) => setSelectedWebhook(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="">Select webhook</option>
                  {webhooks.map((wh) => (
                    <option key={wh.id} value={wh.name}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="test-event">Event Type</Label>
                <select
                  id="test-event"
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="">Select event</option>
                  {events.map((event) => (
                    <option key={event} value={event}>
                      {event}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="test-payload">Test Payload (JSON)</Label>
                <textarea
                  id="test-payload"
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 font-mono text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                />
              </div>
              <Button
                onClick={handleTest}
                disabled={!selectedWebhook || !selectedEvent || isTesting}
                className="w-full"
              >
                <PlayIcon className="h-4 w-4" />
                {isTesting ? "Testing..." : "Send Test Webhook"}
              </Button>
            </div>
          </div>

          {/* Test Results */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Test Results</h2>
            <div className="space-y-4">
              {testResults.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400">
                  No test results yet. Send a test webhook to see results here.
                </p>
              ) : (
                testResults.map((result) => {
                  const Icon = result.status === "success" ? CheckIcon : XMarkIcon;
                  return (
                    <div
                      key={result.id}
                      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`h-5 w-5 ${
                              result.status === "success"
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {result.webhook}
                          </span>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            result.status === "success"
                              ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500"
                          }`}
                        >
                          {result.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Event:</span>
                          <span className="text-gray-900 dark:text-white">{result.event}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Status Code:</span>
                          <span className="text-gray-900 dark:text-white">
                            {result.statusCode || "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Response Time:</span>
                          <span className="text-gray-900 dark:text-white">{result.responseTime}ms</span>
                        </div>
                        {result.error && (
                          <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-500">
                            {result.error}
                          </div>
                        )}
                        {result.response && (
                          <div className="mt-2 rounded bg-gray-50 p-2 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {result.response}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

