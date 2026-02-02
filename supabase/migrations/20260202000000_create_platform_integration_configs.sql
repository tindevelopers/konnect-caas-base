-- Platform-level (system-wide) integration configs.
-- Used as default when a tenant has no integration configured.
-- Only platform admins can manage via app (service role / admin client).
create table if not exists platform_integration_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  category text not null,
  credentials jsonb not null default '{}',
  settings jsonb,
  status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_integration_configs_provider_idx
  on platform_integration_configs (provider);

comment on table platform_integration_configs is
  'System-wide integration credentials (e.g. default Telnyx). Used when tenant has no integration_configs row.';
