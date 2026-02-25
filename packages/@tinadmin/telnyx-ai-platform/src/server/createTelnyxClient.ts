import type { TelnyxClientConfig, TelnyxTransport } from "../client/types";
import { createTelnyxClient as createFetchTelnyxClient } from "../client/telnyxClient";
import { createOfficialTelnyxTransport } from "./officialTransport";

export type TelnyxClientImpl = "fetch" | "official";

function resolveClientImpl(): TelnyxClientImpl {
  const raw = (process.env.TELNYX_CLIENT_IMPL ?? "fetch").toLowerCase().trim();
  return raw === "official" ? "official" : "fetch";
}

function attachImpl(transport: TelnyxTransport, impl: TelnyxClientImpl): TelnyxTransport {
  try {
    Object.defineProperty(transport as any, "__telnyxClientImpl", {
      value: impl,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  } catch {
    // ignore
  }
  return transport;
}

/**
 * Server-side Telnyx client factory.
 *
 * Feature flag: set `TELNYX_CLIENT_IMPL=official` to route requests through the
 * official Telnyx SDK. Default is `fetch` to preserve current behavior.
 */
export function createTelnyxClient(config: TelnyxClientConfig): TelnyxTransport {
  const impl = resolveClientImpl();
  if (impl === "official") return attachImpl(createOfficialTelnyxTransport(config), "official");
  return attachImpl(createFetchTelnyxClient(config), "fetch");
}

/**
 * Explicit factories for tests and incremental rollouts.
 */
export function createTelnyxFetchClient(config: TelnyxClientConfig): TelnyxTransport {
  return attachImpl(createFetchTelnyxClient(config), "fetch");
}

export function createTelnyxOfficialClient(config: TelnyxClientConfig): TelnyxTransport {
  return attachImpl(createOfficialTelnyxTransport(config), "official");
}

