import { CrmProvider, CrmProviderConfig } from './crm-interface';
import { GoHighLevelProvider } from './providers/gohighlevel-provider';

class CrmProviderRegistry {
  private providers = new Map<string, CrmProvider>();

  async getOrCreate(config: CrmProviderConfig): Promise<CrmProvider> {
    const key = `${config.provider}:${JSON.stringify(config.credentials)}`;
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

    const provider = await createProvider(config);
    this.providers.set(key, provider);
    return provider;
  }

  clear() {
    this.providers.clear();
  }
}

const registry = new CrmProviderRegistry();

export async function createProvider(config: CrmProviderConfig): Promise<CrmProvider> {
  let provider: CrmProvider;

  switch (config.provider) {
    case 'gohighlevel':
      provider = new GoHighLevelProvider();
      break;
    default:
      throw new Error(`Unknown CRM provider: ${config.provider}`);
  }

  await provider.initialize(config);

  const healthy = await provider.healthCheck();
  if (!healthy) {
    throw new Error(`${config.provider} reported unhealthy status`);
  }

  return provider;
}

export function getCrmProvider(config: CrmProviderConfig): Promise<CrmProvider> {
  return registry.getOrCreate(config);
}
