// k6 load test for Kanbedu read paths.
//
// DO NOT RUN AGAINST PRODUCTION. It logs in and hammers the API; against prod it
// would hit real student data and Neon/Vercel limits. Run only against a staging
// or local target with seeded test data.
//
// Usage:
//   k6 run -e BASE_URL=http://localhost:3000 \
//          -e TEST_EMAIL=loadtest@example.com \
//          -e TEST_PASSWORD=secret123 \
//          load/k6-load-test.js
//
// k6 is a standalone binary (https://k6.io) — not an npm dependency. Install it
// on the D: drive and run the command above.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.TEST_EMAIL || "loadtest@example.com";
const PASSWORD = __ENV.TEST_PASSWORD || "changeme";

export const options = {
  // Ramp to 300 concurrent virtual users to validate the trial-scale target.
  stages: [
    { duration: "1m", target: 50 },
    { duration: "2m", target: 300 },
    { duration: "2m", target: 300 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    // 95% of requests under 800ms; error rate under 1%.
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

// Log in once per VU init to get a session cookie. The middleware enforces an
// Origin allowlist on mutations, so send an Origin matching BASE_URL.
export function setup() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json", Origin: BASE_URL } }
  );
  check(res, { "login succeeded": (r) => r.status === 200 });
  // Return the session cookie so VUs can reuse it.
  const cookie = res.cookies["kanbedu-session"];
  return { sessionCookie: cookie && cookie[0] ? cookie[0].value : "" };
}

export default function (data) {
  const headers = {
    Cookie: `kanbedu-session=${data.sessionCookie}`,
    Origin: BASE_URL,
  };

  // Hot read path: list boards.
  const boards = http.get(`${BASE_URL}/api/boards`, { headers });
  check(boards, {
    "boards 200": (r) => r.status === 200,
    "boards is array": (r) => {
      try { return Array.isArray(r.json()); } catch { return false; }
    },
  });

  // Notifications poll — another common read.
  const notes = http.get(`${BASE_URL}/api/notifications`, { headers });
  check(notes, { "notifications 200": (r) => r.status === 200 });

  sleep(1);
}
