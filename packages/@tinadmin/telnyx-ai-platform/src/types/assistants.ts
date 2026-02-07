export type TelnyxAssistantTool =
  | Record<string, unknown>;

export interface TelnyxAssistant {
  id: string;
  name: string;
  created_at: string;
  model: string;
  instructions: string;
  description?: string;
  tools?: TelnyxAssistantTool[];
  greeting?: string;
  llm_api_key_ref?: string;
  voice_settings?: Record<string, unknown>;
  transcription?: Record<string, unknown>;
  telephony_settings?: Record<string, unknown>;
  messaging_settings?: Record<string, unknown>;
  enabled_features?: string[];
  insight_settings?: Record<string, unknown>;
  privacy_settings?: Record<string, unknown>;
  dynamic_variables_webhook_url?: string;
  dynamic_variables?: Record<string, unknown>;
  widget_settings?: Record<string, unknown>;
  import_metadata?: Record<string, unknown>;
}

export interface TelnyxAssistantListResponse {
  data: TelnyxAssistant[];
}

export interface TelnyxCloneAssistantResponse {
  id: string;
}

export interface TelnyxModelMetadata {
  id: string;
  object?: string;
  created: number;
  owned_by: string;
}

export interface TelnyxModelsResponse {
  object?: string;
  data: TelnyxModelMetadata[];
}

export interface TelnyxCreateAssistantRequest {
  name: string;
  model: string;
  instructions: string;
  description?: string;
  tools?: TelnyxAssistantTool[];
  greeting?: string;
  llm_api_key_ref?: string;
  voice_settings?: Record<string, unknown>;
  transcription?: Record<string, unknown>;
  telephony_settings?: Record<string, unknown>;
  messaging_settings?: Record<string, unknown>;
  enabled_features?: string[];
  insight_settings?: Record<string, unknown>;
  privacy_settings?: Record<string, unknown>;
  dynamic_variables_webhook_url?: string;
  dynamic_variables?: Record<string, unknown>;
  widget_settings?: Record<string, unknown>;
}

export type TelnyxUpdateAssistantRequest = Partial<TelnyxCreateAssistantRequest>;

export interface TelnyxImportAssistantsRequest {
  provider: string;
  api_key_ref: string;
  import_ids?: string[];
}

export interface TelnyxImportAssistantsResponse {
  data: Record<string, unknown>[];
}
