-- creates a table for storing MCP server registry entries per tenant
create table if not exists telnyx_mcp_servers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  server_url text not null,
  secret_ref text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telnyx_mcp_servers_tenant_idx
  on telnyx_mcp_servers (tenant_id);

alter table telnyx_mcp_servers enable row level security;

create policy telnyx_mcp_servers_tenant_access on telnyx_mcp_servers
  for all
  using (tenant_id = current_setting('app.current_tenant')::uuid)
  with check (tenant_id = current_setting('app.current_tenant')::uuid);
