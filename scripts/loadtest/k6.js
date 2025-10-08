import http from "k6/http"
import { sleep } from "k6"

export const options = {
  vus: 200,
  duration: "2m",
  thresholds: {
    http_req_duration: ["p(95)<300"],
    http_req_failed: ["rate<0.005"],
  },
}

export default function () {
  http.get(`${__ENV.BASE_URL}/api/admin/transactions?limit=50`)
  http.get(`${__ENV.BASE_URL}/api/admin/users?limit=100`)
  sleep(1)
}
