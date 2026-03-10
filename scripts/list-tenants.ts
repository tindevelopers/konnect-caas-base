/**
 * Script to list all tenants
 * Usage: npx tsx scripts/list-tenants.ts
 * 
 * Make sure .env.local is loaded or environment variables are set
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") });

import { createAdminClient } from "@/core/database/admin-client";

async function listTenants() {
  const adminClient = createAdminClient();

  console.log(`\n🔍 Fetching all tenants...\n`);

  const { data: tenants, error } = await adminClient
    .from("tenants")
    .select("id, name, domain, status, plan, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching tenants:", error);
    process.exit(1);
  }

  if (!tenants || tenants.length === 0) {
    console.log("No tenants found.");
    process.exit(0);
  }

  console.log(`Found ${tenants.length} tenant(s):\n`);
  tenants.forEach((tenant, index) => {
    console.log(`${index + 1}. ${tenant.name}`);
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Domain: ${tenant.domain}`);
    console.log(`   Status: ${tenant.status}`);
    console.log(`   Plan: ${tenant.plan}`);
    console.log(`   Created: ${new Date(tenant.created_at).toLocaleDateString()}`);
    console.log("");
  });
}

listTenants().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});

