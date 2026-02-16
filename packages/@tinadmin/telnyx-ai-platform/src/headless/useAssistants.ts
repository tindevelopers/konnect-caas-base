import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TelnyxAssistant,
  TelnyxAssistantListResponse,
  TelnyxCreateAssistantRequest,
  TelnyxImportAssistantsRequest,
  TelnyxImportAssistantsResponse,
  TelnyxUpdateAssistantRequest,
} from "../types/assistants";
import type { TelnyxAssistantsApi } from "../types/apis";

export type { TelnyxAssistantsApi };

export function useAssistantsList(api: TelnyxAssistantsApi) {
  const [data, setData] = useState<TelnyxAssistant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.listAssistants();
      setData(response.data ?? []);
    } catch (err) {
      let errorMessage = "Failed to load assistants";
      // Next.js strips error.message in production; digest is left intact, so prefer it for display
      const digest = err && typeof err === "object" && "digest" in err ? (err as { digest?: string }).digest : undefined;
      if (digest && typeof digest === "string") {
        errorMessage = digest;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (err && typeof err === "object" && "message" in err) {
        errorMessage = String((err as { message: unknown }).message);
      }
      console.error("[useAssistantsList] Error loading assistants:", err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      refresh: load,
    }),
    [data, isLoading, error, load]
  );
}

export function useAssistantEditor(api: TelnyxAssistantsApi, assistantId: string) {
  const [assistant, setAssistant] = useState<TelnyxAssistant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getAssistant(assistantId);
      setAssistant(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assistant");
    } finally {
      setIsLoading(false);
    }
  }, [api, assistantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (payload?: TelnyxUpdateAssistantRequest) => {
      if (!assistant) return null;
      setIsSaving(true);
      setError(null);
      try {
        const updated = await api.updateAssistant(assistantId, payload ?? assistant);
        setAssistant(updated);
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save assistant");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [api, assistant, assistantId]
  );

  return useMemo(
    () => ({
      assistant,
      setAssistant,
      isLoading,
      isSaving,
      error,
      refresh: load,
      save,
    }),
    [assistant, isLoading, isSaving, error, load, save]
  );
}

export function useAssistantCreateFlow(api: TelnyxAssistantsApi) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (payload: TelnyxCreateAssistantRequest) => {
      setIsCreating(true);
      setError(null);
      try {
        return await api.createAssistant(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create assistant");
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [api]
  );

  const importFromProvider = useCallback(
    async (payload: TelnyxImportAssistantsRequest) => {
      setIsCreating(true);
      setError(null);
      try {
        return await api.importAssistants(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to import assistants");
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [api]
  );

  return useMemo(
    () => ({
      isCreating,
      error,
      create,
      importFromProvider,
    }),
    [isCreating, error, create, importFromProvider]
  );
}
