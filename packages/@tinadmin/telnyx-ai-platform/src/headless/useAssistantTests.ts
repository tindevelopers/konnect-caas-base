import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TelnyxAssistantTest,
  TelnyxAssistantTestListResponse,
  TelnyxCreateAssistantTestRequest,
  TelnyxAssistantTestRun,
  TelnyxTriggerTestRunRequest,
} from "../types/tests";
import type { TelnyxAssistantTestsApi } from "../types/apis";

export type { TelnyxAssistantTestsApi };

export function useAssistantTests(
  api: TelnyxAssistantTestsApi,
  query?: Record<string, string | number | boolean | undefined>
) {
  const [data, setData] = useState<TelnyxAssistantTest[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.listAssistantTests(query);
      setData(response.data ?? []);
      setMeta(response.meta ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tests");
    } finally {
      setIsLoading(false);
    }
  }, [api, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (payload: TelnyxCreateAssistantTestRequest) => {
      setIsSaving(true);
      setError(null);
      try {
        const test = await api.createAssistantTest(payload);
        setData((prev) => [test, ...prev]);
        return test;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create test");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [api]
  );

  const triggerRun = useCallback(
    async (testId: string, payload?: TelnyxTriggerTestRunRequest) => {
      setIsSaving(true);
      setError(null);
      try {
        return await api.triggerAssistantTestRun(testId, payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to run test");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [api]
  );

  return useMemo(
    () => ({
      data,
      meta,
      isLoading,
      isSaving,
      error,
      refresh: load,
      create,
      triggerRun,
    }),
    [data, meta, isLoading, isSaving, error, load, create, triggerRun]
  );
}
