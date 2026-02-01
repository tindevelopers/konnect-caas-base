/**
 * Script to create a tenant admin user (tenantadmin@tin.info)
 * Run with: npx tsx scripts/create-tenant-admin.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createTenantAdmin() {
  const email = "tenantadmin@tin.info";
  const password = "88888888";
  const fullName = "Tenant Admin";

  console.log(`Creating Tenant Admin user: ${email}`);

  const adminClient = getAdminClient();

  try {
    // 1. Get or create tenant for tin.info
    let tenantId: string;
    const { data: existingTenant } = await adminClient
      .from("tenants")
      .select("id, name, plan")
      .eq("domain", "tin.info")
      .single();

    if (existingTenant) {
      tenantId = existingTenant.id;
      console.log(`Using existing tenant: ${existingTenant.name} (${tenantId})`);
    } else {
      const { data: newTenant, error: tenantError } = await adminClient
        .from("tenants")
        .insert({
          name: "TIN",
          domain: "tin.info",
          plan: "starter",
          status: "active",
          region: "us-east-1",
        })
        .select()
        .single();

      if (tenantError || !newTenant) {
        throw new Error(`Failed to create tenant: ${tenantError?.message || "Unknown"}`);
      }
      tenantId = newTenant.id;
      console.log(`Created tenant: ${newTenant.name} (${tenantId})`);
    }

    // 2. Get Workspace Admin role ID
    const { data: roleData, error: roleError } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", "Workspace Admin")
      .single();

    if (roleError || !roleData) {
      throw new Error(`Failed to find Workspace Admin role: ${roleError?.message || "Role not found"}`);
    }

    // 3. Create user in Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        tenant_id: tenantId,
      },
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes("already exists") || authError?.message?.includes("already registered")) {
        console.log("User already exists in Auth, fetching existing user...");
        const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        const existingUser = listData?.users?.find((u) => u.email === email);

        if (!existingUser) {
          throw new Error("User exists but could not be retrieved");
        }

        // Upsert user record
        const { data: userData, error: userError } = await adminClient
          .from("users")
          .upsert(
            {
              id: existingUser.id,
              email,
              full_name: fullName,
              tenant_id: tenantId,
              role_id: roleData.id,
              plan: "starter",
              status: "active",
            },
            { onConflict: "id" }
          )
          .select()
          .single();

        if (userError) {
          throw new Error(`Failed to create/update user record: ${userError.message}`);
        }

        console.log(`✅ Tenant Admin user created/updated successfully!`);
        console.log(`   User ID: ${userData.id}`);
        console.log(`   Email: ${userData.email}`);
        console.log(`   Role: Workspace Admin`);
        console.log(`   Tenant ID: ${tenantId}`);
        console.log(`\n📧 Login credentials:`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        return;
      }
      throw authError || new Error("Failed to create auth user");
    }

    console.log(`Created Auth user: ${authData.user.id}`);

    // 4. Create user record in users table
    const { data: userData, error: userError } = await adminClient
      .from("users")
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        tenant_id: tenantId,
        role_id: roleData.id,
        plan: "starter",
        status: "active",
      })
      .select()
      .single();

    if (userError) {
      if (userError.code === "23505") {
        console.log("User record already exists, updating...");
        const { data: updatedUser, error: updateError } = await adminClient
          .from("users")
          .update({
            tenant_id: tenantId,
            role_id: roleData.id,
            status: "active",
          })
          .eq("id", authData.user.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update user record: ${updateError.message}`);
        }

        console.log(`✅ Tenant Admin user updated successfully!`);
        console.log(`   User ID: ${updatedUser.id}`);
        return;
      }
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    console.log(`✅ Tenant Admin user created successfully!`);
    console.log(`   User ID: ${userData.id}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Role: Workspace Admin`);
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`\n📧 Login credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
  } catch (error: any) {
    console.error("❌ Error creating Tenant Admin user:", error.message);
    process.exit(1);
  }
}

createTenantAdmin();
