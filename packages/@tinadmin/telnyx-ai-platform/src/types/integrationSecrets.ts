export interface TelnyxIntegrationSecret {
  id?: string;
  identifier: string;
  created_at?: string;
  updated_at?: string;
  description?: string | null;
}

export interface TelnyxIntegrationSecretListResponse {
  data: TelnyxIntegrationSecret[];
}

export interface TelnyxCreateIntegrationSecretRequest {
  identifier: string;
  secret_value: string;
  description?: string | null;
}
