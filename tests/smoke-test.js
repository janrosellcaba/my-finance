const BASE_URL = "http://localhost:8787"; // Standard Wrangler local proxy port

async function runTests() {
  console.log("🚀 Starting MyFinance Backend Smoke Tests...\n");
  let cookieHeader = "";

  // 1. TEST SIGNUP (Should fail with bad safety code)
  console.log("⏳ Test 1: Signup with wrong safety code...");
  const res1 = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "testuser", password: "password123", secretCode: "wrong_code" })
  });
  console.log(res1.status === 403 ? "✅ Correctly rejected!" : "❌ Failed to reject bad safety code");

  // 2. TEST SIGNUP (Should succeed with correct code)
  console.log("\n⏳ Test 2: Signup with correct safety code...");
  const uniqueUsername = `user_${Date.now()}`;
  const res2 = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: uniqueUsername, password: "password123", secretCode: "1234" })
  });
  
  if (res2.status === 201) {
    console.log("✅ Signup successful!");
    // Capture the cookie for subsequent session tests
    cookieHeader = res2.headers.get("set-cookie");
  } else {
    console.error("❌ Signup failed", await res2.json());
    return;
  }

  // 3. TEST TRANSACTIONS (Add an expense)
  console.log("\n⏳ Test 3: Creating an expense transaction...");
  // First, let's get our seeded accounts/categories to grab a valid ID
  const configRes = await fetch(`${BASE_URL}/api/config`, {
    headers: { "Cookie": cookieHeader }
  });
  const configData = await configRes.json();
  const validAccountId = configData.accounts[0].id;
  const validCategoryId = configData.categories[0].id;

  const res3 = await fetch(`${BASE_URL}/api/transactions`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Cookie": cookieHeader
    },
    body: JSON.stringify({
      date: "2026-07-11",
      description: "Supermarket Dinner",
      type: "expense",
      amount: 25.50,
      accountId: validAccountId,
      destinationId: validCategoryId
    })
  });
  console.log(res3.status === 201 ? "✅ Expense created successfully!" : "❌ Failed to create expense");

  // 4. TEST DASHBOARD (Verify aggregates math matches)
  console.log("\n⏳ Test 4: Verifying Dashboard Calculations...");
  const res4 = await fetch(`${BASE_URL}/api/dashboard`, {
    headers: { "Cookie": cookieHeader }
  });
  const dashData = await res4.json();
  console.log(`📊 Total Net Worth: ${dashData.summary.totalNetWorth}€`);
  console.log(`📊 Recent Trans.: "${dashData.summary.recentTransactions[0]?.description}"`);
  
  if (dashData.summary.totalNetWorth === -25.50) {
    console.log("✅ Balance math is perfectly tracking!");
  } else {
    console.log("❌ Balance math mismatch.");
  }
}

runTests().catch(console.error);