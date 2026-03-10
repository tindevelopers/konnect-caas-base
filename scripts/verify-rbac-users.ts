#!/usr/bin/env tsx
/**
 * Verify RBAC: list users with role and tenant so you can fix Organisation Admins
 * that are wrongly treated as Platform Admin (role "Platform Admin" + tenant_id NULL).
 *
 * Usage: npx tsx scripts/verify-rbac-users.ts
 * Fix a user: npx tsx scripts/assign-org-role.ts <email> <tenant-id>
 * List tenants: npx tsx scripts/list-tenants.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { createAdminClient } from "@/core/database/admin-client";

async function main() {
  const adminClient = createAdminClient();

  const { data: users, error } = await adminClient
    .from("users")
    .select(`
      id,
      email,
      full_name,
      role_id,
      tenant_id,
      roles:role_id(name),
      tenants:tenant_id(name, domain)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching users:", error);
    process.exit(1);
  }

  if (!users?.length) {
    console.log("No users found.");
    process.exit(0);
  }

  const roleName = (r: unknown) => (r as { name?: string } | null)?.name ?? "—";
  const tenantName = (t: unknown) => (t as { name?: string; domain?: string } | null)?.name ?? "—";

  console.log("\n📋 Users (role + tenant) – Platform Admin = role 'Platform Admin' AND tenant_id NULL\n");
  console.log("Email                          | Role                | Tenant (tenant_id)     | Treated as");
  console.log("-------------------------------|---------------------|------------------------|------------------");

  for (const u of users as Array<{
    email: string | null;
    full_name: string | null;
    tenant_id: string | null;
    roles: unknown;
    tenants: unknown;
  }>) {
    const role = roleName(u.roles);
    const tenant = tenantName(u.tenants);
    const isPlatformAdmin = role === "Platform Admin" && u.tenant_id === null;
    const treated = isPlatformAdmin ? "Platform Admin" : "Org / tenant-scoped";
    const email = (u.email ?? "").padEnd(30);
    const rolePad = role.padEnd(19);
    const tenantPad = (tenant + (u.tenant_id ? ` (${u.tenant_id.slice(0, 8)}…)` : "")).padEnd(22);
    console.log(`${email} | ${rolePad} | ${tenantPad} | ${treated}`);
  }

  type Row = { email?: string | null; roles: unknown; tenant_id: string | null };
  const wrong = (users as Row[]).filter(
    (u) => roleName(u.roles) === "Platform Admin" && u.tenant_id !== null
  );
  const orgAdminsWithNullTenant = (users as Row[]).filter(
    (u) => roleName(u.roles) === "Organization Admin" && u.tenant_id === null
  );

  console.log("");
  if (orgAdminsWithNullTenant.length > 0) {
    console.log("⚠️  Users with role 'Organization Admin' but tenant_id NULL (treated as Platform Admin by app):");
    orgAdminsWithNullTenant.forEach((u) => console.log(`   - ${u.email ?? "?"}`));
    console.log("\n   Fix: npx tsx scripts/assign-org-role.ts <email> <tenant-id>");
    console.log("   Get tenant IDs: npx tsx scripts/list-tenants.ts\n");
  }

  if (wrong.length > 0) {
    console.log("⚠️  Users with role 'Platform Admin' but tenant_id set (inconsistent):");
    wrong.forEach((u) => console.log(`   - ${u.email ?? "?"}`));
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
