export interface TelnyxIntegration {
  id: string;
  name: string;
  display_name: string;
  description: string;
  logo_url: string;
  status: "connected" | "disconnected";
  available_tools: string[];
}

export interface TelnyxIntegrationsListResponse {
  data: TelnyxIntegration[];
}

