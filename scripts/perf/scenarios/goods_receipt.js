import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const USERNAME = __ENV.PERF_USERNAME || "admin";
const PASSWORD = __ENV.PERF_PASSWORD || "change-me-admin-password";

export const options = {
  vus: Number(__ENV.VUS || 2),
  duration: __ENV.DURATION || "20s",
};

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );

  check(loginRes, {
    "login status is 200": (res) => res.status === 200,
  });

  return { token: loginRes.json("access_token") };
}

export default function (data) {
  const operationId = `perf-gr-${__VU}-${__ITER}-${Date.now()}`;
  const res = http.post(
    `${BASE_URL}/api/goods-receipts`,
    JSON.stringify({ notes: `perf-goods-receipt-${operationId}` }),
    {
      headers: {
        Authorization: `Bearer ${data.token}`,
        "Content-Type": "application/json",
        "X-Client-Operation-Id": operationId,
      },
    },
  );

  check(res, {
    "goods receipt create is 201": (response) => response.status === 201,
  });

  sleep(0.2);
}
