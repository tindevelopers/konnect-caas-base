/**
 * Script to create a Platform Admin user
 * Run with: npx tsx scripts/create-platform-admin.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 */

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

async function createPlatformAdmin() {
  const email = "systemadmin@tin.info";
  const password = "88888888";
  const fullName = "System Admin";

  console.log(`Creating Platform Admin user: ${email}`);

  const adminClient = getAdminClient();

  try {
    // 1. Get Platform Admin role ID
    const { data: roleData, error: roleError } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", "Platform Admin")
      .single();

    if (roleError || !roleData) {
      throw new Error(`Failed to find Platform Admin role: ${roleError?.message || "Role not found"}`);
    }

    console.log(`Found Platform Admin role: ${roleData.id}`);

    // 2. Create user in Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError || !authData.user) {
      // If user already exists, try to get it
      if (authError?.message?.includes("already exists") || authError?.message?.includes("already registered")) {
        console.log("User already exists in Auth, fetching existing user...");
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u) => u.email === email);
        
        if (!existingUser) {
          throw new Error("User exists but could not be retrieved");
        }
        
        console.log(`Using existing Auth user: ${existingUser.id}`);
        
        // 3. Create or update user record in users table
        const { data: userData, error: userError } = await adminClient
          .from("users")
          .upsert({
            id: existingUser.id,
            email,
            full_name: fullName,
            tenant_id: null, // Platform Admins have NULL tenant_id
            role_id: roleData.id,
            plan: "enterprise",
            status: "active",
          }, {
            onConflict: "id",
          })
          .select()
          .single();

        if (userError) {
          throw new Error(`Failed to create user record: ${userError.message}`);
        }

        console.log(`✅ Platform Admin user created/updated successfully!`);
        console.log(`   User ID: ${userData.id}`);
        console.log(`   Email: ${userData.email}`);
        console.log(`   Role: Platform Admin`);
        console.log(`   Tenant ID: NULL (Platform Admin)`);
        return;
      }
      
      throw authError || new Error("Failed to create user in Auth");
    }

    console.log(`Created Auth user: ${authData.user.id}`);

    // 3. Create user record in users table
    const { data: userData, error: userError } = await adminClient
      .from("users")
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        tenant_id: null, // Platform Admins have NULL tenant_id
        role_id: roleData.id,
        plan: "enterprise",
        status: "active",
      })
      .select()
      .single();

    if (userError) {
      // If user record already exists, try to update it
      if (userError.code === "23505") {
        console.log("User record already exists, updating...");
        const { data: updatedUser, error: updateError } = await adminClient
          .from("users")
          .update({
            tenant_id: null,
            role_id: roleData.id,
            status: "active",
          })
          .eq("id", authData.user.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update user record: ${updateError.message}`);
        }

        console.log(`✅ Platform Admin user updated successfully!`);
        console.log(`   User ID: ${updatedUser.id}`);
        console.log(`   Email: ${updatedUser.email}`);
        console.log(`   Role: Platform Admin`);
        console.log(`   Tenant ID: NULL (Platform Admin)`);
        return;
      }
      
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    console.log(`✅ Platform Admin user created successfully!`);
    console.log(`   User ID: ${userData.id}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Role: Platform Admin`);
    console.log(`   Tenant ID: NULL (Platform Admin)`);
    console.log(`\n📧 Login credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
  } catch (error: any) {
    console.error("❌ Error creating Platform Admin user:", error.message);
    process.exit(1);
  }
}

createPlatformAdmin();
