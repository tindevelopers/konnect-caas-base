-- creates a table for storing per-tenant integration configs
create table if not exists integration_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
  category text not null,
  credentials jsonb not null,
  settings jsonb,
  status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists integration_configs_tenant_provider_idx
  on integration_configs (tenant_id, provider);

alter table integration_configs enable row level security;

create policy integration_configs_tenant_access on integration_configs
  for all
  using (tenant_id = current_setting('app.current_tenant')::uuid)
  with check (tenant_id = current_setting('app.current_tenant')::uuid);
