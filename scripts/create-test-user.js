#!/usr/bin/env node
/**
 * Script to create a test Platform Admin user using Supabase Admin API
 * This properly creates the user with all required fields
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwgnWNReilDMblYTn_I0';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
  process.exit(1);
}

async function createTestUser() {
  const email = 'systemadmin@tin.info';
  const password = '88888888';
  const fullName = 'System Admin';

  console.log(`\n🔧 Creating Platform Admin user: ${email}\n`);

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 1. Get Platform Admin role ID
    console.log('📋 Step 1: Finding Platform Admin role...');
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id, name')
      .eq('name', 'Platform Admin')
      .single();

    if (roleError || !roleData) {
      console.error('❌ Error finding Platform Admin role:', roleError);
      process.exit(1);
    }

    console.log(`✅ Found Platform Admin role: ${roleData.id}\n`);

    // 2. Check if user already exists in Auth
    console.log('📋 Step 2: Checking if user exists in Auth...');
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      process.exit(1);
    }

    const existingAuthUser = existingUsers?.users?.find((u) => u.email === email);
    let authUserId;

    if (existingAuthUser) {
      console.log(`⚠️  User already exists in Auth: ${existingAuthUser.id}`);
      console.log('   Deleting existing user to recreate properly...');
      await supabase.auth.admin.deleteUser(existingAuthUser.id);
      authUserId = null;
    }

    // 3. Create user in Supabase Auth using admin API
    console.log('📋 Step 3: Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError || !authData.user) {
      console.error('❌ Error creating user in Auth:', authError);
      process.exit(1);
    }

    authUserId = authData.user.id;
    console.log(`✅ Created Auth user: ${authUserId}\n`);

    // 4. Create or update user record in users table
    console.log('📋 Step 4: Creating/updating user record in database...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert({
        id: authUserId,
        email,
        full_name: fullName,
        tenant_id: null, // Platform Admins have NULL tenant_id
        role_id: roleData.id,
        plan: 'enterprise',
        status: 'active',
      }, {
        onConflict: 'id',
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ Error creating/updating user record:', userError);
      process.exit(1);
    }

    console.log(`\n✅ Platform Admin user created successfully!\n`);
    console.log(`📧 Login Credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}\n`);
    console.log(`👤 User Details:`);
    console.log(`   User ID: ${userData.id}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Full Name: ${userData.full_name}`);
    console.log(`   Role: Platform Admin`);
    console.log(`   Tenant ID: NULL (system-level)\n`);
    console.log(`🎉 You can now sign in at: http://localhost:3010/signin\n`);
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTestUser().catch(console.error);
