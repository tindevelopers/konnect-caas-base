"use server";

import { createAdminClient } from "@/core/database/admin-client";
import { createClient } from "@/core/database/server";

export interface TelemetryEvent {
  id?: string;
  tenant_id?: string | null;
  user_id?: string | null;
  event_type: string;
  operation: string;
  provider: string;
  status: "success" | "error" | "timeout";
  duration_ms: number;
  request_data?: Record<string, any>;
  response_data?: Record<string, any>;
  error_message?: string;
  error_stack?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

/**
 * Track a telemetry event for testing and debugging
 */
export async function trackTelemetryEvent(event: Omit<TelemetryEvent, "id" | "created_at">): Promise<void> {
  try {
    const adminClient = createAdminClient();
    
    // Get current user if available
    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch {
      // Ignore auth errors
    }

    const telemetryEvent: Omit<TelemetryEvent, "id" | "created_at"> = {
      ...event,
      user_id: event.user_id || userId,
    };

    // Try to insert into telemetry_events table
    try {
      await adminClient.from("telemetry_events").insert(telemetryEvent as any);
    } catch (error: any) {
      // If table doesn't exist, log to console for now
      if (error.code === "42P01") {
        console.log("[Telemetry] Table not found, logging to console:", telemetryEvent);
      } else {
        console.error("[Telemetry] Error logging event:", error);
      }
    }
  } catch (error) {
    // Don't throw - telemetry should not break the application
    console.error("[Telemetry] Failed to log event:", error);
  }
}

/**
 * Track API call with timing and error handling
 */
export async function trackApiCall<T>(
  operation: string,
  provider: string,
  fn: () => Promise<T>,
  options?: {
    tenantId?: string | null;
    userId?: string | null;
    requestData?: Record<string, any>;
    metadata?: Record<string, any>;
  }
): Promise<T> {
  const startTime = Date.now();
  let status: "success" | "error" | "timeout" = "success";
  let responseData: Record<string, any> | undefined;
  let errorMessage: string | undefined;
  let errorStack: string | undefined;

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    // Extract response data (limit size to avoid huge payloads)
    if (result && typeof result === "object") {
      responseData = JSON.parse(JSON.stringify(result, (key, value) => {
        // Remove sensitive data
        if (key.toLowerCase().includes("key") || 
            key.toLowerCase().includes("secret") || 
            key.toLowerCase().includes("token") ||
            key.toLowerCase().includes("password")) {
          return "[REDACTED]";
        }
        return value;
      }));
      
      // Limit response size
      const responseStr = JSON.stringify(responseData);
      if (responseStr.length > 10000) {
        responseData = { truncated: true, size: responseStr.length };
      }
    }

    await trackTelemetryEvent({
      tenant_id: options?.tenantId || null,
      user_id: options?.userId || null,
      event_type: "api_call",
      operation,
      provider,
      status,
      duration_ms: duration,
      request_data: options?.requestData,
      response_data: responseData,
      metadata: {
        ...options?.metadata,
        duration_ms: duration,
      },
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    status = "error";
    errorMessage = error instanceof Error ? error.message : String(error);
    errorStack = error instanceof Error ? error.stack : undefined;

    await trackTelemetryEvent({
      tenant_id: options?.tenantId || null,
      user_id: options?.userId || null,
      event_type: "api_call",
      operation,
      provider,
      status,
      duration_ms: duration,
      request_data: options?.requestData,
      error_message: errorMessage,
      error_stack: errorStack,
      metadata: {
        ...options?.metadata,
        duration_ms: duration,
      },
    });

    throw error;
  }
}

/**
 * Query telemetry events for testing and debugging
 */
export async function getTelemetryEvents(options?: {
  tenantId?: string | null;
  userId?: string;
  eventType?: string;
  operation?: string;
  provider?: string;
  status?: "success" | "error" | "timeout";
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<TelemetryEvent[]> {
  try {
    const adminClient = createAdminClient();
    
    let query = adminClient
      .from("telemetry_events")
      .select("*")
      .order("created_at", { ascending: false });

    if (options?.tenantId !== undefined) {
      if (options.tenantId === null) {
        query = query.is("tenant_id", null);
      } else {
        query = query.eq("tenant_id", options.tenantId);
      }
    }

    if (options?.userId) {
      query = query.eq("user_id", options.userId);
    }

    if (options?.eventType) {
      query = query.eq("event_type", options.eventType);
    }

    if (options?.operation) {
      query = query.eq("operation", options.operation);
    }

    if (options?.provider) {
      query = query.eq("provider", options.provider);
    }

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    if (options?.startDate) {
      query = query.gte("created_at", options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte("created_at", options.endDate.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 100)) - 1);
    }

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === "42P01") {
        return [];
      }
      throw error;
    }

    return (data || []) as TelemetryEvent[];
  } catch (error) {
    console.error("[Telemetry] Error querying events:", error);
    return [];
  }
}

/**
 * Get telemetry statistics for testing
 */
export async function getTelemetryStats(options?: {
  tenantId?: string | null;
  provider?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  total_events: number;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  operations: Record<string, { count: number; avg_duration_ms: number; error_count: number }>;
}> {
  try {
    const events = await getTelemetryEvents({
      ...options,
      limit: 10000, // Get enough data for stats
    });

    const stats = {
      total_events: events.length,
      success_count: events.filter(e => e.status === "success").length,
      error_count: events.filter(e => e.status === "error").length,
      avg_duration_ms: 0,
      operations: {} as Record<string, { count: number; avg_duration_ms: number; error_count: number }>,
    };

    if (events.length > 0) {
      const durations = events.map(e => e.duration_ms).filter(d => d > 0);
      stats.avg_duration_ms = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;

      // Group by operation
      events.forEach(event => {
        if (!stats.operations[event.operation]) {
          stats.operations[event.operation] = {
            count: 0,
            avg_duration_ms: 0,
            error_count: 0,
          };
        }
        stats.operations[event.operation].count++;
        if (event.status === "error") {
          stats.operations[event.operation].error_count++;
        }
      });

      // Calculate avg duration per operation
      Object.keys(stats.operations).forEach(operation => {
        const operationEvents = events.filter(e => e.operation === operation);
        const operationDurations = operationEvents.map(e => e.duration_ms).filter(d => d > 0);
        stats.operations[operation].avg_duration_ms = operationDurations.length > 0
          ? operationDurations.reduce((a, b) => a + b, 0) / operationDurations.length
          : 0;
      });
    }

    return stats;
  } catch (error) {
    console.error("[Telemetry] Error getting stats:", error);
    return {
      total_events: 0,
      success_count: 0,
      error_count: 0,
      avg_duration_ms: 0,
      operations: {},
    };
  }
}
