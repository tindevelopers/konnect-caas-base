/**
 * Script to assign Organization Admin role to a user for tenant management
 * Usage: npx tsx scripts/assign-org-role.ts <email> <tenant-id>
 * 
 * Make sure .env.local is loaded or environment variables are set
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") });

import { createAdminClient } from "@/core/database/admin-client";

async function assignOrgRole(email: string, tenantId?: string) {
  const adminClient = createAdminClient();

  console.log(`\n🔍 Looking up user: ${email}...`);

  // Find user by email
  const { data: users, error: userError } = await adminClient
    .from("users")
    .select("id, email, full_name, role_id, tenant_id, roles:role_id(name)")
    .eq("email", email)
    .maybeSingle();

  if (userError) {
    console.error("❌ Error finding user:", userError);
    process.exit(1);
  }

  if (!users) {
    console.error(`❌ User with email ${email} not found`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${users.full_name} (${users.email})`);
  console.log(`   Current role: ${(users.roles as any)?.name || "None"}`);
  console.log(`   Current tenant_id: ${users.tenant_id || "None (Platform Admin)"}`);

  // Get Organization Admin role
  console.log(`\n🔍 Looking up "Organization Admin" role...`);
  const { data: workspaceAdminRole, error: roleError } = await adminClient
    .from("roles")
    .select("id, name")
    .eq("name", "Organization Admin")
    .single();

  if (roleError || !workspaceAdminRole) {
    console.error("❌ Error finding Organization Admin role:", roleError);
    process.exit(1);
  }

  console.log(`✅ Found role: ${workspaceAdminRole.name} (${workspaceAdminRole.id})`);

  // If tenantId provided, verify it exists
  let targetTenantId = tenantId || users.tenant_id;
  if (targetTenantId) {
    console.log(`\n🔍 Verifying tenant: ${targetTenantId}...`);
    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .select("id, name, domain")
      .eq("id", targetTenantId)
      .single();

    if (tenantError || !tenant) {
      console.error(`❌ Tenant ${targetTenantId} not found:`, tenantError);
      process.exit(1);
    }

    console.log(`✅ Found tenant: ${tenant.name} (${tenant.domain})`);
  } else {
    console.log(`\n⚠️  No tenant_id provided. User will remain as Platform Admin.`);
    console.log(`   To assign to a tenant, provide tenant_id as second argument.`);
    process.exit(0);
  }

  // Update user with Organization Admin role and tenant_id
  console.log(`\n🔄 Updating user...`);
  const { data: updatedUser, error: updateError } = await adminClient
    .from("users")
    .update({
      role_id: workspaceAdminRole.id,
      tenant_id: targetTenantId,
    })
    .eq("id", users.id)
    .select(`
      id,
      email,
      full_name,
      role_id,
      tenant_id,
      roles:role_id(name),
      tenants:tenant_id(name, domain)
    `)
    .single();

  if (updateError) {
    console.error("❌ Error updating user:", updateError);
    process.exit(1);
  }

  console.log(`\n✅ Successfully assigned Organization Admin role!`);
  console.log(`\n📋 Updated user details:`);
  console.log(`   Name: ${updatedUser.full_name}`);
  console.log(`   Email: ${updatedUser.email}`);
  console.log(`   Role: ${(updatedUser.roles as any)?.name}`);
  console.log(`   Tenant: ${(updatedUser.tenants as any)?.name || "None"} (${(updatedUser.tenants as any)?.domain || "N/A"})`);
  console.log(`\n🎉 User can now manage tenant: ${(updatedUser.tenants as any)?.name}`);
}

// Get command line arguments
const email = process.argv[2];
const tenantId = process.argv[3];

if (!email) {
  console.error("Usage: npx tsx scripts/assign-org-role.ts <email> [tenant-id]");
  console.error("\nExample:");
  console.error('  npx tsx scripts/assign-org-role.ts systemadmin@tin.info <tenant-uuid>');
  process.exit(1);
}

assignOrgRole(email, tenantId).catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});

