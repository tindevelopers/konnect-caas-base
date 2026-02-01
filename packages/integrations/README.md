# Integrations Package

This package centralizes third-party integration contracts, factories, and provider implementations so the rest of the app can treat external systems with a common shape.

## CRM Providers

- Define a configuration using [`CrmProviderConfig`](./crm/crm-types.ts).
- Use `createProvider` from [`crm/crm-provider-factory.ts`](./crm/crm-provider-factory.ts) to obtain the provider instance for the configured tenant.
- The GoHighLevel adapter lives in [`crm/providers/gohighlevel-provider.ts`](./crm/providers/gohighlevel-provider.ts) and demonstrates how to map the provider API to the shared `CrmProvider` interface.
- Add new CRM adapters by implementing `CrmProvider` and adding the provider to the factory switch statement (and registering it in `index.ts` for exports).

## Calendaring Providers

- The `/calendar` folder defines `CalendarProvider`, `CalendarEvent`, and related types.
- Use `createCalendarProvider` to instantiate adapters once a calendaring provider exists (cal.com and others can be added here).
- This section currently contains the contract and a placeholder factory; once we select a calendaring provider we can drop in the implementation without changing the rest of the platform.

## Usage Tips

1. Import the shared package from anywhere in the app via `import { createProvider } from "@konnect/integrations/crm/crm-provider-factory";` (or `@/integrations` once you update path aliases).
2. Keep provider-specific logic inside the adapter so UI and actions work against the generic `CrmProvider` surface.
3. Document new providers by updating this README so the integration catalog stays discoverable.
