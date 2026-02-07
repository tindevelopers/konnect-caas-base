-- Telephony and AI agent event logging (tenant-scoped)
create table if not exists telephony_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
  event_type text not null,
  external_id text,
  payload jsonb not null default '{}',
  received_at timestamptz not null default now()
);

create index if not exists telephony_events_tenant_idx
  on telephony_events (tenant_id);
create index if not exists telephony_events_provider_idx
  on telephony_events (provider);
create index if not exists telephony_events_type_idx
  on telephony_events (event_type);
create index if not exists telephony_events_external_idx
  on telephony_events (external_id);

alter table telephony_events enable row level security;

create policy telephony_events_tenant_access on telephony_events
  for all
  using (tenant_id = get_current_tenant_id())
  with check (tenant_id = get_current_tenant_id());

create table if not exists ai_agent_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
  event_type text not null,
  external_id text,
  payload jsonb not null default '{}',
  received_at timestamptz not null default now()
);

create index if not exists ai_agent_events_tenant_idx
  on ai_agent_events (tenant_id);
create index if not exists ai_agent_events_provider_idx
  on ai_agent_events (provider);
create index if not exists ai_agent_events_type_idx
  on ai_agent_events (event_type);
create index if not exists ai_agent_events_external_idx
  on ai_agent_events (external_id);

alter table ai_agent_events enable row level security;

create policy ai_agent_events_tenant_access on ai_agent_events
  for all
  using (tenant_id = get_current_tenant_id())
  with check (tenant_id = get_current_tenant_id());
