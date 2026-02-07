"use server";

import { createAdminClient } from "@/core/database/admin-client";

export async function createPlatformAdminUser() {
  const email = "systemadmin@tin.info";
  const password = "88888888";
  const fullName = "System Admin";

  const adminClient = createAdminClient();

  try {
    // 1. Get Platform Admin role ID
    const { data: roleData, error: roleError } = await (adminClient.from("roles") as any)
      .select("id")
      .eq("name", "Platform Admin")
      .single();

    if (roleError || !roleData) {
      throw new Error(`Failed to find Platform Admin role: ${roleError?.message || "Role not found"}`);
    }

    const role = roleData as { id: string };

    // 2. Check if user already exists in Auth
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find((u) => u.email === email);

    let authUserId: string;

    if (existingAuthUser) {
      // User exists, use existing ID
      authUserId = existingAuthUser.id;
      console.log(`Using existing Auth user: ${authUserId}`);
    } else {
      // Create new user in Supabase Auth
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: fullName,
        },
      });

      if (authError || !authData.user) {
        throw new Error(`Failed to create user in Auth: ${authError?.message || "Unknown error"}`);
      }

      authUserId = authData.user.id;
      console.log(`Created Auth user: ${authUserId}`);
    }

    // 3. Create or update user record in users table
    const { data: userData, error: userError } = await (adminClient.from("users") as any)
      .upsert({
        id: authUserId,
        email,
        full_name: fullName,
        tenant_id: null, // Platform Admins have NULL tenant_id
        role_id: role.id,
        plan: "enterprise",
        status: "active",
      }, {
        onConflict: "id",
      })
      .select()
      .single();

    if (userError) {
      throw new Error(`Failed to create/update user record: ${userError.message}`);
    }

    const user = userData as any;

    return {
      success: true,
      message: "Platform Admin user created successfully",
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: "Platform Admin",
        tenant_id: user.tenant_id,
      },
    };
  } catch (error: any) {
    console.error("Error creating Platform Admin user:", error);
    return {
      success: false,
      message: error.message || "Failed to create Platform Admin user",
      error: error.message,
    };
  }
}
