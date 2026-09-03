import http from "k6/http"
import { check, sleep } from "k6"

export let options = {
    vus: 50, 
    duration: "30s"
}

const BASE_URL = "http://localhost:3000"
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NTVjYTZjMy00M2QzLTQzYWUtOTU3NC1lNWMyNWE5ZWM4YjgiLCJpYXQiOjE3ODgyODk0NDYsImV4cCI6MTc4ODU0ODY0Nn0.AofunoqcSfdudw41-IzNFR19pBYTW_1rTazLEz88VYA"
const ACCOUNT_ID = "3acf0d0a-4258-444d-b528-0f03604c3cdf"

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