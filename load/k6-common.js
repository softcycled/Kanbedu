// Shared setup helpers for the k6 scripts in this directory. Keeping login
// and header construction in one place means an auth/Origin change only
// needs to be made once instead of drifting across k6-load-test.js and
// k6-limit-test.js.

import http from "k6/http";
import { check } from "k6";

export function envConfig() {
  return {
    BASE_URL: __ENV.BASE_URL || "http://localhost:3000",
    EMAIL: __ENV.TEST_EMAIL || "loadtest@example.com",
    PASSWORD: __ENV.TEST_PASSWORD || "changeme",
  };
}

// Log in once per VU init to get a session cookie. The middleware enforces an
// Origin allowlist on mutations, so send an Origin matching BASE_URL.
export function login(BASE_URL, EMAIL, PASSWORD) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json", Origin: BASE_URL } }
  );
  check(res, { "login succeeded": (r) => r.status === 200 });
  const cookie = res.cookies["kanbedu-session"];
  return { sessionCookie: cookie && cookie[0] ? cookie[0].value : "" };
}

export function headersFor(sessionCookie, BASE_URL) {
  return {
    Cookie: `kanbedu-session=${sessionCookie}`,
    Origin: BASE_URL,
  };
}
