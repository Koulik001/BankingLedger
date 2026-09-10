import http from "k6/http"
import { check, sleep } from "k6"

export let options = {
    vus: 50, 
    duration: "30s"
}

const BASE_URL = "https://bankingledger.onrender.com"
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkNWZkMDVhOC0wZjI4LTRhMGItOGVlZS05Zjk4ZDBkMGIyZGIiLCJpYXQiOjE3ODg0Njc4MzEsImV4cCI6MTc4ODcyNzAzMX0.UsDWQTHAhUSZH79uTfyINc0MIWR2zDd4V0kxZNj-Los"
const ACCOUNT_ID = "560833c3-ec51-45cb-9c0f-b195b4006f8b"

export default function () {
    const res = http.get(
        `${BASE_URL}/api/accounts/balance/${ACCOUNT_ID}`,
        { headers: { Authorization: `Bearer ${TOKEN} `} }
    )

    check(res, {
        "status is 200": (r) => r.status === 200,
        "response time < 200ms": (r) => r.timings.duration < 200,
    })

    sleep(0.1)
}