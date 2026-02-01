# Project MCP configuration

## Supabase MCP (local / project-scoped)

This project uses a **local** Supabase MCP, not the global Supabase MCP that requires organization OAuth.

- **Why local:** Each database has its own schema, migrations, and data. The MCP should target this project’s Supabase instance only.
- **Endpoint:** `http://127.0.0.1:54321/mcp` — the Supabase CLI MCP when you run `supabase start`.
- **No OAuth:** No org membership or “Authorize Cursor” flow; it talks directly to your local (or tunneled) Supabase.

### Use it

1. Start local Supabase: `pnpm supabase:start` or `supabase start`.
2. Open this project in Cursor; the project-level MCP config (`.cursor/mcp.json`) will use the local MCP.
3. Optionally disable the global “Supabase” MCP in **Cursor Settings → Tools & MCP** if you added it earlier, to avoid the org-auth prompt.

### Cloud / remote project

To use the MCP with a **hosted** Supabase project (e.g. `https://xxx.supabase.co`) instead of local:

- Keep using local Supabase for this repo’s schema and run `supabase start` so the MCP at `http://127.0.0.1:54321/mcp` reflects this project’s migrations, or
- For a remote project, you’d need a different setup (e.g. self-hosted MCP or SSH tunnel to that instance). The hosted `https://mcp.supabase.com/mcp` option requires org OAuth and is not project-only.
