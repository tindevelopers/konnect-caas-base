"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Alert from "@/components/ui/alert/Alert";
import { useModal } from "@/hooks/useModal";
import { CallIcon, CopyIcon, PencilIcon } from "@/icons";
import {
  callAssistantAction,
  cloneAssistantAction,
  getCallInstructionsAction,
  hangUpCallAction,
  testCallAssistantAction,
} from "@/app/actions/telnyx/assistants";
import CallStatusModal from "./CallStatusModal";
import AudioStreamPlayer from "./AudioStreamPlayer";

interface AssistantActionsProps {
  assistantId: string;
}

interface CallInstructions {
  assistantId: string;
  webhookUrl: string;
  tenantHeader: string;
  tenantQueryParam: string;
  steps: string[];
}

interface CallResult {
  callControlId: string;
  conversationId?: string | null;
}

const inputClasses =
  "dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30";

export default function AssistantActions({ assistantId }: AssistantActionsProps) {
  const router = useRouter();
  const callModal = useModal();
  const receiveModal = useModal();
  const cloneModal = useModal();

  const [banner, setBanner] = useState<{
    variant: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [callForm, setCallForm] = useState({
    toNumber: "",
    fromNumber: "",
    connectionId: "",
    streamUrl: "", // Optional WebSocket URL for audio streaming
  });
  const [callResult, setCallResult] = useState<CallResult | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);

  const [instructions, setInstructions] = useState<CallInstructions | null>(null);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);
  const [isLoadingInstructions, setIsLoadingInstructions] = useState(false);
  const [isLoadingStreamUrl, setIsLoadingStreamUrl] = useState(false);

  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [isHangingUp, setIsHangingUp] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    testId: string;
    runId: string;
    conversationId?: string | null;
    status: string;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const openCallModal = useCallback(async () => {
    setCallError(null);
    setCallResult(null);
    
    // Auto-populate WebSocket stream URL
    // Priority: Production URL (Railway) > ngrok > localhost
    // This ensures we test against production infrastructure even locally
    if (!callForm.streamUrl) {
      setIsLoadingStreamUrl(true);
      try {
        // PRIORITY 1: Get production/remote WebSocket URL (Railway)
        // This is always preferred, even in local development, to test production infrastructure
        const response = await fetch("/api/websocket/stream-url");
        if (response.ok) {
          const data = await response.json();
          if (data.streamUrl) {
            console.log("[TELEMETRY] AssistantActions - Using stream URL", {
              timestamp: new Date().toISOString(),
              source: data.source,
              streamUrlPreview: data.streamUrl.substring(0, 100) + (data.streamUrl.length > 100 ? '...' : ''),
            });
            
            // If production URL is available, use it (even in local dev)
            if (data.source === "production") {
              setCallForm((prev) => ({ ...prev, streamUrl: data.streamUrl }));
              setIsLoadingStreamUrl(false);
              callModal.openModal();
              return;
            }
            
            // PRIORITY 2: If not production, try ngrok for local development
            const ngrokResponse = await fetch("/api/websocket/ngrok-url").catch(() => null);
            if (ngrokResponse?.ok) {
              const ngrokData = await ngrokResponse.json();
              if (ngrokData.available && ngrokData.websocketUrl) {
                console.log("[TELEMETRY] AssistantActions - Using ngrok URL", {
                  timestamp: new Date().toISOString(),
                  ngrokUrl: ngrokData.websocketUrl.substring(0, 100),
                });
                setCallForm((prev) => ({ ...prev, streamUrl: ngrokData.websocketUrl }));
                setIsLoadingStreamUrl(false);
                callModal.openModal();
                return;
              }
            }
            
            // PRIORITY 3: Fallback to localhost (won't work for Telnyx, but useful for testing UI)
            setCallForm((prev) => ({ ...prev, streamUrl: data.streamUrl }));
          }
        }
      } catch (error) {
        console.error("[TELEMETRY] AssistantActions - Failed to get stream URL", {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsLoadingStreamUrl(false);
      }
    }
    
    callModal.openModal();
  }, [callModal, callForm.streamUrl]);

  const openReceiveModal = useCallback(async () => {
    receiveModal.openModal();
    setInstructions(null);
    setInstructionsError(null);
    setIsLoadingInstructions(true);
    try {
      const data = await getCallInstructionsAction(assistantId);
      setInstructions(data);
    } catch (error) {
      setInstructionsError(
        error instanceof Error ? error.message : "Failed to load call setup instructions."
      );
    } finally {
      setIsLoadingInstructions(false);
    }
  }, [assistantId, receiveModal]);

  const handleCall = useCallback(async () => {
    setIsCalling(true);
    setCallError(null);
    setCallResult(null);
    try {
      const result = await callAssistantAction({
        assistantId,
        toNumber: callForm.toNumber,
        fromNumber: callForm.fromNumber,
        connectionId: callForm.connectionId,
        streamUrl: callForm.streamUrl || undefined,
        streamTrack: "both_tracks",
      });
      setCallResult(result);
      setBanner({
        variant: "success",
        title: "Call started",
        message: `Call control ID: ${result.callControlId}${
          result.conversationId ? ` · Conversation: ${result.conversationId}` : ""
        }`,
      });
      // Close the call modal and show call status modal
      callModal.closeModal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start the assistant call.";
      setCallError(message);
      setBanner({
        variant: "error",
        title: "Call failed",
        message,
      });
    } finally {
      setIsCalling(false);
    }
  }, [assistantId, callForm, callModal]);

  const handleClone = useCallback(async () => {
    setIsCloning(true);
    setCloneError(null);
    try {
      const result = await cloneAssistantAction(assistantId);
      setBanner({
        variant: "success",
        title: "Assistant cloned",
        message: `Created new assistant ${result.id}. Opening editor...`,
      });
      cloneModal.closeModal();
      router.push(`/ai/assistants/${result.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to clone assistant.";
      setCloneError(message);
      setBanner({
        variant: "error",
        title: "Clone failed",
        message,
      });
    } finally {
      setIsCloning(false);
    }
  }, [assistantId, cloneModal, router]);

  const handleTestCall = useCallback(async () => {
    setIsTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const result = await testCallAssistantAction(assistantId);
      setTestResult(result);
      setBanner({
        variant: "success",
        title: "Test call started",
        message: `Test run ${result.runId} initiated. This simulates a call without dialing a real number.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start test call.";
      setTestError(message);
      setBanner({
        variant: "error",
        title: "Test call failed",
        message,
      });
    } finally {
      setIsTesting(false);
    }
  }, [assistantId]);

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Test Assistant
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Call, receive calls, edit, or clone this assistant.
          </p>
        </div>
      </div>

      {banner && (
        <div className="mt-4">
          <Alert variant={banner.variant} title={banner.title} message={banner.message} />
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Button
          startIcon={<CallIcon className="h-4 w-4" />}
          onClick={openCallModal}
        >
          Call Assistant
        </Button>
        <Button
          variant="outline"
          startIcon={<CallIcon className="h-4 w-4" />}
          onClick={handleTestCall}
          disabled={isTesting}
        >
          {isTesting ? "Testing..." : "Test Call"}
        </Button>
        <Button
          variant="outline"
          startIcon={<CallIcon className="h-4 w-4" />}
          onClick={openReceiveModal}
        >
          Receive Call
        </Button>
        <Button
          variant="outline"
          startIcon={<PencilIcon className="h-4 w-4" />}
          onClick={() => router.push(`/ai/assistants/${assistantId}`)}
        >
          Edit Assistant
        </Button>
        <Button
          variant="outline"
          startIcon={<CopyIcon className="h-4 w-4" />}
          onClick={cloneModal.openModal}
        >
          Clone Assistant
        </Button>
      </div>

      <Modal
        isOpen={callModal.isOpen}
        onClose={callModal.closeModal}
        className="relative w-full max-w-[560px] m-5 sm:m-0 rounded-3xl bg-white p-6 lg:p-8 dark:bg-gray-900"
      >
        <div>
          <h4 className="text-title-xs mb-2 font-semibold text-gray-800 dark:text-white/90">
            Call this assistant
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Provide a destination number and Call Control settings to start an outbound call.
            <br />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              💡 Tip: Use "Test Call" button for internal testing without dialing a real number.
            </span>
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Destination (To)
              </label>
              <input
                type="text"
                placeholder="+15551234567"
                className={inputClasses}
                value={callForm.toNumber}
                onChange={(event) =>
                  setCallForm((prev) => ({ ...prev, toNumber: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Caller ID (From)
              </label>
              <input
                type="text"
                placeholder="+15550001111"
                className={inputClasses}
                value={callForm.fromNumber}
                onChange={(event) =>
                  setCallForm((prev) => ({ ...prev, fromNumber: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Call Control Connection ID
              </label>
              <input
                type="text"
                placeholder="Call Control App ID"
                className={inputClasses}
                value={callForm.connectionId}
                onChange={(event) =>
                  setCallForm((prev) => ({ ...prev, connectionId: event.target.value }))
                }
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Find this in Telnyx Mission Control → Voice → Call Control Apps.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                WebSocket Stream URL {isLoadingStreamUrl && "(Loading...)"}
              </label>
              <input
                type="text"
                placeholder="Auto-populated..."
                className={inputClasses}
                value={callForm.streamUrl}
                onChange={(event) =>
                  setCallForm((prev) => ({ ...prev, streamUrl: event.target.value }))
                }
                disabled={isLoadingStreamUrl}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                WebSocket URL for real-time audio streaming. Auto-populated based on your environment.
                {callForm.streamUrl && callForm.streamUrl.includes("localhost") && (
                  <span className="block mt-1 text-amber-600 dark:text-amber-400">
                    ⚠️ <strong>Important:</strong> Telnyx cannot connect to localhost.
                    <br />
                    <strong>For local development:</strong> Use ngrok (see NGROK_QUICK_START.md)
                    <br />
                    <strong>For production:</strong> Set WEBSOCKET_URL environment variable in Vercel
                    <br />
                    pointing to a separate WebSocket server (Railway, Render, Fly.io)
                  </span>
                )}
                {callForm.streamUrl && callForm.streamUrl.includes("ngrok") && (
                  <span className="block mt-1 text-green-600 dark:text-green-400">
                    ✅ Using ngrok tunnel - Telnyx will be able to connect!
                  </span>
                )}
                {callForm.streamUrl && (callForm.streamUrl.includes("vercel.app") || callForm.streamUrl.includes("railway.app") || callForm.streamUrl.includes("render.com") || callForm.streamUrl.includes("fly.dev")) && !callForm.streamUrl.includes("ngrok") && (
                  <span className="block mt-1 text-blue-600 dark:text-blue-400">
                    ℹ️ Using production WebSocket server - Make sure WEBSOCKET_URL is set in Vercel
                  </span>
                )}
              </p>
            </div>
          </div>

          {callError && (
            <p className="mt-4 text-sm text-error-500">{callError}</p>
          )}

          {callResult && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-300">
              <p className="font-medium text-gray-800 dark:text-white/90">Call started</p>
              <p>Call control ID: {callResult.callControlId}</p>
              {callResult.conversationId && (
                <p>Conversation ID: {callResult.conversationId}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row w-full items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={callModal.closeModal}
              className="w-full"
              disabled={isCalling}
            >
              Close
            </Button>
            <Button className="w-full" onClick={handleCall} disabled={isCalling}>
              {isCalling ? "Calling..." : "Start Call"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={receiveModal.isOpen}
        onClose={receiveModal.closeModal}
        className="relative w-full max-w-[620px] m-5 sm:m-0 rounded-3xl bg-white p-6 lg:p-8 dark:bg-gray-900"
      >
        <div>
          <h4 className="text-title-xs mb-2 font-semibold text-gray-800 dark:text-white/90">
            Receive inbound calls
          </h4>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            Configure your Telnyx Call Control app to route inbound calls to this assistant.
          </p>

          {isLoadingInstructions && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading instructions...
            </p>
          )}

          {instructionsError && (
            <p className="text-sm text-error-500">{instructionsError}</p>
          )}

          {instructions && (
            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <div>
                <p className="mb-1 font-medium text-gray-800 dark:text-white/90">
                  Webhook URL
                </p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs dark:border-gray-800 dark:bg-gray-900/60">
                  {instructions.webhookUrl}
                </div>
              </div>
              <div>
                <p className="mb-1 font-medium text-gray-800 dark:text-white/90">
                  Assistant ID
                </p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs dark:border-gray-800 dark:bg-gray-900/60">
                  {instructions.assistantId}
                </div>
              </div>
              <div>
                <p className="mb-1 font-medium text-gray-800 dark:text-white/90">
                  Tenant context
                </p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs dark:border-gray-800 dark:bg-gray-900/60">
                  Header: {instructions.tenantHeader} • Query: {instructions.tenantQueryParam}
                </div>
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-gray-600 dark:text-gray-300">
                {instructions.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-6 flex w-full">
            <Button variant="outline" className="w-full" onClick={receiveModal.closeModal}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={cloneModal.isOpen}
        onClose={cloneModal.closeModal}
        className="relative w-full max-w-[520px] m-5 sm:m-0 rounded-3xl bg-white p-6 lg:p-8 dark:bg-gray-900"
      >
        <div>
          <h4 className="text-title-xs mb-2 font-semibold text-gray-800 dark:text-white/90">
            Clone assistant
          </h4>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            This will duplicate the assistant configuration and open the new copy.
          </p>

          {cloneError && <p className="text-sm text-error-500">{cloneError}</p>}

          <div className="mt-6 flex flex-col sm:flex-row w-full items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={cloneModal.closeModal}
              className="w-full"
              disabled={isCloning}
            >
              Cancel
            </Button>
            <Button className="w-full" onClick={handleClone} disabled={isCloning}>
              {isCloning ? "Cloning..." : "Clone Assistant"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Test Result Display */}
      {testResult && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <p className="font-medium text-green-800 dark:text-green-200">Test Call Started</p>
          <div className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-300">
            <p>Test ID: <span className="font-mono">{testResult.testId}</span></p>
            <p>Run ID: <span className="font-mono">{testResult.runId}</span></p>
            {testResult.conversationId && (
              <p>Conversation ID: <span className="font-mono">{testResult.conversationId}</span></p>
            )}
            <p>Status: <span className="font-medium">{testResult.status}</span></p>
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              This test simulates a call without dialing a real number. Check the test results at{" "}
              <button
                onClick={() => router.push(`/ai/tests`)}
                className="underline hover:text-green-800 dark:hover:text-green-200"
              >
                /ai/tests
              </button>
            </p>
          </div>
        </div>
      )}

      {testError && (
        <div className="mt-4">
          <Alert variant="error" title="Test Call Failed" message={testError} />
        </div>
      )}

      {/* Call Status Modal */}
      {callResult && (
        <CallStatusModal
          isOpen={!!callResult}
          onClose={() => setCallResult(null)}
          callControlId={callResult.callControlId}
          conversationId={callResult.conversationId}
          streamUrl={callForm.streamUrl || undefined}
          onHangUp={async () => {
            if (!callResult) return;
            setIsHangingUp(true);
            try {
              await hangUpCallAction(callResult.callControlId);
              setCallResult(null);
              setBanner({
                variant: "success",
                title: "Call ended",
                message: "The call has been terminated.",
              });
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Failed to hang up call.";
              setBanner({
                variant: "error",
                title: "Hang up failed",
                message,
              });
            } finally {
              setIsHangingUp(false);
            }
          }}
          isHangingUp={isHangingUp}
        />
      )}
    </div>
  );
}
