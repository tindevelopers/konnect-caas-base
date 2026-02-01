import { createClient } from '../database/server';

export interface IntegrationConfigParams {
  tenantId: string;
  provider: string;
  category: string;
  credentials: Record<string, any>;
  settings?: Record<string, any> | null;
  status?: string;
}

export async function getIntegrationConfigs(tenantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('integration_configs')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) {
    throw error;
  }

  return data;
}

export async function getIntegrationConfig(tenantId: string, provider: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('integration_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

export async function upsertIntegrationConfig(params: IntegrationConfigParams) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('integration_configs')
    .upsert({
      tenant_id: params.tenantId,
      provider: params.provider,
      category: params.category,
      credentials: params.credentials,
      settings: params.settings ?? null,
      status: params.status ?? 'disconnected',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
