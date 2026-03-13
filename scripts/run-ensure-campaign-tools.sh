#!/usr/bin/env bash
# Ensure campaign purchase webhook tools (search_products, add_to_selection, create_draft_order)
# are configured on your Telnyx assistant with body_parameters so Telnyx sends the request body.
#
# Get your assistant ID from: Telnyx Mission Control → AI → Assistants, or from your campaign's
# voice assistant setting in the app.
#
# Usage:
#   ASSISTANT_ID=asst_xxxxxxxxxxxx ./scripts/run-ensure-campaign-tools.sh
# or
#   ./scripts/run-ensure-campaign-tools.sh asst_xxxxxxxxxxxx

set -e
ASSISTANT_ID="${1:-$ASSISTANT_ID}"
if [ -z "$ASSISTANT_ID" ]; then
  echo "Usage: ASSISTANT_ID=asst_xxx $0   OR   $0 asst_xxx"
  echo "BASE_URL defaults to https://konnect.tinconnect.com (production)."
  exit 1
fi

BASE_URL="${BASE_URL:-https://konnect.tinconnect.com}"
echo "Using BASE_URL=$BASE_URL"
echo "Updating assistant: $ASSISTANT_ID"
pnpm exec tsx apps/tenant/scripts/telnyx-ensure-campaign-purchase-tools.ts --assistantId "$ASSISTANT_ID"
