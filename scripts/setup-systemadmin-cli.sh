#!/bin/bash
# Create System Admin user on REMOTE Supabase
# Username: systemadmin@tin.info
# Password: 88888888
#
# Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (remote)
# Run: ./scripts/setup-systemadmin-cli.sh

set -e
cd "$(dirname "$0")/.."

echo "Creating System Admin on remote Supabase (systemadmin@tin.info / 88888888)"
echo ""

# Load Supabase vars from .env.local (handles values with = and spaces)
if [ -f .env.local ]; then
  export NEXT_PUBLIC_SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '\r')
  export SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | tr -d '\r')
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
  echo "Add them to .env.local (remote Supabase project)."
  exit 1
fi

if [[ "$NEXT_PUBLIC_SUPABASE_URL" == *"localhost"* ]] || [[ "$NEXT_PUBLIC_SUPABASE_URL" == *"127.0.0.1"* ]]; then
  echo "Error: .env.local points to local Supabase. Use remote Supabase URL (e.g. https://xxx.supabase.co)."
  exit 1
fi

echo "Using: $NEXT_PUBLIC_SUPABASE_URL"
echo ""
echo "Running: npx tsx scripts/create-platform-admin.ts"
echo ""
npx tsx scripts/create-platform-admin.ts

echo ""
echo "System Admin created on remote Supabase."
echo "  Email:    systemadmin@tin.info"
echo "  Password: 88888888"
echo ""
echo "If you see 'roles table not found': run migrations first in Supabase Dashboard"
echo "  → SQL Editor: paste and run scripts/bootstrap-hosted-schema.sql"
