import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TelnyxCreateIntegrationSecretRequest,
  TelnyxIntegrationSecret,
  TelnyxIntegrationSecretListResponse,
} from "../types/integrationSecrets";

export interface TelnyxIntegrationSecretsApi {
  listIntegrationSecrets: () => Promise<TelnyxIntegrationSecretListResponse>;
  createIntegrationSecret: (
    payload: TelnyxCreateIntegrationSecretRequest
  ) => Promise<TelnyxIntegrationSecret>;
}

export function useIntegrationSecrets(api: TelnyxIntegrationSecretsApi) {
  const [data, setData] = useState<TelnyxIntegrationSecret[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.listIntegrationSecrets();
      setData(response.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load secrets");
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (payload: TelnyxCreateIntegrationSecretRequest) => {
      setIsSaving(true);
      setError(null);
      try {
        const secret = await api.createIntegrationSecret(payload);
        setData((prev) => [secret, ...prev]);
        return secret;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create secret");
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
      isLoading,
      isSaving,
      error,
      refresh: load,
      create,
    }),
    [data, isLoading, isSaving, error, load, create]
  );
}
