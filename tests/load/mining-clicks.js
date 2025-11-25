import http from "k6/http"
import { check, sleep } from "k6"

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000"
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ""
const USERS = Number(__ENV.USERS || 1000)
const DURATION = __ENV.DURATION || "1m"
const RPS = Number(__ENV.RPS || 10000)

export const options = {
  discardResponseBodies: true,
  scenarios: {
    burst_clicks: {
      executor: "constant-arrival-rate",
      rate: RPS,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: USERS,
      maxVUs: USERS * 2,
    },
  },
}

function buildHeaders(idempotencyKey) {
  const headers = {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  }

  if (AUTH_TOKEN) {
    headers.Cookie = `auth-token=${AUTH_TOKEN}`
  }

  return headers
}

export default function () {
  const idempotencyKey = `${__VU}-${__ITER}-${Date.now()}`
  const res = http.post(`${BASE_URL}/api/mining/click`, "{}", {
    headers: buildHeaders(idempotencyKey),
  })

  check(res, {
    "status is acceptable": (r) => [200, 202, 503].includes(r.status),
    "no throttling": (r) => r.status !== 429,
  })

  if (res.status === 202 && res.json()?.statusUrl) {
    const statusUrl = res.json().statusUrl
    const statusRes = http.get(statusUrl, {
      headers: buildHeaders(idempotencyKey),
    })
    check(statusRes, {
      "status poll ok": (r) => [200, 202, 503].includes(r.status),
      "status poll not throttled": (r) => r.status !== 429,
    })
  }

  sleep(0.1)
}
