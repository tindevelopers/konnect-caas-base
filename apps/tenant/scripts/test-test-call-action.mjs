#!/usr/bin/env node
/**
 * Test script to verify the testCallAssistantAction functionality
 */

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

if (!TELNYX_API_KEY) {
  console.error("❌ TELNYX_API_KEY is required. Set it in .env.local or pass as env var.");
  process.exit(1);
}
if (!ASSISTANT_ID) {
  console.error("❌ ASSISTANT_ID is required. Set it in .env.local or pass as env var.");
  process.exit(1);
}

console.log("🧪 Testing Test Call Assistant Action...\n");
console.log("Assistant ID:", ASSISTANT_ID);
console.log("API Key:", TELNYX_API_KEY.substring(0, 20) + "...\n");

// Step 1: Get the assistant
console.log("Step 1: Getting assistant details...");
try {
  const assistantResponse = await fetch(`https://api.telnyx.com/v2/ai/assistants/${ASSISTANT_ID}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!assistantResponse.ok) {
    const errorText = await assistantResponse.text();
    throw new Error(`Failed to get assistant: ${assistantResponse.status} - ${errorText}`);
  }

  const assistant = await assistantResponse.json();
  const assistantData = assistant.data || assistant;
  const versionId = assistantData.version_id || ASSISTANT_ID;
  
  console.log("✅ Assistant found:");
  console.log("   Name:", assistantData.name || "N/A");
  console.log("   Version ID:", versionId);
  console.log("   Model:", assistantData.model || "N/A");
} catch (error) {
  console.error("❌ Error getting assistant:", error.message);
  process.exit(1);
}

// Step 2: List existing tests
console.log("\nStep 2: Checking for existing tests...");
try {
  const testsResponse = await fetch("https://api.telnyx.com/v2/ai/assistants/tests", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!testsResponse.ok) {
    throw new Error(`Failed to list tests: ${testsResponse.status}`);
  }

  const tests = await testsResponse.json();
  const testList = tests.data || [];
  console.log(`✅ Found ${testList.length} existing test(s)`);
  
  if (testList.length > 0) {
    console.log("   Tests:", testList.map(t => t.name || t.test_id).join(", "));
  }
} catch (error) {
  console.error("❌ Error listing tests:", error.message);
}

// Step 3: Create a test if none exists
console.log("\nStep 3: Creating or using test...");
let testId;
try {
  const testsResponse = await fetch("https://api.telnyx.com/v2/ai/assistants/tests", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  
  const tests = await testsResponse.json();
  const testList = tests.data || [];
  
  if (testList.length > 0) {
    testId = testList[0].test_id;
    console.log(`✅ Using existing test: ${testId}`);
  } else {
    console.log("   No existing test found, creating new one...");
    const testPayload = {
      name: `Quick Test - ${ASSISTANT_ID.slice(0, 8)}`,
      destination: ASSISTANT_ID, // For web_chat channel, use assistant ID as destination
      telnyx_conversation_channel: "web_chat", // Use web_chat for internal testing (no real calls)
      instructions: "Test the assistant's response to a simple greeting and question.",
      rubric: [
        {
          name: "greeting_response",
          criteria: "Assistant should respond appropriately to greeting",
        },
        {
          name: "question_handling",
          criteria: "Assistant should handle questions correctly",
        },
      ],
      description: `Quick test for assistant ${ASSISTANT_ID}`,
      max_duration_seconds: 60,
    };
    
    const createResponse = await fetch("https://api.telnyx.com/v2/ai/assistants/tests", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create test: ${createResponse.status} - ${errorText}`);
    }
    
    const createdTest = await createResponse.json();
    testId = (createdTest.data || createdTest).test_id;
    console.log(`✅ Created new test: ${testId}`);
  }
} catch (error) {
  console.error("❌ Error with test:", error.message);
  process.exit(1);
}

// Step 4: Trigger test run
console.log("\nStep 4: Triggering test run...");
try {
  const assistantResponse = await fetch(`https://api.telnyx.com/v2/ai/assistants/${ASSISTANT_ID}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  
  const assistant = await assistantResponse.json();
  const assistantData = assistant.data || assistant;
  const versionId = assistantData.version_id || ASSISTANT_ID;
  
  const triggerPayload = {
    destination_version_id: versionId,
  };
  
  const triggerResponse = await fetch(`https://api.telnyx.com/v2/ai/assistants/tests/${testId}/runs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(triggerPayload),
  });
  
  if (!triggerResponse.ok) {
    const errorText = await triggerResponse.text();
    throw new Error(`Failed to trigger test run: ${triggerResponse.status} - ${errorText}`);
  }
  
  const testRun = await triggerResponse.json();
  const runData = testRun.data || testRun;
  
  console.log("✅ Test run triggered successfully!");
  console.log("\n📊 Test Run Details:");
  console.log("   Run ID:", runData.run_id);
  console.log("   Status:", runData.status);
  console.log("   Conversation ID:", runData.conversation_id || "N/A");
  console.log("   Created at:", runData.created_at || "N/A");
  
  console.log("\n✅ Test Call functionality is working!");
  console.log("\n💡 This test simulates a call without dialing a real number.");
  console.log("   View test results at: https://portal.telnyx.com/");
  
} catch (error) {
  console.error("❌ Error triggering test run:", error.message);
  if (error.message.includes("422")) {
    console.error("\n💡 This might mean:");
    console.error("   - The test requires additional configuration");
    console.error("   - The assistant version_id format is incorrect");
    console.error("   - Check Telnyx API documentation for test requirements");
  }
  process.exit(1);
}
