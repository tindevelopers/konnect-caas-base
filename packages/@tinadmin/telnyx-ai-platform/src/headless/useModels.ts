import { useCallback, useEffect, useMemo, useState } from "react";
import { TelnyxModelMetadata, TelnyxModelsResponse } from "../types/assistants";

export interface TelnyxModelsApi {
  listModels: () => Promise<TelnyxModelsResponse>;
}

export function useTelnyxModels(api: TelnyxModelsApi) {
  const [data, setData] = useState<TelnyxModelMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.listModels();
      setData(response.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
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
