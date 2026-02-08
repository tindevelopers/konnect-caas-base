"use server";

import { getTelnyxTransport } from "./client";
import { trackApiCall } from "@/src/core/telemetry";
import { getTelemetryContext } from "./assistants";

const TELNYX_PROVIDER = "telnyx";

/**
 * Get WebRTC credentials for making webcalls
 * Returns SIP connection credentials or generates a token
 */
export async function getWebRTCCredentialsAction(): Promise<{
  login?: string;
  password?: string;
  login_token?: string;
  error?: string;
}> {
  const { tenantId, userId } = await getTelemetryContext();

  return trackApiCall(
    "getWebRTCCredentials",
    TELNYX_PROVIDER,
    async () => {
      try {
        const transport = await getTelnyxTransport("integrations.read");

        // Try to get SIP connections
        // Note: This requires appropriate Telnyx API permissions
        try {
          const connectionsResponse = await transport.request("/sip_connections", {
            method: "GET",
          });

          const connections = Array.isArray(connectionsResponse.data)
            ? connectionsResponse.data
            : connectionsResponse.data?.data || [];

          // Find the first active SIP connection
          const activeConnection = connections.find(
            (conn: any) => conn.connection_name && conn.active
          );

          if (activeConnection) {
            console.log("[TELEMETRY] getWebRTCCredentials - Found SIP connection", {
              timestamp: new Date().toISOString(),
              connectionId: activeConnection.id,
            });

            return {
              login: activeConnection.sip_username || activeConnection.username,
              password: activeConnection.password,
            };
          }
        } catch (sipError) {
          console.warn("[TELEMETRY] getWebRTCCredentials - Could not fetch SIP connections", {
            timestamp: new Date().toISOString(),
            error: sipError instanceof Error ? sipError.message : String(sipError),
          });
        }

        // Fallback: For webcalls, Telnyx might allow using API key-based auth
        // Or we can generate a token. For now, return an error asking for SIP connection
        return {
          error:
            "SIP connection not found. Please configure a SIP connection in Telnyx Mission Control for WebRTC webcalls.",
        };
      } catch (error) {
        console.error("[TELEMETRY] getWebRTCCredentials - Error", {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof Error) {
          return { error: error.message };
        }
        return { error: "Failed to get WebRTC credentials" };
      }
    },
    {
      tenantId,
      userId,
    }
  );
}
