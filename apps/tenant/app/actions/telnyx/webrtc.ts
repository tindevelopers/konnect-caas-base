"use server";

import { getTelnyxTransport } from "./client";
import { trackApiCall } from "@/src/core/telemetry";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { createClient } from "@/core/database/server";

const TELNYX_PROVIDER = "telnyx";

async function getTelemetryContext() {
  let tenantId: string | null = null;
  let userId: string | null = null;
  
  try {
    tenantId = await ensureTenantId().catch(() => null);
  } catch {
    // Ignore
  }
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
  } catch {
    // Ignore
  }
  
  return { tenantId, userId };
}

/**
 * Get WebRTC credentials for making webcalls
 * Returns SIP connection credentials from API, environment variables, or manual input
 */
export async function getWebRTCCredentialsAction(manualCredentials?: {
  login?: string;
  password?: string;
}): Promise<{
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
      // Priority 1: Use manually provided credentials
      if (manualCredentials?.login && manualCredentials?.password) {
        console.log("[TELEMETRY] getWebRTCCredentials - Using manual credentials", {
          timestamp: new Date().toISOString(),
          hasLogin: !!manualCredentials.login,
        });
        return {
          login: manualCredentials.login,
          password: manualCredentials.password,
        };
      }

      // Priority 2: Check environment variables
      const envLogin = process.env.TELNYX_SIP_USERNAME || process.env.TELNYX_WEBRTC_USERNAME;
      const envPassword = process.env.TELNYX_SIP_PASSWORD || process.env.TELNYX_WEBRTC_PASSWORD;
      
      if (envLogin && envPassword) {
        console.log("[TELEMETRY] getWebRTCCredentials - Using environment variables", {
          timestamp: new Date().toISOString(),
          hasLogin: !!envLogin,
        });
        return {
          login: envLogin,
          password: envPassword,
        };
      }

      // Priority 3: Try to fetch from Telnyx API
      try {
        const transport = await getTelnyxTransport("integrations.read");

        try {
          const connectionsResponse = await transport.request<{
            data?: Array<{
              id?: string;
              connection_name?: string;
              active?: boolean;
              sip_username?: string;
              username?: string;
              password?: string;
            }> | {
              data?: Array<{
                id?: string;
                connection_name?: string;
                active?: boolean;
                sip_username?: string;
                username?: string;
                password?: string;
              }>;
            };
          }>("/sip_connections", {
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
            console.log("[TELEMETRY] getWebRTCCredentials - Found SIP connection via API", {
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
      } catch (error) {
        console.warn("[TELEMETRY] getWebRTCCredentials - API fetch failed", {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // No credentials found
      return {
        error:
            "SIP connection not found. Please configure SIP credentials via:\n" +
            "1. Environment variables (SIP username/password)\n" +
            "2. Or pass credentials manually when starting webcall\n" +
            "3. Or configure a SIP connection in your provider console",
      };
    },
    {
      tenantId,
      userId,
    }
  );
}
