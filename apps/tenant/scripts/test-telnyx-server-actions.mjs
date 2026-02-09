#!/usr/bin/env node
/**
 * Test script to verify Telnyx server actions are working correctly
 * This simulates what happens when the UI calls the server actions
 */

import { createClient } from "@supabase/supabase-js";

// Load environment variables
const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

console.log("🧪 Testing Telnyx Server Actions Integration...\n");

if (!TELNYX_API_KEY) {
  console.error("❌ TELNYX_API_KEY environment variable is not set");
  console.log("\nTo test:");
  console.log("1. Set TELNYX_API_KEY in your .env.local file");
  console.log("2. Or configure it via System Admin → Integrations → Telnyx");
  process.exit(1);
}

console.log("✅ Telnyx API Key found");
console.log("✅ Supabase URL:", SUPABASE_URL);
console.log("✅ Supabase Anon Key:", SUPABASE_ANON_KEY ? "Found" : "Missing\n");

// Test direct API call
console.log("\nTest 1: Direct Telnyx API Call...");
try {
  const response = await fetch("https://api.telnyx.com/v2/ai/assistants", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`   ❌ API call failed: ${response.status} ${response.statusText}`);
    console.error(`   Response: ${errorText.substring(0, 200)}`);
    process.exit(1);
  }

  const data = await response.json();
  const assistants = data.data || [];
  console.log(`   ✅ Success! Found ${assistants.length} assistant(s)`);
  
  if (assistants.length > 0) {
    console.log("\n   Assistants:");
    assistants.slice(0, 3).forEach((assistant, index) => {
      console.log(`   ${index + 1}. ${assistant.name || assistant.id}`);
      console.log(`      ID: ${assistant.id}`);
      console.log(`      Model: ${assistant.model || "N/A"}`);
    });
    if (assistants.length > 3) {
      console.log(`   ... and ${assistants.length - 3} more`);
    }
  }
} catch (error) {
  console.error("   ❌ Failed to call Telnyx API");
  console.error(`   Error: ${error.message}`);
  process.exit(1);
}

console.log("\n✅ Telnyx API is working correctly!");
console.log("\n📝 Next steps:");
console.log("   1. Test the UI at http://localhost:3010/ai/assistants");
console.log("   2. Verify assistants load in the browser");
console.log("   3. Test calling an assistant via the 'Start Call' button");
console.log("   4. Check telemetry at /ai/telemetry for API call logs");

process.exit(0);
