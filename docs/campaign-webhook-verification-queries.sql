-- Campaign webhook verification queries for Supabase SQL Editor
-- Run these in the Supabase Dashboard → SQL Editor (paste and replace UUIDs as needed).

-- =============================================================================
-- 1. Campaigns with webhook URL configured (you already ran this successfully)
-- =============================================================================
SELECT
  c.id,
  c.name,
  c.settings->>'webhookUrl' AS webhook_url,
  c.settings->>'railwayWebhookUrl' AS railway_webhook_url
FROM campaigns c
WHERE (c.settings->>'webhookUrl') IS NOT NULL
   OR (c.settings->>'railwayWebhookUrl') IS NOT NULL;


-- =============================================================================
-- 2. Recipients with a stored invoice URL (successful webhook call)
-- =============================================================================
SELECT
  cr.id AS recipient_id,
  cr.campaign_id,
  cr.tenant_id,
  cr.phone,
  cr.result->'purchase'->>'invoiceUrl'     AS invoice_url,
  cr.result->'purchase'->'lineItemsSent'  AS line_items_sent,
  cr.result->'purchase'->>'checkoutConfirmedAt' AS checkout_confirmed_at,
  cr.updated_at
FROM campaign_recipients cr
WHERE cr.result->'purchase'->>'invoiceUrl' IS NOT NULL
  AND (cr.result->'purchase'->>'invoiceUrl') != ''
ORDER BY cr.updated_at DESC;


-- =============================================================================
-- 3. All recipients for a specific campaign (purchase state inspection)
-- Replace the UUID below with a real campaign id from query 1 (e.g. d83d7a7a-562e-4a2a-b2de-1d32d2efea9d)
-- =============================================================================
SELECT
  cr.id,
  cr.result->'purchase' AS purchase_state,
  cr.updated_at
FROM campaign_recipients cr
WHERE cr.campaign_id = 'd83d7a7a-562e-4a2a-b2de-1d32d2efea9d'
ORDER BY cr.updated_at DESC;


-- =============================================================================
-- 4. All recipients that have ANY purchase-related data (no campaign filter)
-- Use this to see if any recipient has purchase state at all (e.g. selectedProducts without invoiceUrl)
-- =============================================================================
SELECT
  cr.id,
  cr.campaign_id,
  cr.phone,
  cr.result->'purchase' AS purchase_state,
  cr.updated_at
FROM campaign_recipients cr
WHERE cr.result ? 'purchase'
  AND cr.result->'purchase' IS NOT NULL
  AND cr.result->'purchase' != 'null'::jsonb
ORDER BY cr.updated_at DESC;
