#!/usr/bin/env tsx
/**
 * Test script to verify Telnyx API is working correctly
 */

import { createTelnyxClient } from "@tinadmin/telnyx-ai-platform/server";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";

async function testTelnyxAPI() {
  console.log("🧪 Testing Telnyx API...\n");

  if (!TELNYX_API_KEY) {
    console.error("❌ TELNYX_API_KEY environment variable is not set");
    console.log("\nTo test:");
    console.log("1. Set TELNYX_API_KEY in your .env.local file");
    console.log("2. Or configure it via System Admin → Integrations → Telnyx");
    process.exit(1);
  }

  try {
    console.log("✅ Telnyx API Key found (length:", TELNYX_API_KEY.length, "chars)");
    console.log("   Key preview:", TELNYX_API_KEY.substring(0, 10) + "...\n");

    const client = createTelnyxClient({ apiKey: TELNYX_API_KEY });

    // Test 1: List Assistants
    console.log("Test 1: Listing AI Assistants...");
    try {
      const assistantsResponse = await client.request("/ai_assistants", {
        method: "GET",
      });
      
      const assistants = (assistantsResponse as any)?.data || [];
      console.log(`   ✅ Success! Found ${assistants.length} assistant(s)`);
      
      if (assistants.length > 0) {
        console.log("\n   Assistants:");
        assistants.slice(0, 5).forEach((assistant: any, index: number) => {
          console.log(`   ${index + 1}. ${assistant.name || assistant.id}`);
          console.log(`      ID: ${assistant.id}`);
          console.log(`      Model: ${assistant.model || "N/A"}`);
        });
        if (assistants.length > 5) {
          console.log(`   ... and ${assistants.length - 5} more`);
        }
      }
    } catch (error: any) {
      console.error("   ❌ Failed to list assistants");
      if (error.message) {
        console.error(`      Error: ${error.message}`);
      }
      if (error.statusCode) {
        console.error(`      Status: ${error.statusCode}`);
      }
      throw error;
    }

    // Test 2: List Models
    console.log("\nTest 2: Listing available models...");
    try {
      const modelsResponse = await client.request("/ai_models", {
        method: "GET",
      });
      
      const models = (modelsResponse as any)?.data || [];
      console.log(`   ✅ Success! Found ${models.length} model(s)`);
      
      if (models.length > 0) {
        console.log("\n   Models (first 5):");
        models.slice(0, 5).forEach((model: any, index: number) => {
          console.log(`   ${index + 1}. ${model.name || model.id}`);
        });
      }
    } catch (error: any) {
      console.error("   ⚠️  Failed to list models (may not be available)");
      if (error.message) {
        console.error(`      Error: ${error.message}`);
      }
    }

    console.log("\n✅ Telnyx API is working correctly!");
    console.log("\n📝 Next steps:");
    console.log("   1. Test calling an assistant via the UI");
    console.log("   2. Check telemetry at /ai/telemetry for API call logs");
    console.log("   3. Verify webhook events at /ai/webhooks");

  } catch (error: any) {
    console.error("\n❌ Telnyx API test failed");
    console.error("Error:", error.message || error);
    
    if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
      console.error("\n💡 This looks like an authentication error.");
      console.error("   Please verify your Telnyx API key is correct.");
      console.error("   Get your API key from: Telnyx Mission Control → API Keys");
    }
    
    process.exit(1);
  }
}

// Run tests
testTelnyxAPI()
  .then(() => {
    console.log("\n✨ All tests completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test suite failed:", error);
    process.exit(1);
  });
