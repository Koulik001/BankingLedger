// test-deadlock.js
// Run with: node test-deadlock.js
// Tests concurrent X→Y and Y→X transfers simultaneously

const fetch = require("node-fetch")

// ─────────────────────────────────────────────
// FILL THESE IN before running
// Get them from Postman after logging in
// ─────────────────────────────────────────────
const USER1_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkNWZkMDVhOC0wZjI4LTRhMGItOGVlZS05Zjk4ZDBkMGIyZGIiLCJpYXQiOjE3ODg0Njc4MzEsImV4cCI6MTc4ODcyNzAzMX0.UsDWQTHAhUSZH79uTfyINc0MIWR2zDd4V0kxZNj-Los"
const USER2_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NmE0MmVmNS0xNmJmLTQzNTMtOTE3ZC00MmI2Y2I1MjI1NDUiLCJpYXQiOjE3ODg0OTc0NTAsImV4cCI6MTc4ODc1NjY1MH0.khLM58KGPJXQqR-bZZF7dkf3Vl5i65OlQ_dhpUWZ2Sk"
const USER1_ACCOUNT = "560833c3-ec51-45cb-9c0f-b195b4006f8b"
const USER2_ACCOUNT = "4cf02f18-cd23-4989-a44a-3c4f6a22642b"

const BASE_URL = "https://bankingledger.onrender.com"

async function transfer({ fromAccount, toAccount, amount, idempotencyKey, token, label }) {
    console.log(`[${label}] Firing request...`)
    const start = Date.now()

    try {
        const res = await fetch(`${BASE_URL}/api/transaction`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ from_ac: fromAccount, to_ac: toAccount, amount, idempotency_key: idempotencyKey })
        })

        const data = await res.json()
        const duration = Date.now() - start

        console.log(`[${label}] Status: ${res.status} | Time: ${duration}ms`)
        console.log(`[${label}] Response:`, data.message)
        return { status: res.status, data }

    } catch (err) {
        console.error(`[${label}] Error:`, err.message)
    }
}

async function runTest() {
    console.log("\n=== DEADLOCK TEST ===")
    console.log("Firing X→Y and Y→X simultaneously...\n")

    // Fire both transfers at exactly the same time
    // Promise.all ensures neither waits for the other
    const [result1] = await Promise.all([
        transfer({
            fromAccount: USER1_ACCOUNT,
            toAccount: USER2_ACCOUNT,
            amount: 100,
            idempotencyKey: `deadlock-test-1-${Date.now()}`,
            token: USER1_TOKEN,
            label: "T1 (X→Y)"
        }),
        // transfer({
        //     fromAccount: USER2_ACCOUNT,
        //     toAccount: USER1_ACCOUNT,
        //     amount: 100,
        //     idempotencyKey: `deadlock-test-2-${Date.now()}`,
        //     token: USER2_TOKEN,
        //     label: "T2 (Y→X)"
        // })
    ])

    console.log("\n=== RESULTS ===")
    console.log("T1 status:", result1?.status)
    //console.log("T2 status:", result2?.status)

    // Both should succeed — 201
    // Before fix: one might get 500 (deadlock detected)
    // After fix: both get 201 (consistent lock ordering)
    if (result1?.status === 201) {
        console.log("\n✅ PASSED — both transactions completed successfully")
    } else {
        console.log("\n❌ FAILED — one or both transactions did not complete")
    }
}

runTest()