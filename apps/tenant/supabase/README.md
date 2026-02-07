# Local Supabase Setup

This directory contains the Supabase configuration for local development.

## Quick Start

1. **Start Docker Desktop** (must be running)

2. **Start Supabase:**
   ```bash
   supabase start
   ```

3. **Copy the credentials** from the output and add them to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-output>
   ```

4. **Access Supabase Studio:**
   - Open the Studio URL from the `supabase start` output (usually http://localhost:54323)
   - View tables, run SQL queries, manage data

## Useful Commands

- `supabase start` - Start local Supabase services
- `supabase stop` - Stop local Supabase services  
- `supabase status` - Check status and get credentials
- `supabase db reset` - Reset database and run all migrations
- `supabase migration new <name>` - Create a new migration
- `supabase db push` - Push local migrations to production (when ready)

## Migrations

Migrations are stored in `supabase/migrations/` and run automatically when you:
- Run `supabase start` (first time)
- Run `supabase db reset` (resets and applies all migrations)

## When Ready to Deploy

1. Create a Supabase cloud project at https://supabase.com
2. Link your local project: `supabase link --project-ref <your-project-ref>`
3. Push migrations: `supabase db push`
4. Update production environment variables with cloud credentials

